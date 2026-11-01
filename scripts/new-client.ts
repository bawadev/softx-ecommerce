/**
 * scripts/new-client.ts — provision a new SoftX storefront client.
 *
 * One command onboards client N+1 (Phase 6 Task 2). It is IDEMPOTENT — every
 * step checks before it acts and re-runs are safe. Steps:
 *
 *   1. validate the client id (kebab-case, not reserved)
 *   2. Neo4j container `ecom-<id>-neo4j` (own tenant, own port, own volume)
 *      — created via `docker run` if missing, reused if present; dev-grade
 *        credentials are printed (and written into the app's env files)
 *   3. MinIO bucket `<id>-media` — ONLY if the `mc` binary and MC_* env vars
 *      are present; otherwise prints the manual step (never blocks)
 *   4. instantiate `apps/<id>` from `apps/_template` (name, workspace deps,
 *      CLIENT_ID + Neo4j env in `.env.local.example` and gitignored
 *      `.env.local`)
 *   5. add `apps/<id>` to the root workspaces explicit list (alphabetical)
 *      if missing, then `npm install`
 *   6. apply scripts/seed-client.cypher via cypher-shell in the new container
 *   7. print a summary of exactly what it did
 *
 * Usage:
 *   npm run new-client -- --client <id> [--port <p>] [--seed <cypher-file>]
 *
 * Env overrides:
 *   NEW_CLIENT_NEO4J_PASSWORD  container password (default: `<id>123`, dev-grade)
 *   MC_ENDPOINT / MC_ACCESS_KEY / MC_SECRET_KEY  enable the MinIO step
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const TEMPLATE_DIR = path.join(ROOT, 'apps', '_template')

const PORT_RANGE_START = 7600
const PORT_RANGE_END = 7699
const PREFERRED_PORT = 7601

/** Reserved workspace/app ids. */
const RESERVED_IDS = new Set(['factorybay', 'template', '_template'])

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

interface Args {
  clientId: string
  port?: number
  seedFile: string
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--client') out.clientId = argv[++i]
    else if (a === '--port') out.port = Number(argv[++i])
    else if (a === '--seed') out.seedFile = argv[++i]
    else {
      console.error(`Unknown argument: ${a}`)
      console.error('Usage: npm run new-client -- --client <id> [--port <p>] [--seed <cypher-file>]')
      process.exit(2)
    }
  }
  if (!out.clientId) {
    console.error('Missing --client <id>')
    console.error('Usage: npm run new-client -- --client <id> [--port <p>] [--seed <cypher-file>]')
    process.exit(2)
  }
  return {
    clientId: out.clientId,
    port: out.port,
    seedFile: out.seedFile ? path.resolve(ROOT, out.seedFile) : path.join(ROOT, 'scripts', 'seed-client.cypher'),
  }
}

function validateClientId(id: string): void {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id) || id.length > 48) {
    console.error(
      `Invalid client id "${id}": must be kebab-case (lowercase letters, digits, dashes; start with a letter), max 48 chars.`
    )
    process.exit(2)
  }
  if (RESERVED_IDS.has(id)) {
    console.error(`Client id "${id}" is reserved (existing app or the template).`)
    process.exit(2)
  }
}

/** Run a command, return trimmed stdout; throw with stderr on failure. */
function sh(cmd: string, args: string[], opts: { cwd?: string; allowFail?: boolean } = {}): string {
  try {
    return execFileSync(cmd, args, { cwd: opts.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (e: any) {
    if (opts.allowFail) return ''
    const stderr = e.stderr || e.message || ''
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}\n${stderr}`)
  }
}

function hasBinary(cmd: string): boolean {
  return sh('which', [cmd], { allowFail: true }) !== ''
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '0.0.0.0')
  })
}

/** Prefer PREFERRED_PORT, then scan 7600-7699. */
async function findFreePort(): Promise<number> {
  const candidates = [PREFERRED_PORT]
  for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) if (p !== PREFERRED_PORT) candidates.push(p)
  for (const p of candidates) if (await isPortFree(p)) return p
  throw new Error(`No free port in ${PORT_RANGE_START}-${PORT_RANGE_END}`)
}

function step(n: number, msg: string): void {
  console.log(`\n[${n}/7] ${msg}`)
}

// ---------------------------------------------------------------------------
// step 2: Neo4j container (tenant = own container)
// ---------------------------------------------------------------------------

interface ContainerInfo {
  name: string
  port: number
  password: string
  state: 'created' | 'reused'
}

function inspectPublishedPort(name: string): number | undefined {
  const raw = sh(
    'docker',
    [
      'inspect',
      '--format',
      '{{range $p, $conf := .HostConfig.PortBindings}}{{$p}} {{(index $conf 0).HostPort}}{{"\\n"}}{{end}}',
      name,
    ],
    { allowFail: true }
  )
  // lines look like: "7687/tcp 7601"
  for (const line of raw.split('\n')) {
    const m = line.trim().match(/^7687\/tcp\s+(\d+)$/)
    if (m) return Number(m[1])
  }
  return undefined
}

function inspectEnv(name: string, key: string): string | undefined {
  const raw = sh('docker', ['inspect', '--format', '{{range .Config.Env}}{{println .}}{{end}}', name], {
    allowFail: true,
  })
  for (const line of raw.split('\n')) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1)
  }
  return undefined
}

async function ensureContainer(id: string, portArg: number | undefined, password: string): Promise<ContainerInfo> {
  const name = `ecom-${id}-neo4j`
  const existing = sh('docker', ['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.Names}}'], {
    allowFail: true,
  })

  if (existing === name) {
    const running = sh('docker', ['inspect', '--format', '{{.State.Running}}', name], { allowFail: true })
    if (running !== 'true') {
      sh('docker', ['start', name])
      console.log(`  started existing (stopped) container ${name}`)
    } else {
      console.log(`  container ${name} already running — reusing`)
    }
    const port = inspectPublishedPort(name)
    if (!port) throw new Error(`Container ${name} exists but publishes no host port for 7687 — recreate it.`)
    const auth = inspectEnv(name, 'NEO4J_AUTH') || ''
    const knownPassword = auth.startsWith('neo4j/') ? auth.slice('neo4j/'.length) : password
    if (knownPassword !== password) {
      console.log(`  NOTE: container password differs from the generated one; using the container's.`)
    }
    return { name, port, password: knownPassword, state: 'reused' }
  }

  const port = portArg ?? (await findFreePort())
  if (!(await isPortFree(port))) {
    throw new Error(`Port ${port} is not free (pass --port <p> or free it first).`)
  }
  console.log(`  docker run -d --name ${name} -e NEO4J_AUTH=neo4j/<password> -p ${port}:7687 -v ${name}-data:/data neo4j:latest`)
  sh('docker', [
    'run', '-d',
    '--name', name,
    '--restart', 'unless-stopped',
    '-e', `NEO4J_AUTH=neo4j/${password}`,
    '-p', `${port}:7687`,
    '-v', `${name}-data:/data`,
    'neo4j:latest',
  ])
  return { name, port, password, state: 'created' }
}

/** Wait until cypher-shell inside the container answers (fresh Neo4j takes ~10-30s). */
async function waitReady(container: string, password: string): Promise<void> {
  const deadline = Date.now() + 120_000
  process.stdout.write('  waiting for Neo4j readiness')
  while (Date.now() < deadline) {
    const r = spawnSync(
      'docker',
      ['exec', container, 'cypher-shell', '-a', 'neo4j://localhost:7687', '-u', 'neo4j', '-p', password, 'RETURN 1'],
      { encoding: 'utf8' }
    )
    if (r.status === 0) {
      console.log(' ready.')
      return
    }
    process.stdout.write('.')
    await new Promise((res) => setTimeout(res, 2000))
  }
  throw new Error('Neo4j did not become ready within 120s')
}

// ---------------------------------------------------------------------------
// step 3: MinIO (optional — never blocks provisioning)
// ---------------------------------------------------------------------------

function ensureMinioBucket(id: string): void {
  const endpoint = process.env.MC_ENDPOINT
  const accessKey = process.env.MC_ACCESS_KEY
  const secretKey = process.env.MC_SECRET_KEY

  if (!hasBinary('mc') || !endpoint || !accessKey || !secretKey) {
    console.log('  SKIPPED: `mc` binary or MC_ENDPOINT/MC_ACCESS_KEY/MC_SECRET_KEY not set.')
    console.log(`  Manual step (when the shared MinIO endpoint is configured):`)
    console.log(`    mc alias set softx ${endpoint || '<endpoint>'} <access-key> <secret-key>`)
    console.log(`    mc mb --ignore-existing softx/${id}-media`)
    return
  }

  const alias = `softx-${id}`
  sh('mc', ['alias', 'set', alias, endpoint, accessKey, secretKey])
  sh('mc', ['mb', '--ignore-existing', `${alias}/${id}-media`])
  console.log(`  created (or already existing) bucket ${id}-media on ${endpoint}`)
}

// ---------------------------------------------------------------------------
// step 4: instantiate apps/<id> from apps/_template
// ---------------------------------------------------------------------------

function instantiateApp(id: string, port: number, password: string): 'created' | 'exists' {
  const appDir = path.join(ROOT, 'apps', id)

  if (fs.existsSync(appDir)) {
    console.log(`  apps/${id} already exists — leaving app files untouched (idempotent re-run).`)
    const envLocal = path.join(appDir, '.env.local')
    if (!fs.existsSync(envLocal)) {
      fs.writeFileSync(envLocal, renderEnv(id, port, password, ''), { mode: 0o600 })
      console.log(`  created missing ${`apps/${id}/.env.local`} (gitignored)`)
    }
    return 'exists'
  }

  // Copy the template, skipping build artifacts and files this script rewrites.
  const skipNames = new Set(['node_modules', '.next', '.env.example', 'README.md'])
  fs.cpSync(TEMPLATE_DIR, appDir, {
    recursive: true,
    filter: (source) => {
      const base = path.basename(source)
      if (skipNames.has(base)) return false
      if (base.endsWith('.tsbuildinfo')) return false
      return true
    },
  })
  console.log(`  copied apps/_template -> apps/${id} (env example, manifest and README rewritten below)`)

  // package.json: real name + workspace deps (the rest resolves via the root).
  const pkgPath = path.join(appDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  pkg.name = id
  pkg.dependencies = {
    '@softx/contract': '*',
    '@softx/engine': '*',
    ...(pkg.dependencies || {}),
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`  package.json: name=${id}, dependencies=@softx/contract,@softx/engine (workspace links)`)

  // .env.local.example + .env.local (the latter gitignored).
  const envBody = renderEnv(id, port, password, readTemplateEnvExample())
  fs.writeFileSync(path.join(appDir, '.env.local.example'), envBody + '\n')
  fs.writeFileSync(path.join(appDir, '.env.local'), envBody + '\n', { mode: 0o600 })
  console.log(`  wrote apps/${id}/.env.local.example (CLIENT_ID=${id}, NEO4J_URI=neo4j://localhost:${port})`)
  console.log(`  wrote apps/${id}/.env.local (gitignored; same values)`)

  // Short generated README (the template README documents the *template*).
  fs.writeFileSync(
    path.join(appDir, 'README.md'),
    `# ${id}\n\nGenerated by \`scripts/new-client.ts\` from \`apps/_template\` (Phase 6).\nSee \`apps/_template/README.md\` for the anatomy of this app, and\n\`scripts/seed-client.cypher\` for this tenant's seed data.\n\n- tenant container: \`ecom-${id}-neo4j\` (bolt \`neo4j://localhost:${port}\`)\n- dev: \`npm run dev -w ${id}\`\n- build: \`npm run build -w ${id}\`\n`
  )
  return 'created'
}

/** The template's .env.example body (comments preserved) with client values substituted. */
function readTemplateEnvExample(): string {
  const raw = fs.readFileSync(path.join(TEMPLATE_DIR, '.env.example'), 'utf8')
  return raw
    .replace(/^CLIENT_ID=.*$/m, 'CLIENT_ID=__CLIENT_ID__')
    .replace(/^NEO4J_URI=.*$/m, 'NEO4J_URI=__NEO4J_URI__')
    .replace(/^NEO4J_USER=.*$/m, 'NEO4J_USER=__NEO4J_USER__')
    .replace(/^NEO4J_PASSWORD=.*$/m, 'NEO4J_PASSWORD=__NEO4J_PASSWORD__')
}

function renderEnv(id: string, port: number, password: string, templateBody: string): string {
  if (templateBody) {
    return templateBody
      .replace('__CLIENT_ID__', id)
      .replace('__NEO4J_URI__', `neo4j://localhost:${port}`)
      .replace('__NEO4J_USER__', 'neo4j')
      .replace('__NEO4J_PASSWORD__', password)
  }
  // Fallback (template .env.example missing/unexpected): still write a correct file.
  return [
    `# ${id} storefront env (generated by scripts/new-client.ts)`,
    `CLIENT_ID=${id}`,
    `NEO4J_URI=neo4j://localhost:${port}`,
    `NEO4J_USER=neo4j`,
    `NEO4J_PASSWORD=${password}`,
    `DEFAULT_CURRENCY=LKR`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// step 5: root workspaces + npm install
// ---------------------------------------------------------------------------

function ensureWorkspaceEntry(id: string): boolean {
  const rootPkgPath = path.join(ROOT, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'))
  const workspaces: string[] = pkg.workspaces || []
  const entry = `apps/${id}`
  if (workspaces.includes(entry)) {
    console.log(`  root workspaces already lists ${entry}`)
    return false
  }
  const apps = workspaces.filter((w) => w.startsWith('apps/'))
  const rest = workspaces.filter((w) => !w.startsWith('apps/'))
  apps.push(entry)
  apps.sort()
  pkg.workspaces = [...apps, ...rest]
  fs.writeFileSync(rootPkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`  added ${entry} to root workspaces (alphabetical, explicit list)`)
  return true
}

function npmInstall(): void {
  console.log('  npm install (links the new workspace + @softx/* packages)...')
  execFileSync('npm', ['install'], { cwd: ROOT, stdio: 'inherit' })
}

// ---------------------------------------------------------------------------
// step 6: seed
// ---------------------------------------------------------------------------

function applySeed(container: string, password: string, seedFile: string): void {
  if (!fs.existsSync(seedFile)) throw new Error(`Seed file not found: ${seedFile}`)
  const body = fs.readFileSync(seedFile, 'utf8')
  const r = spawnSync(
    'docker',
    ['exec', '-i', container, 'cypher-shell', '-a', 'neo4j://localhost:7687', '-u', 'neo4j', '-p', password],
    { input: body, encoding: 'utf8' }
  )
  if (r.status !== 0) throw new Error(`Seed failed:\n${r.stderr || r.stdout}`)
  const counts = sh('docker', [
    'exec', container, 'cypher-shell',
    '-a', 'neo4j://localhost:7687', '-u', 'neo4j', '-p', password,
    'MATCH (p:Product) WITH count(p) AS products OPTIONAL MATCH (v:ProductVariant) WITH products, count(v) AS variants OPTIONAL MATCH (h:HeroSlide) WITH products, variants, count(h) AS heroSlides RETURN products, variants, heroSlides',
  ])
  console.log('  seed applied. counts:')
  for (const line of counts.split('\n')) {
    const m = line.trim().match(/^"?\d+"?,\s*"?\d+"?,\s*"?\d+"?$/)
    if (m) console.log(`    products / variants / heroSlides = ${line.trim()}`)
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  validateClientId(args.clientId)
  const { clientId } = args
  const password = process.env.NEW_CLIENT_NEO4J_PASSWORD || `${clientId}123`

  console.log(`SoftX new-client provisioning — client "${clientId}"`)
  console.log('=' .repeat(60))

  sh('docker', ['info', '--format', '{{.ServerVersion}}']) // fails loudly if the daemon is down

  step(1, 'validating client id')
  console.log(`  ok: "${clientId}" (kebab-case, not reserved)`)

  step(2, 'Neo4j container (container-per-client)')
  const container = await ensureContainer(clientId, args.port, password)
  console.log(`  container : ${container.name} (${container.state})`)
  console.log(`  bolt      : neo4j://localhost:${container.port}`)
  console.log(`  credentials (DEV-GRADE, printed by design): neo4j / ${container.password}`)
  await waitReady(container.name, container.password)

  step(3, 'MinIO bucket prefix (optional)')
  ensureMinioBucket(clientId)

  step(4, 'instantiate app from apps/_template')
  const appState = instantiateApp(clientId, container.port, container.password)

  step(5, 'workspace wiring + install')
  ensureWorkspaceEntry(clientId)
  npmInstall()

  step(6, 'seed tenant data')
  applySeed(container.name, container.password, args.seedFile)

  step(7, 'summary')
  console.log(`  client id          : ${clientId}`)
  console.log(`  app                : apps/${clientId} (${appState}) — committed deliverable except .env.local (gitignored)`)
  console.log(`  neo4j container    : ${container.name} (volume ${container.name}-data, image neo4j:latest)`)
  console.log(`  bolt uri           : neo4j://localhost:${container.port}`)
  console.log(`  neo4j credentials  : neo4j / ${container.password}  (dev-grade)`)
  console.log(`  manage via compose : docker compose -f docker-compose.${clientId}.yml up -d   # same container/volume/port/auth`)
  console.log(`  seed               : ${path.relative(ROOT, args.seedFile)} (idempotent MERGEs)`)
  console.log(`  next steps         :`)
  console.log(`    npm run dev -w ${clientId}          # defaults to :3000 — pass -- -p <port> to avoid clashes`)
  console.log(`    npm run build -w ${clientId}`)
  console.log('\nDone.')
}

main().catch((e) => {
  console.error(`\nERROR: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
