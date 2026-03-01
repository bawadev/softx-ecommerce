@Library('bawadev/kamal-deployment@main') _

// Jenkinsfile for FactoryBay
// Type: E-commerce (Neo4j + MinIO)
// Infrastructure: Managed via Kamal accessories
//
// This file lives in TheFactoryBay repository and delegates to
// the kamal-deployment pipeline library for actual deployment logic

deploySupabaseApp(
    appName:      'factorybay',
    sourceRepo:   'bawadev/TheFactoryBay',
    dockerImage:  'bawadev/factorybay',
    containerPort: '3000',
    kamalConfig:  'apps/factorybay/deploy.yml',
    domains:      [
        dev:  'dev.renfy.style',
        prod: 'renfy.style'
    ],
    skipBuild:    true  // Image is already built in Jenkins, use kamal redeploy
)
