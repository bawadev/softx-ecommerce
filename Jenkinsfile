@Library('bawadev/kamal-deployment@main') _

deployKamalApp(
    appName:       'ecommerce',
    sourceRepo:    'bawadev/softx-ecommerce',
    dockerImage:   'bawadev/ecommerce',
    containerPort: '3000',
    kamalConfig:   'apps/ecommerce/deploy.yml',
    domains:       [
        dev:  'dev.locked.lk',
        prod: 'locked.lk'
    ],
    accessories:   ['neo4j', 'minio'],
    buildArgs: [
        dev: [
            NEXT_PUBLIC_MINIO_URL: 'http://95.111.252.20:9000',
            NEXT_PUBLIC_APP_URL:   'https://dev.locked.lk'
        ],
        prod: [
            NEXT_PUBLIC_MINIO_URL: 'https://cdn.locked.lk',
            NEXT_PUBLIC_APP_URL:   'https://locked.lk'
        ]
    ]
)
