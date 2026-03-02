@Library('bawadev/kamal-deployment@main') _

// Jenkinsfile for SoftX Ecommerce
// Type: E-commerce (Neo4j + MinIO)
// Infrastructure: Managed via Docker Compose (Neo4j + MinIO)
//
// This file lives in softx-ecommerce repository and delegates to
// the kamal-deployment pipeline library for actual deployment logic

deployEcommerceStack(
    appName:       'ecommerce',
    appRepo:       'bawadev/softx-ecommerce',
    dockerImage:   'bawadev/ecommerce',
    containerPort: '3000',
    domains: [
        dev:  'dev.locked.lk',
        prod: 'locked.lk'
    ],
    dbInitScripts: [
        'npm run db:init',
        'npm run db:seed',
        'npm run setup:categories'
    ]
)
