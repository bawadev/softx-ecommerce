@Library('softx-cicd') _
deployApp(
    appName: 'factorybay',
    dockerImage: 'bawadev/factorybay',
    dockerfile: 'Dockerfile',
    containerPort: '3000',
    traefikLabels: [
        prod: [domain: 'renfy.style'],
        prod2: [domain: 'renfy.style']
    ],
    envVars: [
        prod: [
            NEO4J_URI: 'neo4j://62.171.137.117:7687',
            NEO4J_USER: 'neo4j',
            NEO4J_PASSWORD: 'FactoryBay2024!Secure',
            JWT_SECRET: '7pJd0cmSU12mGdZ6+WpTLG+GToa+wn/Y0G0EHaKdni8=',
            MINIO_ENDPOINT: '62.171.137.117',
            MINIO_PORT: '9000',
            MINIO_ACCESS_KEY: 'factorybay_admin',
            MINIO_SECRET_KEY: 'MinIOFactoryBay2024!Secure',
            MINIO_BUCKET_NAME: 'product-images',
            MINIO_USE_SSL: 'false',
            NEXT_PUBLIC_MINIO_URL: 'http://62.171.137.117:9000',
            NEXT_PUBLIC_APP_URL: 'https://renfy.style',
            PORT: '3000'
        ]
    ]
)
