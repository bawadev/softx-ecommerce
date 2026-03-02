@Library('bawadev/kamal-deployment@main') _

// Jenkinsfile for FactoryBay (master → prod)
// Type: E-commerce (Neo4j + MinIO)
// Infrastructure: Managed via Kamal accessories (Neo4j + MinIO)
//
// This file lives in TheFactoryBay repository and delegates to
// the kamal-deployment pipeline library for actual deployment logic.
//
// Flow:
//   1. Build Docker image from source
//   2. Push to GHCR
//   3. Boot accessories (Neo4j + MinIO) if not running
//   4. kamal redeploy (deploys pre-built image via Dockerfile.placeholder)
//   5. HTTP health check against locked.lk

deploySupabaseApp(
    appName:       'factorybay',
    sourceRepo:    'bawadev/TheFactoryBay',
    dockerImage:   'bawadev/factorybay',
    containerPort: '3000',
    kamalConfig:   'apps/factorybay/deploy.yml',
    domains: [
        dev:  'dev.locked.lk',
        prod: 'locked.lk'
    ],
    accessories: ['neo4j', 'minio'],
    skipBuild: true
)
