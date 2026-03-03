@Library('bawadev/kamal-deployment@main') _

// Jenkinsfile for SoftX Ecommerce
// Type: E-commerce (Neo4j + MinIO) via Kamal
// Uses deployKamalApp which handles:
// - Docker build with env-specific build args
// - Push to GHCR
// - Accessory boot (Neo4j, MinIO) via Kamal
// - App deployment via Kamal deploy

deployKamalApp(
    appName:       'ecommerce',
    sourceRepo:    'bawadev/softx-ecommerce',
    dockerImage:   'bawadev/ecommerce',
    containerPort: '3000',
    kamalConfig:   'apps/ecommerce/deploy.yml',
    domains:       [dev: 'dev.locked.lk', prod: 'locked.lk'],
    accessories:   ['neo4j', 'minio'],
    buildArgs: [
        dev:  [NEXT_PUBLIC_MINIO_URL: 'http://95.111.252.20:9000', NEXT_PUBLIC_APP_URL: 'https://dev.locked.lk'],
        prod: [NEXT_PUBLIC_MINIO_URL: 'https://minio.locked.softx.world', NEXT_PUBLIC_APP_URL: 'https://locked.lk']
    ]
)
