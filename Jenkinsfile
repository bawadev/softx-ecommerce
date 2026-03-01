@Library('softx-cicd') _

// Environment configuration
def environment = params.ENVIRONMENT ?: 'dev'

// Handle "auto" mode - detect environment from branch name
if (environment == 'auto') {
    def branch = env.BRANCH_NAME ?: 'master'
    if (branch == 'master' || branch == 'main') {
        environment = 'prod'
    } else if (branch == 'dev') {
        environment = 'dev'
    } else {
        environment = 'dev' // Default for feature branches
    }
    echo "Auto-detected environment: ${environment} from branch: ${branch}"
}

def config = [
    dev: [
        domain:       'dev.renfy.style',
        serverIp:     '95.111.252.20',
        credentialId: 'ssh-key-dev'
    ],
    prod: [
        domain:       'renfy.style',
        serverIp:     '62.171.137.117',
        credentialId: 'ssh-key-prod'
    ],
    prod2: [
        domain:       'renfy.style',
        serverIp:     '95.111.252.20',
        credentialId: 'ssh-key-prod2'
    ]
]

def envConfig = config[environment]

if (!envConfig) {
    error "Unknown environment: ${environment}. Valid values: dev, prod, prod2"
}

// Deploy full e-commerce stack (infrastructure + database + application)
deployEcommerceStack(
    appName:       'factorybay',
    appRepo:       'bawadev/TheFactoryBay',
    dockerImage:   'bawadev/factorybay',
    containerPort: '3000',
    domain:        envConfig.domain,
    serverIp:      envConfig.serverIp,
    credentialId:  envConfig.credentialId,
    dbInitScripts: [] // Disabled - requires tsx which is not in production image
)
