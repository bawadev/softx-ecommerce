@Library('bawadev/kamal-deployment@main') _

// Jenkinsfile for Ecom
// Type: E-commerce (Neo4j + MinIO)
// Infrastructure: Managed via Kamal accessories
//
// This file lives in softx-ecommerce repository and delegates to
// the kamal-deployment pipeline library for actual deployment logic

deploySupabaseApp(
    appName:      'ecommerce',
    sourceRepo:   'bawadev/softx-ecommerce',
    dockerImage:  'bawadev/ecommerce',
    containerPort: '3000',
    kamalConfig:  'apps/ecommerce/deploy.yml',
    domains:      [
        dev:  'dev.renfy.style',
        prod: 'renfy.style'
    ],
    skipBuild:    true  // Image is already built in Jenkins, use kamal redeploy
)
