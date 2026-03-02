#!/bin/bash

# Ecom Development Environment Manager
# This script manages Neo4j, MinIO, and Next.js development server

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

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to check and initialize database if needed
check_database() {
    print_info "Checking database status..."

    # Check if any users exist in the database
    USER_COUNT=$(docker exec ecommerce-neo4j cypher-shell -u neo4j -p ecommerce123 \
        "MATCH (u:User) RETURN count(u) as count" 2>/dev/null | tail -1 | tr -d ' \r\n' || echo "0")

    # Default to 0 if empty
    USER_COUNT=${USER_COUNT:-0}

    if [ "$USER_COUNT" -eq "0" ] 2>/dev/null; then
        print_warning "Database is empty (no users found)"
        echo ""
        echo "Would you like to initialize the database with:"
        echo "  - Schema (constraints & indexes)"
        echo "  - Test users (admin & customer accounts)"
        echo ""
        read -p "Initialize database? (y/n) [y]: " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            print_info "Initializing database schema..."
            npm run db:init || {
                print_error "Failed to initialize database schema"
                return 1
            }

            print_info "Seeding test users..."
            npm run db:seed || {
                print_error "Failed to seed database"
                return 1
            }

            print_success "Database initialized successfully!"
            echo ""
            echo "Would you like to setup the default category system?"
            echo "  - Ladies, Gents, Kids hierarchies"
            echo "  - Classic clothing categories"
            echo ""
            read -p "Setup categories? (y/n) [y]: " -n 1 -r
            echo ""

            if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
                print_info "Setting up category hierarchy..."
                npm run setup:categories || {
                    print_error "Failed to setup categories"
                    return 1
                }
                print_success "Categories setup successfully!"
            else
                print_warning "Skipping category setup"
                echo "  Run manually: npm run setup:categories"
            fi
        else
            print_warning "Skipping database initialization"
            print_warning "You won't be able to login without test users"
            echo "  Run manually: npm run db:init && npm run db:seed && npm run setup:categories"
        fi
    else
        print_success "Database has $USER_COUNT user(s)"
    fi
    echo ""
}

# Function to start all services
start_services() {
    print_info "Starting Ecom development environment..."

    # Check Docker
    check_docker

    # Start Neo4j and MinIO with Docker Compose
    print_info "Starting Neo4j and MinIO containers..."

    # Check if containers exist and are stopped
    if docker ps -a --format '{{.Names}}' | grep -q "ecommerce-neo4j"; then
        # Containers exist, just start them
        docker start ecommerce-neo4j ecommerce-minio 2>/dev/null || true
    else
        # Containers don't exist, create them
        docker compose up -d
    fi

    # Wait for Neo4j to be ready
    print_info "Waiting for Neo4j to be ready..."
    sleep 5

    # Check if Neo4j is accessible
    for i in {1..30}; do
        if nc -z localhost 7687 2>/dev/null; then
            print_success "Neo4j is ready on port 7687"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Neo4j failed to start within 30 seconds"
            exit 1
        fi
        sleep 1
    done

    # Check MinIO
    if docker ps | grep -q ecommerce-minio; then
        print_success "MinIO is running on port 9000 (API) and 9001 (Console)"
    else
        print_warning "MinIO container not running"
    fi

    # Wait a bit more for Neo4j to fully initialize (not just port open)
    print_info "Waiting for Neo4j to fully initialize..."
    sleep 3

    # Check and initialize database if needed
    check_database

    # Start Next.js dev server in background
    print_info "Starting Next.js development server..."
    npm run dev > .dev-server.log 2>&1 &
    DEV_SERVER_PID=$!
    echo $DEV_SERVER_PID > .dev-server.pid

    # Wait for Next.js to be ready
    print_info "Waiting for Next.js server to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            print_success "Next.js development server is ready on http://localhost:3000"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Next.js server failed to start within 30 seconds"
            print_info "Check .dev-server.log for details"
            exit 1
        fi
        sleep 1
    done

    echo ""
    print_success "All services started successfully!"
    echo ""
    print_info "Services:"
    echo "  - Next.js:       http://localhost:3000"
    echo "  - Neo4j Browser: http://localhost:7474 (neo4j/ecommerce123)"
    echo "  - MinIO Console: http://localhost:9001 (ecommerce/ecommerce123)"
    echo ""
    print_info "Test Accounts:"
    echo "  - Admin:    testadmin@ecommerce.com / Admin123!"
    echo "  - Customer: test@example.com / Customer123!"
    echo ""
    print_info "Logs:"
    echo "  - Next.js: tail -f .dev-server.log"
    echo "  - Neo4j:   docker logs -f ecommerce-neo4j"
    echo "  - MinIO:   docker logs -f ecommerce-minio"
    echo ""
}

# Function to stop all services
stop_services() {
    print_info "Stopping Ecom development environment..."

    # Stop Next.js dev server
    if [ -f .dev-server.pid ]; then
        DEV_SERVER_PID=$(cat .dev-server.pid)
        if ps -p $DEV_SERVER_PID > /dev/null 2>&1; then
            print_info "Stopping Next.js development server (PID: $DEV_SERVER_PID)..."
            kill $DEV_SERVER_PID 2>/dev/null || true
            # Wait for graceful shutdown
            sleep 2
            # Force kill if still running
            if ps -p $DEV_SERVER_PID > /dev/null 2>&1; then
                kill -9 $DEV_SERVER_PID 2>/dev/null || true
            fi
            print_success "Next.js server stopped"
        fi
        rm -f .dev-server.pid
    else
        print_warning "Next.js dev server PID file not found"
        # Try to find and kill any running npm dev process
        pkill -f "next dev" 2>/dev/null && print_success "Killed running Next.js processes" || true
    fi

    # Stop Docker containers
    print_info "Stopping Neo4j and MinIO containers..."
    docker compose stop
    print_success "Containers stopped"

    # Clean up log file
    rm -f .dev-server.log

    print_success "All services stopped successfully!"
}

# Function to restart all services
restart_services() {
    print_info "Restarting Ecom development environment..."
    stop_services
    sleep 2
    start_services
}

# Function to show status of all services
status_services() {
    print_info "Ecom Development Environment Status"
    echo ""

    # Check Docker
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running"
    else
        print_success "Docker is running"
    fi

    echo ""
    print_info "Docker Containers:"
    docker ps -a --filter "name=ecommerce" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    print_info "Next.js Development Server:"
    if [ -f .dev-server.pid ]; then
        DEV_SERVER_PID=$(cat .dev-server.pid)
        if ps -p $DEV_SERVER_PID > /dev/null 2>&1; then
            print_success "Running (PID: $DEV_SERVER_PID)"
            if nc -z localhost 3000 2>/dev/null; then
                echo "  URL: http://localhost:3000"
            fi
        else
            print_error "Not running (stale PID file)"
        fi
    else
        if pgrep -f "next dev" > /dev/null 2>&1; then
            print_warning "Running (but PID file missing)"
            echo "  PID: $(pgrep -f 'next dev')"
        else
            print_error "Not running"
        fi
    fi

    echo ""
    print_info "Port Status:"
    echo -n "  Neo4j (7687):  "
    if nc -z localhost 7687 2>/dev/null; then
        print_success "LISTENING"
    else
        print_error "NOT LISTENING"
    fi

    echo -n "  Neo4j HTTP (7474): "
    if nc -z localhost 7474 2>/dev/null; then
        print_success "LISTENING"
    else
        print_error "NOT LISTENING"
    fi

    echo -n "  MinIO API (9000):  "
    if nc -z localhost 9000 2>/dev/null; then
        print_success "LISTENING"
    else
        print_error "NOT LISTENING"
    fi

    echo -n "  MinIO Console (9001): "
    if nc -z localhost 9001 2>/dev/null; then
        print_success "LISTENING"
    else
        print_error "NOT LISTENING"
    fi

    echo -n "  Next.js (3000): "
    if nc -z localhost 3000 2>/dev/null; then
        print_success "LISTENING"
    else
        print_error "NOT LISTENING"
    fi
    echo ""
}

# Function to show logs
logs_services() {
    SERVICE=${1:-""}

    if [ -z "$SERVICE" ]; then
        print_info "Available logs: nextjs, neo4j, minio"
        print_info "Usage: $0 logs <service>"
        exit 1
    fi

    case $SERVICE in
        nextjs|next)
            if [ -f .dev-server.log ]; then
                tail -f .dev-server.log
            else
                print_error "Next.js log file not found. Is the server running?"
                exit 1
            fi
            ;;
        neo4j)
            docker logs -f ecommerce-neo4j
            ;;
        minio)
            docker logs -f ecommerce-minio
            ;;
        *)
            print_error "Unknown service: $SERVICE"
            print_info "Available logs: nextjs, neo4j, minio"
            exit 1
            ;;
    esac
}

# Function to backup Neo4j
backup_neo4j() {
    print_info "Backing up Neo4j database..."

    BACKUP_DIR="./backups/neo4j"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="neo4j-backup-${TIMESTAMP}.tar.gz"

    mkdir -p "$BACKUP_DIR"

    docker run --rm \
        --volumes-from ecommerce-neo4j \
        -v "$(pwd)/$BACKUP_DIR:/backup" \
        ubuntu tar czf "/backup/$BACKUP_FILE" /data 2>/dev/null

    if [ $? -eq 0 ]; then
        print_success "Neo4j backup created: $BACKUP_DIR/$BACKUP_FILE"
        ls -lh "$BACKUP_DIR/$BACKUP_FILE"
    else
        print_error "Neo4j backup failed"
        exit 1
    fi
}

# Function to backup MinIO
backup_minio() {
    print_info "Backing up MinIO data..."

    BACKUP_DIR="./backups/minio"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="minio-backup-${TIMESTAMP}.tar.gz"

    mkdir -p "$BACKUP_DIR"

    docker run --rm \
        --volumes-from ecommerce-minio \
        -v "$(pwd)/$BACKUP_DIR:/backup" \
        ubuntu tar czf "/backup/$BACKUP_FILE" /data 2>/dev/null

    if [ $? -eq 0 ]; then
        print_success "MinIO backup created: $BACKUP_DIR/$BACKUP_FILE"
        ls -lh "$BACKUP_DIR/$BACKUP_FILE"
    else
        print_error "MinIO backup failed"
        exit 1
    fi
}

# Function to backup all services
backup_all() {
    print_info "Backing up all services..."
    backup_neo4j
    echo ""
    backup_minio
    echo ""
    print_success "All backups completed"
}

# Function to show volume information
volumes_info() {
    print_info "Ecom Docker Volumes"
    echo ""

    # List volumes
    echo "Volumes:"
    docker volume ls | grep ecommerce
    echo ""

    # Volume details
    print_info "Volume Details:"
    for vol in neo4j_data neo4j_logs minio_data; do
        VOL_NAME="ecommerce_${vol}"
        if docker volume inspect "$VOL_NAME" > /dev/null 2>&1; then
            MOUNTPOINT=$(docker volume inspect "$VOL_NAME" --format '{{ .Mountpoint }}' 2>/dev/null)
            echo "  ${vol}: ${MOUNTPOINT}"
        fi
    done

    echo ""
    print_info "Disk Usage:"
    docker system df -v | grep -A 20 "Local Volumes" | head -n 10
}

# Function to show health status
health_check() {
    print_info "Ecom Health Check"
    echo ""

    # Neo4j
    echo -n "  Neo4j Database:     "
    if nc -z localhost 7687 2>/dev/null; then
        if docker exec ecommerce-neo4j cypher-shell -u neo4j -p ecommerce123 "RETURN 1" > /dev/null 2>&1; then
            print_success "Healthy"
        else
            print_warning "Running but not responding"
        fi
    else
        print_error "Down"
    fi

    # MinIO
    echo -n "  MinIO Storage:      "
    if curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; then
        print_success "Healthy"
    else
        if nc -z localhost 9000 2>/dev/null; then
            print_warning "Running but unhealthy"
        else
            print_error "Down"
        fi
    fi

    # Next.js
    echo -n "  Next.js Server:     "
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_success "Healthy"
    else
        if nc -z localhost 3000 2>/dev/null; then
            print_warning "Running but not responding"
        else
            print_error "Down"
        fi
    fi

    echo ""
}

# Function to reset (soft - keeps data)
reset_soft() {
    print_warning "Soft Reset - Restarting services (data preserved)"
    echo ""
    read -p "Continue with soft reset? (y/n) [y]: " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        stop_services

        print_info "Cleaning build cache..."
        rm -rf .next
        pkill -f "next dev" 2>/dev/null || true

        print_info "Restarting Docker containers..."
        docker compose restart

        echo ""
        print_success "Soft reset complete! Starting services..."
        echo ""
        start_services
    else
        print_warning "Soft reset cancelled"
    fi
}

# Function to reset (hard - removes all data)
reset_hard() {
    print_error "Hard Reset - This will DELETE ALL DATA including:"
    echo "  - All users and accounts"
    echo "  - All products and variants"
    echo "  - All orders and cart items"
    echo "  - All uploaded images"
    echo "  - All categories and filters"
    echo ""
    print_warning "This action CANNOT be undone!"
    echo ""
    read -p "Are you absolutely sure? Type 'yes' to confirm: " -r
    echo ""

    if [[ $REPLY == "yes" ]]; then
        print_info "Stopping all services..."
        stop_services

        print_info "Removing Docker volumes..."
        docker compose down -v

        print_info "Cleaning build cache..."
        rm -rf .next
        rm -rf .dev-server.log
        rm -rf .dev-server.pid
        pkill -f "next dev" 2>/dev/null || true

        print_success "Hard reset complete! All data removed."
        echo ""
        print_info "Starting fresh environment..."
        echo ""
        start_services
    else
        print_warning "Hard reset cancelled (you must type 'yes' to confirm)"
    fi
}

# Function to show help
show_help() {
    echo "Ecom Development Environment Manager"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start      Start all services (Neo4j, MinIO, Next.js)"
    echo "  stop       Stop all services"
    echo "  restart    Restart all services"
    echo "  reset      Reset environment (soft/hard)"
    echo "  status     Show status of all services"
    echo "  logs       Show logs for a specific service"
    echo "  backup     Backup database and storage"
    echo "  volumes    Show Docker volume information"
    echo "  health     Run health check on all services"
    echo "  help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start              # Start all services"
    echo "  $0 status             # Check service status"
    echo "  $0 logs nextjs        # View Next.js logs"
    echo "  $0 logs neo4j         # View Neo4j logs"
    echo "  $0 backup neo4j       # Backup Neo4j only"
    echo "  $0 backup minio       # Backup MinIO only"
    echo "  $0 backup all         # Backup everything"
    echo "  $0 volumes            # Show volume info"
    echo "  $0 health             # Health check"
    echo "  $0 reset soft         # Restart (keep data)"
    echo "  $0 reset hard         # Full reset (delete all data)"
    echo ""
    echo "Documentation:"
    echo "  README.md             # Project overview"
    echo "  INFRASTRUCTURE.md     # Infrastructure guide"
    echo "  USER_LOGIN_GUIDE.md   # Login credentials"
    echo ""
}

# Main script logic
case "${1:-}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    reset)
        case "${2:-soft}" in
            soft)
                reset_soft
                ;;
            hard)
                reset_hard
                ;;
            *)
                print_error "Invalid reset type: ${2:-}"
                echo "Usage: $0 reset [soft|hard]"
                echo "  soft - Restart services (keep data)"
                echo "  hard - Full reset (delete all data)"
                exit 1
                ;;
        esac
        ;;
    status)
        status_services
        ;;
    logs)
        logs_services "${2:-}"
        ;;
    backup)
        case "${2:-all}" in
            neo4j)
                backup_neo4j
                ;;
            minio)
                backup_minio
                ;;
            all)
                backup_all
                ;;
            *)
                print_error "Invalid backup target: ${2:-}"
                echo "Usage: $0 backup [neo4j|minio|all]"
                exit 1
                ;;
        esac
        ;;
    volumes)
        volumes_info
        ;;
    health)
        health_check
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Invalid command: ${1:-}"
        echo ""
        show_help
        exit 1
        ;;
esac
