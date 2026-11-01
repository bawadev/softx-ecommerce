@Library('bawadev/kamal-deployment@main') _

// Jenkinsfile for SoftX Ecommerce
// Type: E-commerce (Neo4j + MinIO) via Kamal
// Uses deployKamalApp which handles:
// - Docker build with env-specific build args
// - Push to GHCR
// - Accessory boot (Neo4j, MinIO) via Kamal
// - App deployment via Kamal deploy

// Pre-deploy checks. This file is a scripted pipeline (a bare shared-library
// call); deployKamalApp creates its own node/stages, so the checks stage
// acquires its own node and runs before the deploy call.
// Agent: infra-ci, inside a node:20-bookworm container — the agent host and the
// controller have no Node.js (builds #24/#25: "npm: not found"). The bookworm
// (Debian) image carries git, so checkout and the snapshot gate run in the same
// container; the named volume keeps npm's cache between runs (pattern from
// PlayMate's jenkinsfiles/playmate-mobile-checks.groovy).
stage('checks') {
    node('infra-ci') {
        docker.image('node:20-bookworm')
            .inside('--memory=3g --oom-score-adj=500 -v ecommerce-ci-home:/home/node -e HOME=/home/node') {
            checkout scm
            sh 'npm ci --no-audit --no-fund'
            sh 'JWT_SECRET=build-time-placeholder NEO4J_PASSWORD=dummy MINIO_ACCESS_KEY=dummy MINIO_SECRET_KEY=dummy MINIO_BUCKET_NAME=product-images MINIO_USE_SSL=false npm run build'
            sh 'npm test'
            sh 'npm run audit:api && git diff --exit-code -- packages/contract/etc'
        }
    }
}

deployKamalApp(
    appName:       'ecommerce',
    sourceRepo:    'bawadev/softx-ecommerce',
    dockerImage:   'bawadev/ecommerce',
    containerPort: '3000',
    kamalConfig:   'apps/ecommerce/deploy.yml',
    domains:       [dev: 'dev.locked.lk', prod: 'locked-demo.softx.world'],
    accessories:   ['neo4j', 'minio'],
    buildArgs: [
        dev:  [NEXT_PUBLIC_MINIO_URL: 'http://95.111.252.20:9000', NEXT_PUBLIC_APP_URL: 'https://dev.locked.lk'],
        prod: [NEXT_PUBLIC_MINIO_URL: 'https://cdn.locked-demo.softx.world', NEXT_PUBLIC_APP_URL: 'https://locked-demo.softx.world']
    ]
)
