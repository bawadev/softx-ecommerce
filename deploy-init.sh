#!/bin/bash

# Ecom Deployment Initialization Script
# This script initializes the production database and storage after deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check required environment variables
check_env() {
    print_info "Checking required environment variables..."

    REQUIRED_VARS=(
        "NEO4J_URI"
        "NEO4J_USER"
        "NEO4J_PASSWORD"
        "JWT_SECRET"
        "MINIO_ENDPOINT"
        "MINIO_ACCESS_KEY"
        "MINIO_SECRET_KEY"
    )

    MISSING_VARS=()

    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            MISSING_VARS+=("$var")
        fi
    done

    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${MISSING_VARS[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi

    print_success "All required environment variables are set"
}

# Function to wait for Neo4j to be ready
wait_for_neo4j() {
    print_info "Waiting for Neo4j to be ready..."

    MAX_ATTEMPTS=30
    ATTEMPT=0

    # Extract host and port from NEO4J_URI (e.g., neo4j://localhost:7687)
    NEO4J_HOST=$(echo $NEO4J_URI | sed -E 's|^[^:]+://([^:]+):.*|\1|')
    NEO4J_PORT=$(echo $NEO4J_URI | sed -E 's|^[^:]+://[^:]+:([0-9]+).*|\1|')

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if nc -z $NEO4J_HOST $NEO4J_PORT 2>/dev/null; then
            print_success "Neo4j is ready"
            return 0
        fi
        ATTEMPT=$((ATTEMPT + 1))
        echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS..."
        sleep 2
    done

    print_error "Neo4j failed to become ready within $((MAX_ATTEMPTS * 2)) seconds"
    exit 1
}

# Function to check if database needs initialization
check_database() {
    print_info "Checking database status..."

    # Run a simple query to check if database is accessible and initialized
    if npm run db:init > /dev/null 2>&1; then
        print_success "Database schema initialized"
    else
        print_error "Failed to initialize database schema"
        exit 1
    fi
}

# Function to seed database
seed_database() {
    print_info "Seeding database with default users..."

    if npm run db:seed; then
        print_success "Database seeded successfully"
        echo ""
        print_info "Default accounts created:"
        echo "  - Admin:    testadmin@ecommerce.com / Admin123!"
        echo "  - Customer: test@example.com / Customer123!"
        echo ""
    else
        print_warning "Database seeding failed or users already exist"
    fi
}

# Function to setup categories
setup_categories() {
    print_info "Setting up category hierarchy..."

    if npm run setup:categories; then
        print_success "Category hierarchy setup successfully"
    else
        print_warning "Category setup failed or categories already exist"
    fi
}

# Function to initialize MinIO
init_minio() {
    print_info "Initializing MinIO bucket..."

    if npm run minio:init; then
        print_success "MinIO bucket initialized"
    else
        print_warning "MinIO initialization failed or bucket already exists"
    fi
}

# Main deployment initialization flow
main() {
    echo ""
    echo "========================================="
    echo "  Ecom Deployment Initialization"
    echo "========================================="
    echo ""

    # Step 1: Check environment variables
    check_env

    # Step 2: Wait for Neo4j to be ready
    wait_for_neo4j

    # Step 3: Initialize database schema
    check_database

    # Step 4: Seed database with default users
    seed_database

    # Step 5: Setup category hierarchy
    setup_categories

    # Step 6: Initialize MinIO
    init_minio

    echo ""
    print_success "Deployment initialization complete!"
    echo ""
    print_info "Next steps:"
    echo "  1. Access your application at: ${NEXT_PUBLIC_APP_URL:-http://your-domain.com}"
    echo "  2. Login with the admin account: testadmin@ecommerce.com / Admin123!"
    echo "  3. Change default passwords immediately!"
    echo ""
    print_warning "SECURITY REMINDER:"
    echo "  - Change default admin password"
    echo "  - Update JWT_SECRET to a strong random value"
    echo "  - Review and secure all environment variables"
    echo ""
}

# Run main function
main
