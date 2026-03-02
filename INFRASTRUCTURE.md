# Ecom - Infrastructure & Data Persistence Guide

Complete technical documentation for Ecom's infrastructure setup, Docker configuration, and data persistence mechanisms.

---

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Docker Services](#docker-services)
- [Data Persistence Mechanism](#data-persistence-mechanism)
- [Volume Management](#volume-management)
- [Backup and Recovery](#backup-and-recovery)
- [Network Configuration](#network-configuration)
- [Service Management](#service-management)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

Ecom uses a **containerized microservices architecture** with three main components:

```
┌─────────────────────────────────────────────────────┐
│                   Ecom Stack                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │   Next.js    │  │    Neo4j     │  │  MinIO   │ │
│  │   (Node)     │  │   (Graph DB) │  │ (Storage)│ │
│  │              │  │              │  │          │ │
│  │  Port 3000   │  │  7474, 7687  │  │ 9000-1   │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
│         │                 │                 │      │
│         └─────────────────┴─────────────────┘      │
│                     Docker Bridge                  │
└─────────────────────────────────────────────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
   Host Process    Docker Volume      Docker Volume
   (npm run dev)   neo4j_data         minio_data
```

### Component Responsibilities

| Component | Purpose | Technology | Port(s) |
|-----------|---------|------------|---------|
| **Next.js** | Web application, API routes, SSR | Next.js 15, React 19, TypeScript | 3000 |
| **Neo4j** | Graph database for products, users, relationships | Neo4j 5.26 | 7474 (HTTP), 7687 (Bolt) |
| **MinIO** | S3-compatible object storage for images | MinIO Latest | 9000 (API), 9001 (Console) |

---

## Docker Services

### Service Definitions

All services are defined in `docker-compose.yml`:

#### Neo4j Database

```yaml
neo4j:
  image: neo4j:latest
  container_name: softx-ecommerce-neo4j
  ports:
    - "7474:7474"  # HTTP Browser Interface
    - "7687:7687"  # Bolt Protocol (Driver Connection)
  environment:
    - NEO4J_AUTH=neo4j/ecommerce123
  volumes:
    - neo4j_data:/data      # Database files
    - neo4j_logs:/logs      # Log files
  restart: unless-stopped
```

**Features:**
- Automatically restarts on system boot (unless manually stopped)
- Default credentials: `neo4j` / `ecommerce123`
- Persistent volumes for data and logs
- HTTP browser at http://localhost:7474
- Bolt driver connection at bolt://localhost:7687

#### MinIO Object Storage

```yaml
minio:
  image: minio/minio:latest
  container_name: softx-ecommerce-minio
  ports:
    - "9000:9000"  # S3 API
    - "9001:9001"  # Web Console
  environment:
    - MINIO_ROOT_USER=ecommerce
    - MINIO_ROOT_PASSWORD=ecommerce123
  volumes:
    - minio_data:/data
  command: server /data --console-address ":9001"
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 3
```

**Features:**
- S3-compatible API for programmatic access
- Web console for manual management
- Health checks for monitoring
- Persistent volume for object storage
- Credentials: `ecommerce` / `ecommerce123`

---

## Data Persistence Mechanism

### How Docker Volumes Work

**Named Volumes** are Docker's mechanism for persistent data storage:

```
┌───────────────────────────────────────────────────┐
│              Docker Host (Your Machine)           │
│                                                   │
│  ┌─────────────────┐        ┌─────────────────┐  │
│  │   Container     │        │   Host Volume   │  │
│  │   (Ephemeral)   │        │  (Persistent)   │  │
│  │                 │  Mount │                 │  │
│  │  /data ─────────┼───────→│  neo4j_data     │  │
│  │                 │        │                 │  │
│  └─────────────────┘        └─────────────────┘  │
│         ↓                            ↓            │
│  Can be deleted              Survives container  │
│  Can be recreated           deletion, restarts   │
│  Loses data on delete       system reboots       │
└───────────────────────────────────────────────────┘
```

### Volume Storage Locations

Docker stores volumes on your host filesystem:

```bash
# Neo4j data location
/var/lib/docker/volumes/softx-ecommerce_neo4j_data/_data

# Neo4j logs location
/var/lib/docker/volumes/softx-ecommerce_neo4j_logs/_data

# MinIO data location
/var/lib/docker/volumes/softx-ecommerce_minio_data/_data
```

### Data Survival Matrix

| Action | Container Survives? | Data Survives? | Explanation |
|--------|---------------------|----------------|-------------|
| `docker compose stop` | ✅ Yes (paused) | ✅ Yes | Container paused, volumes intact |
| `docker compose start` | ✅ Yes (resumed) | ✅ Yes | Container resumed, volumes reconnected |
| `docker compose restart` | ✅ Yes (recreated) | ✅ Yes | Stop + Start sequence |
| `docker restart <name>` | ✅ Yes (recreated) | ✅ Yes | Single container restart |
| `docker compose down` | ❌ No (deleted) | ✅ Yes | Containers deleted, volumes preserved |
| `docker compose up` | ✅ Yes (created) | ✅ Yes | New containers use existing volumes |
| System reboot | ❌ No (stopped) | ✅ Yes | Auto-restart on boot (`restart: unless-stopped`) |
| Container deletion | ❌ No (deleted) | ✅ Yes | Volume exists independently |
| `docker compose down -v` | ❌ No (deleted) | ❌ **NO** | **DANGEROUS**: Volumes deleted |
| `docker volume rm <vol>` | N/A | ❌ **NO** | **DANGEROUS**: Manual volume deletion |
| `docker volume prune` | N/A | ❌ **NO** | **DANGEROUS**: Deletes unused volumes |

### Key Takeaway

**Your data is safe** from:
- Container restarts
- Container recreation
- System reboots
- `docker compose down` (without `-v` flag)

**Your data is NOT safe** from:
- `docker compose down -v` (volume deletion flag)
- `docker volume rm` (manual deletion)
- `docker volume prune` (cleanup command)

---

## Volume Management

### Inspecting Volumes

```bash
# List all volumes
docker volume ls

# List Ecom volumes only
docker volume ls | grep softx-ecommerce

# Inspect volume details
docker volume inspect softx-ecommerce_neo4j_data

# View volume mount point on host
docker volume inspect softx-ecommerce_neo4j_data --format '{{ .Mountpoint }}'

# Check volume size
docker system df -v
```

### Volume Contents

```bash
# View Neo4j database files
docker exec softx-ecommerce-neo4j ls -lh /data/databases

# View MinIO buckets
docker exec softx-ecommerce-minio ls -lh /data

# Count files in volume
docker exec softx-ecommerce-neo4j find /data -type f | wc -l
```

### Creating Additional Volumes

If you need custom volumes, add to `docker-compose.yml`:

```yaml
volumes:
  neo4j_data:
  neo4j_logs:
  minio_data:
  custom_volume:    # New volume
```

---

## Backup and Recovery

### Automated Backup Scripts

#### Backup Neo4j Database

```bash
#!/bin/bash
# backup-neo4j.sh

BACKUP_DIR="./backups/neo4j"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="neo4j-backup-${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

docker run --rm \
  --volumes-from softx-ecommerce-neo4j \
  -v "$(pwd)/$BACKUP_DIR:/backup" \
  ubuntu tar czf "/backup/$BACKUP_FILE" /data

echo "✅ Neo4j backup created: $BACKUP_DIR/$BACKUP_FILE"
```

#### Backup MinIO Data

```bash
#!/bin/bash
# backup-minio.sh

BACKUP_DIR="./backups/minio"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="minio-backup-${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

docker run --rm \
  --volumes-from softx-ecommerce-minio \
  -v "$(pwd)/$BACKUP_DIR:/backup" \
  ubuntu tar czf "/backup/$BACKUP_FILE" /data

echo "✅ MinIO backup created: $BACKUP_DIR/$BACKUP_FILE"
```

### Restore from Backup

#### Restore Neo4j

```bash
#!/bin/bash
# restore-neo4j.sh

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore-neo4j.sh <backup-file.tar.gz>"
  exit 1
fi

# Stop Neo4j
docker compose stop neo4j

# Restore data
docker run --rm \
  --volumes-from softx-ecommerce-neo4j \
  -v "$(pwd)/backups/neo4j:/backup" \
  ubuntu bash -c "cd / && tar xzf /backup/$BACKUP_FILE"

# Start Neo4j
docker compose start neo4j

echo "✅ Neo4j restored from: $BACKUP_FILE"
```

### Export Neo4j Database (Alternative Method)

```bash
# Export to Cypher script
docker exec softx-ecommerce-neo4j cypher-shell -u neo4j -p ecommerce123 \
  "CALL apoc.export.cypher.all('backup.cypher', {format: 'cypher-shell'})"

# Copy export to host
docker cp softx-ecommerce-neo4j:/var/lib/neo4j/import/backup.cypher ./backups/
```

### MinIO Client (mc) Backup

```bash
# Install MinIO client
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc

# Configure alias
./mc alias set ecommerce http://localhost:9000 ecommerce ecommerce123

# Mirror bucket to local directory
./mc mirror ecommerce/product-images ./backups/product-images

# Restore from backup
./mc mirror ./backups/product-images ecommerce/product-images
```

---

## Network Configuration

### Docker Bridge Network

By default, Docker Compose creates a bridge network for all services:

```
Network: softx-ecommerce_default
Driver:  bridge
Subnet:  172.18.0.0/16 (example)

Services:
  - softx-ecommerce-neo4j   → 172.18.0.2
  - softx-ecommerce-minio   → 172.18.0.3
```

### Service Discovery

Containers can communicate using service names:

```javascript
// Next.js can connect to Neo4j using 'neo4j' as hostname
const driver = neo4j.driver('bolt://neo4j:7687', ...)

// Or using 'minio' for MinIO
const minioClient = new Minio.Client({
  endPoint: 'minio',
  port: 9000,
  ...
})
```

### Port Mapping

```
Container Port → Host Port

Neo4j:
  7474 → 7474 (HTTP Browser)
  7687 → 7687 (Bolt Protocol)

MinIO:
  9000 → 9000 (S3 API)
  9001 → 9001 (Web Console)
```

---

## Service Management

### Using setup.sh Script

The `setup.sh` script provides centralized service management:

```bash
# Start all services (with auto-detection and initialization)
./setup.sh start

# Stop all services (preserves data)
./setup.sh stop

# Restart all services
./setup.sh restart

# Check service status
./setup.sh status

# View logs
./setup.sh logs nextjs
./setup.sh logs neo4j
./setup.sh logs minio
```

### Manual Docker Commands

```bash
# Start services
docker compose up -d

# Stop services (keeps containers)
docker compose stop

# Stop and remove containers (keeps volumes)
docker compose down

# View logs
docker compose logs -f neo4j
docker compose logs -f minio

# Restart specific service
docker compose restart neo4j

# Execute command in container
docker exec -it softx-ecommerce-neo4j bash
docker exec -it softx-ecommerce-neo4j cypher-shell -u neo4j -p ecommerce123
```

### Service Health Checks

```bash
# Check if services are running
docker ps --filter "name=softx-ecommerce"

# Check Neo4j health
curl http://localhost:7474

# Check MinIO health
curl http://localhost:9000/minio/health/live

# Check port availability
nc -zv localhost 7687
nc -zv localhost 9000
nc -zv localhost 3000
```

---

## Troubleshooting

### Neo4j Issues

#### Cannot Connect to Database

**Symptoms:**
```
Neo4jError: Could not perform discovery. No routing servers available.
```

**Solutions:**
```bash
# 1. Check if container is running
docker ps | grep neo4j

# 2. Check logs for errors
docker logs softx-ecommerce-neo4j

# 3. Restart container
docker restart softx-ecommerce-neo4j

# 4. Wait for full initialization (can take 10-15 seconds)
sleep 10

# 5. Test connection
docker exec softx-ecommerce-neo4j cypher-shell -u neo4j -p ecommerce123 "RETURN 1"
```

#### Port Already in Use

**Symptoms:**
```
Error: bind: address already in use
```

**Solutions:**
```bash
# Find process using port 7687
lsof -i :7687

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "7475:7474"  # Use different host port
  - "7688:7687"
```

#### Database Corruption

**Symptoms:**
- Queries fail unexpectedly
- Container crashes on startup

**Solutions:**
```bash
# 1. Restore from backup (see Backup section)

# 2. If no backup, try repair
docker exec softx-ecommerce-neo4j neo4j-admin database check neo4j

# 3. Last resort: Clear and reinitialize
docker compose down
docker volume rm softx-ecommerce_neo4j_data
docker compose up -d
npm run db:init
npm run db:seed
```

### MinIO Issues

#### Cannot Access Console

**Symptoms:**
- http://localhost:9001 not loading

**Solutions:**
```bash
# 1. Check container status
docker ps | grep minio

# 2. Check logs
docker logs softx-ecommerce-minio

# 3. Verify healthcheck
docker inspect softx-ecommerce-minio | grep -A 10 Health

# 4. Restart service
docker restart softx-ecommerce-minio
```

#### Images Not Loading

**Symptoms:**
- Image URLs return 404
- Access denied errors

**Solutions:**
```bash
# 1. Check bucket exists
docker exec softx-ecommerce-minio ls /data

# 2. Verify bucket policy (should be public read)
# Access MinIO console and check bucket permissions

# 3. Re-initialize bucket
npm run minio:init

# 4. Check file exists
docker exec softx-ecommerce-minio ls /data/product-images
```

### Volume Issues

#### Volume Permission Denied

**Symptoms:**
```
Error: permission denied
```

**Solutions:**
```bash
# Fix ownership (Linux/Mac)
sudo chown -R $(whoami):$(whoami) /var/lib/docker/volumes/softx-ecommerce_*

# Or run containers with user permissions
docker compose down
# Add to docker-compose.yml:
# user: "${UID}:${GID}"
docker compose up -d
```

#### Volume Full (Disk Space)

**Symptoms:**
```
Error: no space left on device
```

**Solutions:**
```bash
# Check disk usage
docker system df -v

# Clean up unused images
docker image prune -a

# Clean up unused volumes (CAREFUL!)
docker volume prune

# Remove specific old backups
rm -rf ./backups/old-backups
```

### Next.js Issues

#### Port 3000 Already in Use

**Solutions:**
```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>

# Or use different port
npm run dev -- -p 3001
```

#### Database Connection Refused

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:7687
```

**Solutions:**
```bash
# 1. Ensure Neo4j is running
docker ps | grep neo4j

# 2. Check environment variables
cat .env.local | grep NEO4J

# 3. Test connection manually
docker exec softx-ecommerce-neo4j cypher-shell -u neo4j -p ecommerce123
```

---

## Performance Tuning

### Neo4j Memory Configuration

Add to `docker-compose.yml`:

```yaml
neo4j:
  environment:
    - NEO4J_AUTH=neo4j/ecommerce123
    - NEO4J_dbms_memory_heap_initial__size=512m
    - NEO4J_dbms_memory_heap_max__size=2G
    - NEO4J_dbms_memory_pagecache_size=1G
```

### MinIO Performance

```yaml
minio:
  environment:
    - MINIO_ROOT_USER=ecommerce
    - MINIO_ROOT_PASSWORD=ecommerce123
    - MINIO_BROWSER_REDIRECT_URL=http://localhost:9001
  deploy:
    resources:
      limits:
        memory: 1G
```

---

## Security Best Practices

### Production Considerations

**⚠️ WARNING:** Current configuration is for DEVELOPMENT ONLY

For production:

1. **Change default passwords**
   ```bash
   # Generate strong passwords
   openssl rand -base64 32
   ```

2. **Use secrets management**
   ```yaml
   # docker-compose.yml
   secrets:
     neo4j_password:
       file: ./secrets/neo4j_password.txt
   ```

3. **Enable HTTPS/TLS**
   - Neo4j: Configure SSL certificates
   - MinIO: Use reverse proxy (nginx/traefik)

4. **Restrict network access**
   ```yaml
   # Don't expose ports to 0.0.0.0
   ports:
     - "127.0.0.1:7687:7687"  # Localhost only
   ```

5. **Use firewall rules**
   ```bash
   # Allow only from application server
   ufw allow from 10.0.0.0/24 to any port 7687
   ```

---

## Monitoring and Logging

### Centralized Logging

```bash
# View all logs
docker compose logs -f

# Specific service
docker compose logs -f neo4j

# Last 100 lines
docker compose logs --tail=100 neo4j

# Since specific time
docker compose logs --since 2024-01-01T00:00:00 neo4j
```

### Health Monitoring Script

```bash
#!/bin/bash
# monitor-health.sh

echo "=== Ecom Health Check ==="
echo ""

# Neo4j
if nc -z localhost 7687 2>/dev/null; then
  echo "✅ Neo4j: Running"
else
  echo "❌ Neo4j: Down"
fi

# MinIO
if curl -f http://localhost:9000/minio/health/live 2>/dev/null; then
  echo "✅ MinIO: Running"
else
  echo "❌ MinIO: Down"
fi

# Next.js
if nc -z localhost 3000 2>/dev/null; then
  echo "✅ Next.js: Running"
else
  echo "❌ Next.js: Down"
fi

echo ""
docker stats --no-stream softx-ecommerce-neo4j softx-ecommerce-minio
```

---

## Related Documentation

- [README.md](./README.md) - Project overview and quick start
- [SETUP.md](./SETUP.md) - Detailed setup instructions
- [USER_LOGIN_GUIDE.md](./USER_LOGIN_GUIDE.md) - Login credentials and access
- [CLAUDE.md](./CLAUDE.md) - Developer guide for AI assistants

---

## Quick Reference Commands

```bash
# Service Management
./setup.sh start           # Start all services
./setup.sh stop            # Stop all services
./setup.sh restart         # Restart all services
./setup.sh status          # Check status
./setup.sh logs <service>  # View logs

# Volume Management
docker volume ls                                  # List volumes
docker volume inspect softx-ecommerce_neo4j_data  # Inspect volume
docker system df -v                              # Disk usage

# Database Operations
npm run db:init    # Initialize schema
npm run db:seed    # Seed test data
npm run db:clear   # Clear database

# Direct Access
docker exec -it softx-ecommerce-neo4j cypher-shell -u neo4j -p ecommerce123
docker exec -it softx-ecommerce-minio mc alias set local http://localhost:9000

# Backup
docker run --rm --volumes-from softx-ecommerce-neo4j -v $(pwd):/backup ubuntu tar czf /backup/neo4j.tar.gz /data
docker run --rm --volumes-from softx-ecommerce-minio -v $(pwd):/backup ubuntu tar czf /backup/minio.tar.gz /data
```
