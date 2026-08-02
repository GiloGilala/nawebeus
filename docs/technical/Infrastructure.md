# Infrastructure and Operations

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Engineering Lead & DevOps Lead

---

## 1. Executive Summary

This document defines the complete infrastructure architecture and operational procedures for the **Nawebeus** platform — a unified social media management and PR intelligence SaaS built for the Nigerian and African market. It consolidates deployment design, CI/CD pipelines, backup and disaster recovery procedures, scaling strategy, operational monitoring, access control, cost management, and operational runbooks.

**Infrastructure Philosophy:**

| Principle | Description |
|-----------|-------------|
| **Nigerian Data Sovereignty** | All Nigerian user data processed and stored within Nigeria — NDPR compliance by architecture |
| **Operational Simplicity** | Self-hosted with modern tooling; a small team can operate and understand the full stack |
| **Security First** | Defense in depth at every layer; WireGuard VPN; no public-facing management interfaces |
| **Cost Predictability** | Fixed monthly ₦ costs; no variable cloud billing surprises |
| **Reliability** | 99.9% uptime target with automated health monitoring and blue-green deployments |
| **Observability** | Structured logging, metrics, and alerting across every layer |

**Monthly Infrastructure Cost at Pilot Scale:** Approximately **₦94,000/month**

**Key Technologies:**
- Self-hosted VPS in Nigeria (Lagos or Abuja)
- Bun runtime + TanStack Start + Hono (single deployable service)
- PostgreSQL 14+ (primary database) + SQLite (cache + rate limiting)
- WireGuard VPN (secure access)
- Coolify (deployment management)
- Cloudflare (DDoS protection, CDN)
- Cloudflare R2 (file storage)

---

## 2. Infrastructure Architecture

### 2.1 Full Architecture Diagram

```
                              Internet
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   Cloudflare Edge        │
                    │   - DDoS Protection      │
                    │   - WAF                  │
                    │   - TLS Termination      │
                    │   - Static Asset CDN     │
                    │   - DNS                  │
                    └───────────┬─────────────┘
                                │ HTTPS
                                ▼
                    ┌─────────────────────────┐
                    │   WireGuard VPN          │
                    │   (Admin/Ops Access)     │
                    │   Public-key only        │
                    └───────────┬─────────────┘
                                │ WireGuard tunnel (UDP 51820)
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                     Self-Hosted VPS — Nigeria (Lagos/Abuja)           │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  UFW Firewall (allow 80, 443, 51820 only)                       │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Nginx (Reverse Proxy)                                           │  │
│  │  - SSL termination (Let's Encrypt)                              │  │
│  │  - Rate limiting (nginx limit_req)                              │  │
│  │  - Static file serving                                          │  │
│  │  - Health check endpoint                                        │  │
│  └──────────────────────┬──────────────────────────────────────────┘  │
│                         │                                              │
│                         ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Bun Application Process (systemd managed)                      │  │
│  │                                                                  │  │
│  │  ┌────────────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │  TanStack Start         │  │  Hono API                    │  │  │
│  │  │  (Web App + SSR)        │  │  (Mobile + Webhooks)         │  │  │
│  │  └───────────┬────────────┘  └──────────────┬───────────────┘  │  │
│  │              │                               │                   │  │
│  │              └───────────────┬───────────────┘                   │  │
│  │                              ▼                                   │  │
│  │  ┌─────────────────────────────────────────────────────────┐    │  │
│  │  │  Services Layer (Business Logic — Single Source of Truth)│    │  │
│  │  └─────────────────────┬───────────────────────────────────┘    │  │
│  │                        │                                         │  │
│  │           ┌────────────┴─────────────┐                          │  │
│  │           ▼                          ▼                          │  │
│  │  ┌──────────────────┐   ┌──────────────────────────────────┐   │  │
│  │  │  PostgreSQL 14+   │   │  SQLite (bun:sql)                │   │  │
│  │  │  (Drizzle ORM)    │   │  ├── cache.db                    │   │  │
│  │  │  Port: 5432       │   │  └── rate-limit.db               │   │  │
│  │  │  (localhost only) │   └──────────────────────────────────┘   │  │
│  │  └──────────────────┘                                           │  │
│  │                                                                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  External Services (accessed via HTTPS from application):            │
│  ├── Cloudflare R2       (file storage, CDN delivery)                │
│  ├── Backblaze B2        (encrypted backup storage)                  │
│  ├── Paystack            (₦ payment processing)                      │
│  ├── Sentry              (error tracking)                            │
│  └── Social Platform APIs (Twitter/X, Instagram, etc.)              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 2.2 Infrastructure Components

| Component | Technology | Hosting Location | Purpose |
|-----------|-----------|-----------------|---------|
| **Web App + API** | Bun + TanStack Start + Hono | Self-hosted VPS (Nigeria) | Single deployable service |
| **Primary Database** | PostgreSQL 14+ with Drizzle ORM | Self-hosted VPS (Nigeria) | Relational data, ACID compliance, RLS |
| **Cache Store** | SQLite via `bun:sql` | Self-hosted VPS (Nigeria, file on disk) | Query cache, session cache — MVP |
| **Rate Limit Store** | SQLite via `bun:sql` | Self-hosted VPS (Nigeria, file on disk) | Per-endpoint, per-user rate limits — MVP |
| **File Storage** | Cloudflare R2 + Bunny CDN | Cloudflare network (configurable region) | Post assets, press releases, report exports |
| **Backup Storage** | Backblaze B2 | Configurable region (encrypted) | Database backups, audit log archives |
| **Reverse Proxy** | Nginx | Self-hosted VPS (Nigeria) | SSL termination, static files, upstream health |
| **VPN** | WireGuard | Self-hosted VPS (Nigeria) | Secure admin access — no password, public-key only |
| **DDoS Protection** | Cloudflare | Cloudflare edge (global) | L3/L4/L7 DDoS protection, WAF |
| **Error Tracking** | Sentry | Sentry Cloud (EU region) | Application error monitoring, alerting |
| **Deployment Manager** | Coolify | Self-hosted VPS (Nigeria) | Blue-green deployment, environment management |
| **Email** | Nodemailer + AWS SES | AWS EU region | Transactional email (team invitations, crisis alerts) |
| **Payments** | Paystack | Paystack infrastructure (Nigeria) | ₦ subscription billing |

### 2.3 Key Infrastructure Decisions

| Decision | Choice | Rationale | ADR Reference |
|----------|--------|-----------|---------------|
| **Hosting** | Self-hosted VPS in Nigeria | NDPR data sovereignty; cost predictability; full control | ADR-008 |
| **Runtime** | Bun 1.0+ | Faster cold start; native TypeScript; built-in SQLite | ADR-001 |
| **Architecture** | Single deployable service | Operational simplicity for a small team | ADR-007 |
| **Cache / Rate Limit** | SQLite (MVP) → Redis (Year 2) | No external service at MVP; clear migration path | ADR-004 |
| **Database** | PostgreSQL 14+ | Relational integrity, RLS, full-text search, ACID | ADR-003 |
| **VPN** | WireGuard | Modern, audited, minimal attack surface, fast | ADR-008 |
| **Deployment** | Blue-green via Coolify | Zero-downtime; sub-60-second rollback | ADR-012 |
| **Backups** | AES-256 encrypted, off-site | NDPR compliance; disaster recovery | — |
| **Currency** | Nigerian Naira (₦) throughout | All Nigerian users; no FX complexity | ADR-011 |

---

## 3. Server Provisioning

### 3.1 Server Specifications by Phase

| Phase | Timeline | vCPU | RAM | Storage | Bandwidth | Est. Monthly Cost (₦) |
|-------|----------|------|-----|---------|-----------|----------------------|
| **Pilot** | 2026 Q3–Q4 | 4 | 8 GB | 200 GB SSD NVMe | 10 TB | ₦50,000 – ₦80,000 |
| **Phase 2** | 2027 H1 | 8 | 16 GB | 500 GB SSD NVMe | 20 TB | ₦80,000 – ₦150,000 |
| **Year 2** | 2027 H2 | 16 | 32 GB | 1 TB SSD NVMe | 40 TB | ₦150,000 – ₦300,000 |
| **Year 3+** | 2028+ | Multiple VPS | 2×32 GB | Distributed | 100+ TB | ₦400,000+ |

**Operating System:** Ubuntu 22.04 LTS (Jammy Jellyfish) — 5-year LTS support to 2027; extensive PostgreSQL and Nginx packaging.

**Hosting Provider Requirements:**
- Data center physically located in Nigeria (Lagos or Abuja)
- 99.9%+ SLA with financial penalties
- Support response within 4 hours
- Compliance with NDPR data residency requirements
- IPv4 and IPv6 support
- DDoS basic protection at network level

### 3.2 Initial Server Setup

```bash
#!/bin/bash
# Initial server provisioning script
# Run as root on a fresh Ubuntu 22.04 LTS server

set -euo pipefail

# ── System Updates ──────────────────────────────────────────────
echo "Updating system..."
apt update && apt upgrade -y
apt install -y \
  postgresql-14 \
  postgresql-client-14 \
  nginx \
  fail2ban \
  ufw \
  curl \
  git \
  gnupg2 \
  rclone \
  logrotate \
  htop \
  unattended-upgrades

# ── Install Bun Runtime ─────────────────────────────────────────
echo "Installing Bun..."
curl -fsSL https://bun.sh/install | bash
ln -sf ~/.bun/bin/bun /usr/local/bin/bun

# ── Enable Automatic Security Updates ──────────────────────────
echo "Configuring automatic security updates..."
dpkg-reconfigure --priority=low unattended-upgrades

# ── Create Application User ─────────────────────────────────────
echo "Creating nawebeus user..."
useradd -m -s /bin/bash -d /opt/nawebeus nawebeus
mkdir -p /opt/nawebeus/{app,config,scripts,logs,backups,data}
chown -R nawebeus:nawebeus /opt/nawebeus

# ── Configure UFW Firewall ──────────────────────────────────────
echo "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH (consider changing to non-standard port)
ufw allow 80/tcp        # HTTP (for Let's Encrypt validation)
ufw allow 443/tcp       # HTTPS
ufw allow 51820/udp     # WireGuard VPN
ufw --force enable

# ── Install WireGuard ───────────────────────────────────────────
echo "Installing WireGuard..."
apt install -y wireguard wireguard-tools
# Configuration added separately (see §3.3)

# ── Install Coolify ─────────────────────────────────────────────
echo "Installing Coolify..."
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

echo "Server provisioning complete. Configure WireGuard, PostgreSQL, and deploy the application."
```

### 3.3 WireGuard VPN Configuration

**Why WireGuard:** Minimal attack surface (only UDP 51820 exposed), public-key cryptography (no passwords to steal), 10-line auditable config, fastest VPN protocol available.

**Server Configuration (`/etc/wireguard/wg0.conf`):**

```ini
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = <server_private_key>

# Enable IP forwarding and NAT for tunnel traffic
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE; ip6tables -A FORWARD -i wg0 -j ACCEPT
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE; ip6tables -D FORWARD -i wg0 -j ACCEPT

# Engineering Lead
[Peer]
PublicKey = <engineering_lead_public_key>
AllowedIPs = 10.0.0.100/32

# DevOps Lead
[Peer]
PublicKey = <devops_lead_public_key>
AllowedIPs = 10.0.0.101/32

# Senior Engineer 1
[Peer]
PublicKey = <senior_engineer_1_public_key>
AllowedIPs = 10.0.0.102/32
```

**Client Configuration (per operator, `wg0.conf`):**

```ini
[Interface]
PrivateKey = <client_private_key>
Address = 10.0.0.100/24  # Unique per operator (100, 101, 102...)
DNS = 10.0.0.1

[Peer]
PublicKey = <server_public_key>
Endpoint = <server_public_ip>:51820
AllowedIPs = 10.0.0.0/24   # Only route VPN subnet through tunnel
PersistentKeepalive = 25
```

**WireGuard Management Commands:**

```bash
# Start VPN
sudo systemctl start wg-quick@wg0
sudo systemctl enable wg-quick@wg0

# Check status and connected peers
sudo wg show

# Add a new peer
sudo wg set wg0 peer <new_public_key> allowed-ips 10.0.0.103/32
wg-quick save wg0

# Remove a peer (e.g., departing employee)
sudo wg set wg0 peer <public_key> remove
wg-quick save wg0
```

### 3.4 PostgreSQL Configuration

**Key Settings (`/etc/postgresql/14/main/postgresql.conf`):**

```ini
# ── Connections ─────────────────────────────────────────────────
max_connections = 100             # PgBouncer handles connection pooling above this

# ── Memory (tuned for 8 GB RAM pilot server) ────────────────────
shared_buffers = 2GB              # 25% of RAM
effective_cache_size = 6GB        # 75% of RAM
work_mem = 64MB                   # Per-sort/hash operation
maintenance_work_mem = 512MB      # For VACUUM, ANALYZE, CREATE INDEX

# ── WAL (for point-in-time recovery) ────────────────────────────
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
max_wal_senders = 3
wal_keep_size = 1GB

# ── Query Tuning ─────────────────────────────────────────────────
random_page_cost = 1.1            # SSD optimized (vs 4.0 for HDD)
effective_io_concurrency = 200    # SSD optimized

# ── Slow Query Logging ───────────────────────────────────────────
log_min_duration_statement = 200  # Log queries slower than 200ms
log_connections = on
log_disconnections = on
log_line_prefix = '%t [%p]: db=%d,user=%u,app=%a,client=%h '
log_statement = 'ddl'             # Log all DDL statements

# ── SSL (required for all connections) ──────────────────────────
ssl = on
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file = '/etc/postgresql/ssl/server.key'

# ── Autovacuum ───────────────────────────────────────────────────
autovacuum = on
autovacuum_max_workers = 3
autovacuum_vacuum_scale_factor = 0.05   # More aggressive for high-write tables
autovacuum_analyze_scale_factor = 0.02
```

**Client Authentication (`/etc/postgresql/14/main/pg_hba.conf`):**

```
# Application connections (via VPN subnet only)
hostssl nawebeus nawebeus_app    10.0.0.0/24    scram-sha-256

# Backup user (read-only, replication)
hostssl replication nawebeus_backup 10.0.0.0/24 scram-sha-256

# Coolify/monitoring (via VPN only)
hostssl nawebeus nawebeus_readonly 10.0.0.0/24  scram-sha-256
```

**Database and User Setup:**

```sql
-- Application user (read/write, no DDL)
CREATE USER nawebeus_app WITH PASSWORD '<strong_random_password_here>';
GRANT CONNECT ON DATABASE nawebeus TO nawebeus_app;
GRANT USAGE ON SCHEMA public TO nawebeus_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nawebeus_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nawebeus_app;

-- Backup user (replication only)
CREATE USER nawebeus_backup WITH REPLICATION PASSWORD '<strong_random_password>';

-- Read-only user (for analytics queries and monitoring)
CREATE USER nawebeus_readonly WITH PASSWORD '<strong_random_password>';
GRANT CONNECT ON DATABASE nawebeus TO nawebeus_readonly;
GRANT USAGE ON SCHEMA public TO nawebeus_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO nawebeus_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO nawebeus_readonly;
```

### 3.5 Nginx Configuration

```nginx
# /etc/nginx/sites-available/nawebeus

upstream nawebeus_app {
    server 127.0.0.1:3000;  # Bun application (active: blue or green)
    keepalive 32;
}

server {
    listen 80;
    server_name nawebeus.com www.nawebeus.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nawebeus.com www.nawebeus.com;

    # SSL (Let's Encrypt via Certbot)
    ssl_certificate /etc/letsencrypt/live/nawebeus.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nawebeus.com/privkey.pem;
    ssl_protocols TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Request size limits
    client_max_body_size 100m;  # For media uploads
    client_body_timeout 60s;

    # Nginx-level rate limiting (additional to application rate limiting)
    limit_req zone=api burst=20 nodelay;
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Compression
    gzip on;
    gzip_types text/html application/json application/javascript text/css;
    gzip_min_length 1000;

    # Proxy to application
    location / {
        proxy_pass http://nawebeus_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";  # For WebSockets
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }

    # Static file serving (bypass application)
    location /_static/ {
        alias /opt/nawebeus/app/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://nawebeus_app;
        limit_req off;
    }
}
```

### 3.6 Systemd Service Configuration

**Main Application Service (`/etc/systemd/system/nawebeus.service`):**

```ini
[Unit]
Description=Nawebeus Application (Active)
Documentation=https://docs.nawebeus.com/infrastructure
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=nawebeus
Group=nawebeus
WorkingDirectory=/opt/nawebeus/app
Environment=NODE_ENV=production
EnvironmentFile=/opt/nawebeus/config/.env

# Bun start command
ExecStart=/usr/local/bin/bun run start
ExecReload=/bin/kill -HUP $MAINPID

# Restart policy
Restart=on-failure
RestartSec=10
StartLimitIntervalSec=60
StartLimitBurst=3

# Output
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nawebeus

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/nawebeus/app /opt/nawebeus/logs /opt/nawebeus/data
ProtectKernelTunables=true
ProtectControlGroups=true

# Resource limits
LimitNOFILE=65536    # Open file descriptor limit
LimitNPROC=4096      # Process limit

[Install]
WantedBy=multi-user.target
```

**Blue/Green Variants:**

The blue-green deployment uses two service instances on different ports:

```bash
# Blue — port 3000 (usually active)
cp /etc/systemd/system/nawebeus.service /etc/systemd/system/nawebeus-blue.service
sed -i 's/PORT=3000/PORT=3000/' /etc/systemd/system/nawebeus-blue.service

# Green — port 3001 (staging/pre-swap)
cp /etc/systemd/system/nawebeus.service /etc/systemd/system/nawebeus-green.service
sed -i 's/PORT=3000/PORT=3001/' /etc/systemd/system/nawebeus-green.service
```

---

## 4. Deployment Process

### 4.1 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  TZ: Africa/Lagos  # WAT timezone for all CI jobs
  DEFAULT_CURRENCY: NGN

jobs:
  # ── Stage 1: Code Quality (~3 minutes) ─────────────────────────
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with: { bun-version: '1.x' }
      - run: bun install --frozen-lockfile
      - run: bun run typecheck      # TypeScript
      - run: bun run lint           # ESLint (import boundaries, no-any)
      - run: bun run format:check   # Prettier
      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main

  # ── Stage 2: Tests (~10 minutes) ───────────────────────────────
  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: postgres:14-alpine
        env:
          POSTGRES_DB: nawebeus_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - name: Run database migrations
        run: bun run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/nawebeus_test
      - name: Run unit + integration tests
        run: bun test --coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/nawebeus_test
          TZ: Africa/Lagos
      - name: Enforce coverage thresholds
        run: bun test --coverage --coverage-threshold='{"services":85,"lib":90}'

  # ── Stage 3: Security (~5 minutes) ─────────────────────────────
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - name: Dependency vulnerability scan
        run: bun audit    # Fails on HIGH or CRITICAL CVEs
      - name: Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with: { args: --severity-threshold=high }

  # ── Stage 4: Build (~5 minutes) ────────────────────────────────
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun run build
      - name: Build Docker image
        run: docker build -t nawebeus:${{ github.sha }} .
      - name: Scan Docker image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: nawebeus:${{ github.sha }}
          severity: HIGH,CRITICAL
          exit-code: '1'

  # ── Stage 5: Deploy to Staging ──────────────────────────────────
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    environment: staging
    steps:
      - name: Deploy via Coolify API
        run: |
          curl -X POST "${{ secrets.COOLIFY_STAGING_WEBHOOK_URL }}" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"sha": "${{ github.sha }}"}'
      - name: Wait for staging health
        run: |
          sleep 30
          curl -fsS ${{ secrets.STAGING_URL }}/health

  # ── Stage 6: E2E Tests on Staging ───────────────────────────────
  e2e-staging:
    name: E2E Tests (Staging)
    runs-on: ubuntu-latest
    needs: deploy-staging
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun x playwright install --with-deps chromium
      - name: Run E2E tests against staging
        run: bun x playwright test
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
          TZ: Africa/Lagos

  # ── Stage 7: Deploy to Production (manual approval) ─────────────
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: e2e-staging
    environment: production  # Requires manual approval in GitHub
    steps:
      - name: Deploy via Coolify (blue-green)
        run: |
          curl -X POST "${{ secrets.COOLIFY_PRODUCTION_WEBHOOK_URL }}" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}"
      - name: Production health check
        run: |
          sleep 30
          curl -fsS https://nawebeus.com/health
      - name: Monitor for 10 minutes post-deploy
        run: sleep 600  # Monitor period; real monitoring via Grafana
```

### 4.2 Blue-Green Deployment Process

```
New code merged to main
        │
        ▼
CI pipeline runs (quality, tests, security, build)
        │
        ▼
Artifact deployed to staging (automatic)
        │
        ▼
E2E tests run against staging
        │
        ▼
Manual approval by Engineering Lead
        │
        ▼
Deploy new version to GREEN environment (port 3001)
        │
        ▼
Database migrations run (backward-compatible)
        │
        ▼
Health checks pass on GREEN (GET /health → 200 OK)
        │
        ▼
Nginx upstream switched from BLUE → GREEN (atomic, zero-downtime)
        │
        ▼
Monitor error rates and P95 latency for 30 minutes
        │
   ┌────┴────┐
   │         │
   ↓         ↓
Clean?    Issues?
   │         │
   ▼         ▼
Decommission  Switch back to BLUE
BLUE          (rollback in <60 seconds)
```

### 4.3 Deployment Scripts

**Production Deploy Script (`/opt/nawebeus/scripts/deploy-production.sh`):**

```bash
#!/bin/bash
# Blue-green production deployment script
# Usage: ./deploy-production.sh <git_sha>

set -euo pipefail

SHA="${1:-$(git rev-parse HEAD)}"
ACTIVE_PORT=$(systemctl is-active nawebeus-blue >/dev/null 2>&1 && echo "blue" || echo "green")
INACTIVE_PORT=$([ "$ACTIVE_PORT" = "blue" ] && echo "green" || echo "blue")

echo "==> Deploying SHA: $SHA"
echo "==> Active: $ACTIVE_PORT | Deploying to: $INACTIVE_PORT"

# ── Deploy to inactive environment ──────────────────────────────
echo "==> Deploying to $INACTIVE_PORT environment..."
cd /opt/nawebeus-$INACTIVE_PORT
git fetch origin
git checkout $SHA
bun install --production --frozen-lockfile

# ── Run database migrations ──────────────────────────────────────
echo "==> Running database migrations..."
bun run db:migrate
echo "==> Migrations complete."

# ── Build ────────────────────────────────────────────────────────
echo "==> Building..."
bun run build

# ── Start the inactive environment ──────────────────────────────
echo "==> Starting $INACTIVE_PORT..."
sudo systemctl restart nawebeus-$INACTIVE_PORT

# ── Health check ─────────────────────────────────────────────────
echo "==> Waiting for health check..."
INACTIVE_APP_PORT=$([ "$INACTIVE_PORT" = "blue" ] && echo "3000" || echo "3001")
for i in {1..30}; do
  if curl -fsS "http://localhost:$INACTIVE_APP_PORT/health" > /dev/null 2>&1; then
    echo "==> Health check passed."
    break
  fi
  if [ $i -eq 30 ]; then
    echo "✗ Health check failed after 30 attempts. Aborting deployment."
    sudo systemctl stop nawebeus-$INACTIVE_PORT
    exit 1
  fi
  sleep 2
done

# ── Swap Nginx upstream ──────────────────────────────────────────
echo "==> Switching traffic to $INACTIVE_PORT..."
sudo ln -sf /etc/nginx/sites-available/nawebeus-$INACTIVE_PORT \
            /etc/nginx/sites-enabled/nawebeus
sudo nginx -t  # Validate config before reload
sudo systemctl reload nginx

echo "✓ Deployment complete. $INACTIVE_PORT is now serving production traffic."
echo "==> Monitor error rates for 30 minutes before decommissioning $ACTIVE_PORT."
echo "==> To rollback: sudo ln -sf /etc/nginx/sites-available/nawebeus-$ACTIVE_PORT /etc/nginx/sites-enabled/nawebeus && sudo systemctl reload nginx"
```

**Rollback Script (`/opt/nawebeus/scripts/rollback.sh`):**

```bash
#!/bin/bash
# Emergency rollback — switches traffic back to previous environment

set -euo pipefail

CURRENT=$(readlink /etc/nginx/sites-enabled/nawebeus | grep -o 'blue\|green')
PREVIOUS=$([ "$CURRENT" = "blue" ] && echo "green" || echo "blue")

echo "==> ROLLBACK: Switching from $CURRENT back to $PREVIOUS"

sudo ln -sf /etc/nginx/sites-available/nawebeus-$PREVIOUS \
            /etc/nginx/sites-enabled/nawebeus
sudo nginx -t
sudo systemctl reload nginx

echo "✓ Rollback complete. Verify: curl -fsS https://nawebeus.com/health"
```

### 4.4 Deployment Approval Matrix

| Deployment Type | Approval Required | Approver |
|----------------|-------------------|---------|
| Staging (automatic) | None | Automated |
| Production (standard) | Manual approval | Engineering Lead |
| Production (hotfix) | Manual approval | Engineering Lead + Project Sponsor |
| Database migrations (dangerous) | 2-person review | Engineering Lead + second engineer |
| Rollback | Engineering Lead decision | Engineering Lead (any time) |

---

## 5. Backup and Disaster Recovery

### 5.1 Backup Strategy

| Backup Type | Frequency | Retention | Storage | Encryption |
|-------------|-----------|-----------|---------|-----------|
| **Full PostgreSQL backup** | Daily at 02:00 WAT | 30 days | Backblaze B2 (off-site) | AES-256 (GPG) |
| **PostgreSQL WAL archiving** | Every 5 minutes (continuous) | 7 days | Backblaze B2 (off-site) | AES-256 |
| **SQLite cache backup** | Daily at 03:00 WAT | 7 days | Backblaze B2 (off-site) | AES-256 |
| **Application configuration** | On every code change | Indefinite | Git repository (git-crypt) | AES-256 |
| **Secrets** | On every rotation | Indefinite | Password manager (1Password) | 1Password encryption |
| **Audit log archive** | Daily at 05:00 WAT | 7 years | Backblaze B2 (cold tier) | AES-256 |
| **Cloudflare R2 files** | Continuous (R2 cross-region) | 30 days (versioning) | Cloudflare network | AES-256 |

### 5.2 Automated Backup Script

```bash
#!/bin/bash
# /opt/nawebeus/scripts/backup.sh
# Runs nightly via cron at 02:00 WAT (01:00 UTC)
# Logs to /var/log/nawebeus-backup.log

set -euo pipefail

BACKUP_DIR=/opt/nawebeus/backups/daily
DATE=$(date +%Y%m%d_%H%M%S)
WAT_DATE=$(TZ='Africa/Lagos' date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
PASSPHRASE_FILE=/root/.backup-passphrase
LOG_FILE=/var/log/nawebeus-backup.log
REMOTE="remote:backblaze-nawebeus"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1" | tee -a "$LOG_FILE"; }

log "=== Backup started (WAT: $WAT_DATE) ==="

mkdir -p "$BACKUP_DIR"

# ── PostgreSQL Full Backup ───────────────────────────────────────
log "Starting PostgreSQL backup..."
pg_dump -U nawebeus_backup -h localhost -Fc nawebeus \
  > "$BACKUP_DIR/nawebeus-$DATE.dump"
log "PostgreSQL backup complete: $(du -sh "$BACKUP_DIR/nawebeus-$DATE.dump" | cut -f1)"

# ── SQLite Cache Backup ──────────────────────────────────────────
log "Starting SQLite backup..."
cp /opt/nawebeus/data/cache.db "$BACKUP_DIR/cache-$DATE.db"
cp /opt/nawebeus/data/rate-limit.db "$BACKUP_DIR/rate-limit-$DATE.db"
log "SQLite backup complete."

# ── Encrypt Backups ──────────────────────────────────────────────
log "Encrypting backups..."
for file in "$BACKUP_DIR/nawebeus-$DATE.dump" "$BACKUP_DIR/cache-$DATE.db"; do
  gpg --batch --yes --symmetric --cipher-algo AES256 \
      --passphrase-file "$PASSPHRASE_FILE" "$file"
  rm "$file"  # Remove unencrypted version
done
log "Encryption complete."

# ── Upload to Off-Site Storage ───────────────────────────────────
log "Uploading to Backblaze B2..."
rclone copy "$BACKUP_DIR/" "$REMOTE/daily/" \
  --include "*-$DATE*" \
  --progress \
  --transfers 4

# ── Verify Upload ────────────────────────────────────────────────
log "Verifying upload..."
REMOTE_SIZE=$(rclone size "$REMOTE/daily/nawebeus-$DATE.dump.gpg" --json | jq .bytes)
LOCAL_SIZE=$(stat -c%s "$BACKUP_DIR/nawebeus-$DATE.dump.gpg")
if [ "$REMOTE_SIZE" != "$LOCAL_SIZE" ]; then
  log "ERROR: Remote file size ($REMOTE_SIZE) does not match local ($LOCAL_SIZE)"
  exit 1
fi
log "Upload verified: $REMOTE_SIZE bytes"

# ── Cleanup Old Local Backups ────────────────────────────────────
log "Cleaning up old local backups..."
find "$BACKUP_DIR" -name "*.dump.gpg" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "*.db.gpg"   -mtime +7 -delete
log "Cleanup complete."

# ── Send Success Notification ────────────────────────────────────
log "=== Backup completed successfully ==="

# Notify Sentry heartbeat (confirms backup ran)
curl -fsS "$SENTRY_CRON_MONITOR_URL?status=ok" > /dev/null 2>&1 || true
```

**Cron Schedule:**
```cron
# /etc/cron.d/nawebeus-backup
# Run at 02:00 WAT (01:00 UTC) daily
0 1 * * * nawebeus /opt/nawebeus/scripts/backup.sh >> /var/log/nawebeus-backup.log 2>&1
```

### 5.3 Recovery Objectives

| Component | RPO (Maximum Data Loss) | RTO (Maximum Downtime) |
|-----------|------------------------|------------------------|
| **PostgreSQL** | 5 minutes (WAL archiving every 5 min) | 30 minutes |
| **SQLite cache** | 24 hours (acceptable — cache rebuilds automatically) | 5 minutes (restart + rebuild) |
| **Cloudflare R2 files** | 0 (continuous cross-region replication) | 15 minutes |
| **Application code** | 0 (versioned in Git) | 5 minutes |
| **Secrets** | 0 (stored in password manager) | 10 minutes |
| **Audit logs** | 24 hours (daily archive) | 1 hour |
| **Complete VPS loss** | 5 minutes (database) | 2 hours (full recovery) |

### 5.4 Recovery Procedures

#### 5.4.1 PostgreSQL Database Recovery

```bash
#!/bin/bash
# /opt/nawebeus/scripts/restore-database.sh
# Usage: ./restore-database.sh 20260721_020000
# Run ONLY with Engineering Lead supervision

set -euo pipefail

BACKUP_DATE="${1:-$(date +%Y%m%d)}"
PASSPHRASE_FILE=/root/.backup-passphrase
REMOTE="remote:backblaze-nawebeus"
RESTORE_FILE="/tmp/nawebeus-restore-$BACKUP_DATE.dump"

echo "==> CAUTION: This will DROP and restore the nawebeus database."
echo "==> Backup date: $BACKUP_DATE"
read -p "Type 'RESTORE' to confirm: " CONFIRM
[ "$CONFIRM" != "RESTORE" ] && { echo "Aborted."; exit 1; }

# Stop the application
echo "==> Stopping application..."
sudo systemctl stop nawebeus-blue nawebeus-green

# Download backup
echo "==> Downloading backup from Backblaze B2..."
rclone copy "$REMOTE/daily/nawebeus-$BACKUP_DATE.dump.gpg" /tmp/

# Decrypt
echo "==> Decrypting backup..."
gpg --batch --yes --passphrase-file "$PASSPHRASE_FILE" \
    --output "$RESTORE_FILE" \
    /tmp/nawebeus-$BACKUP_DATE.dump.gpg

# Drop and recreate database
echo "==> Dropping existing database..."
sudo -u postgres dropdb nawebeus --if-exists
sudo -u postgres createdb nawebeus -O nawebeus_app

# Restore
echo "==> Restoring database..."
pg_restore -U nawebeus_app -h localhost -d nawebeus \
    --no-owner --no-privileges "$RESTORE_FILE"

# Verify
echo "==> Verifying restoration..."
psql -U nawebeus_readonly -d nawebeus -c "\dt" -c "SELECT count(*) FROM users;"

# Cleanup
rm -f "$RESTORE_FILE" /tmp/nawebeus-$BACKUP_DATE.dump.gpg

# Restart application
echo "==> Starting application..."
sudo systemctl start nawebeus-green
sleep 10
curl -fsS https://nawebeus.com/health || { echo "Health check failed!"; exit 1; }

echo "✓ Database restoration complete."
```

#### 5.4.2 Cache Recovery

```bash
# SQLite cache is best-effort — losing it is safe; it rebuilds automatically
sudo systemctl stop nawebeus-blue
rm -f /opt/nawebeus/data/cache.db /opt/nawebeus/data/rate-limit.db
# Optionally restore from backup:
# gpg --decrypt /opt/nawebeus/backups/daily/cache-20260721.db.gpg > /opt/nawebeus/data/cache.db
sudo systemctl start nawebeus-blue
curl -fsS https://nawebeus.com/health
```

#### 5.4.3 Complete Server Loss Recovery

```bash
# 1. Provision a new VPS using the server provisioning script (§3.2)
# 2. Configure WireGuard (§3.3), PostgreSQL (§3.4), Nginx (§3.5)
# 3. Restore the database (§5.4.1) — use the latest backup
# 4. Clone the application repository and deploy
# 5. Update the environment variables from the password manager
# 6. Update DNS to point to the new server IP
# 7. Verify: curl -fsS https://nawebeus.com/health
# 8. Notify the team; update the incident channel
# Target: complete restoration within 2 hours of declaring server loss
```

### 5.5 Monthly Backup Testing

Backups are tested on the **first Sunday of every month**:

```bash
#!/bin/bash
# /opt/nawebeus/scripts/test-backup.sh
# Run monthly to verify backup integrity and recoverability

# 1. Download the latest backup
rclone copy remote:backblaze-nawebeus/daily/ /tmp/backup-test/ \
  --include "nawebeus-$(date +%Y%m%d)*.gpg" --max-age 48h

# 2. Decrypt
gpg --batch --passphrase-file /root/.backup-passphrase \
    --output /tmp/backup-test/nawebeus-test.dump \
    /tmp/backup-test/nawebeus-$(date +%Y%m%d)*.dump.gpg

# 3. Restore to a test database
createdb -U postgres nawebeus_test_restore
pg_restore -U postgres -d nawebeus_test_restore /tmp/backup-test/nawebeus-test.dump

# 4. Verify data integrity
EXPECTED_USERS=$(psql -U nawebeus_readonly -d nawebeus -tAc "SELECT count(*) FROM users")
RESTORED_USERS=$(psql -U postgres -d nawebeus_test_restore -tAc "SELECT count(*) FROM users")
[ "$EXPECTED_USERS" = "$RESTORED_USERS" ] && echo "✓ User count matches: $EXPECTED_USERS"

# 5. Cleanup
dropdb -U postgres nawebeus_test_restore
rm -rf /tmp/backup-test/

echo "✓ Backup test complete. Documenting result in the runbook."
```

---

## 6. Monitoring and Observability

### 6.1 Health Check Endpoint

**GET /health** — called every 30 seconds by Nginx upstream monitoring and external uptime monitors.

**Response (200 OK — healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2026-07-21T10:30:00.000Z",
  "uptime": 432000,
  "checks": {
    "database": { "status": "healthy", "latencyMs": 2 },
    "cache": { "status": "healthy", "hitRate": 0.87 },
    "rateLimit": { "status": "healthy" },
    "storage": { "status": "healthy" },
    "paystack": { "status": "healthy" },
    "email": { "status": "healthy" }
  }
}
```

**Response (503 Service Unavailable — unhealthy):**
```json
{
  "status": "unhealthy",
  "timestamp": "2026-07-21T10:30:00.000Z",
  "checks": {
    "database": { "status": "unhealthy", "error": "connection refused" },
    "cache": { "status": "healthy" }
  }
}
```

### 6.2 Monitoring Stack

| Tool | Purpose | Access |
|------|---------|--------|
| **Prometheus** | Metrics collection | Via WireGuard VPN only |
| **Grafana** | Dashboards and alerting | Via WireGuard VPN only |
| **Loki** | Log aggregation | Via WireGuard VPN only |
| **Sentry** | Application error tracking | Sentry Cloud (web UI) |
| **Cloudflare Analytics** | Edge traffic, DDoS, CDN | Cloudflare dashboard |
| **Uptime monitoring** | External uptime checks | Public (Better Uptime or UptimeRobot) |

### 6.3 Key Metrics Dashboard

**Application Metrics:**

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| API P95 response time | <500ms | >1s for 5 minutes |
| API error rate | <1% | >5% |
| WebSocket connections | <1000 (pilot) | >5000 |
| Active crisis alert delivery latency | <2 minutes | >5 minutes |

**Database Metrics:**

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Query P95 | <200ms | >500ms |
| Connection pool utilization | <70% | >85% |
| Slow queries (>200ms) | <10/hour | >50/hour |
| Database size | — | >80% of disk |
| WAL archive lag | <5 minutes | >15 minutes |

**Infrastructure Metrics:**

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| CPU utilization | <60% average | >85% sustained for 10 min |
| Memory utilization | <70% | >90% |
| Disk utilization | <70% | >85% |
| Network I/O | <5 TB/month | >9 TB/month |

**Business Metrics (tracked in Grafana):**

| Metric | Tracked |
|--------|---------|
| Daily Active Users (DAU) | ✅ |
| Monthly Active Users (MAU) | ✅ |
| Media mentions processed | ✅ |
| Posts published | ✅ |
| Crisis incidents detected | ✅ |
| Active subscriptions (₦ MRR) | ✅ |
| Paystack ₦ payment success rate | ✅ |

### 6.4 Alerting Rules

```yaml
# /etc/prometheus/alert.rules.yml (excerpt)
groups:
  - name: nawebeus.critical
    rules:
      - alert: ServiceDown
        expr: up{job="nawebeus"} == 0
        for: 1m
        labels:
          severity: P0
        annotations:
          summary: "Nawebeus application is DOWN"
          description: "The application has been unreachable for more than 1 minute."

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) /
              rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: P1
        annotations:
          summary: "High error rate (>5%)"

      - alert: DatabaseDown
        expr: pg_up == 0
        for: 1m
        labels:
          severity: P0
        annotations:
          summary: "PostgreSQL database is DOWN"

      - alert: BackupFailed
        expr: time() - backup_last_success_timestamp > 86400  # 24 hours
        labels:
          severity: P1
        annotations:
          summary: "Backup has not run in 24 hours"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.20
        labels:
          severity: P2
        annotations:
          summary: "Disk space below 20% remaining"

      - alert: PaystackWebhookFailures
        expr: paystack_webhook_failures_total > 0
        labels:
          severity: P1
        annotations:
          summary: "Paystack ₦ webhook failures detected"

      - alert: CrisisAlertLatencyHigh
        expr: crisis_alert_delivery_seconds_p95 > 120  # 2 minutes
        labels:
          severity: P1
        annotations:
          summary: "Crisis alert delivery latency exceeds 2 minutes"
```

**Alert Notification Channels:**

| Severity | Channels | Response Time |
|----------|---------|--------------|
| **P0** | PagerDuty (immediate), Slack #incidents | Immediate — engineer paged |
| **P1** | Slack #engineering-alerts, Email | <1 hour |
| **P2** | Slack #engineering-alerts | <4 hours |
| **P3** | Grafana only (review at next standup) | Next business day |

### 6.5 Structured Logging

All application logs are structured JSON, shipped to Loki for aggregation and querying.

**Log format:**
```json
{
  "level": "info",
  "timestamp": "2026-07-21T10:30:00.000Z",
  "message": "Crisis alert delivered",
  "requestId": "req_abc123def456",
  "userId": "usr_9f2a4b6c",
  "organizationId": "org_7e3b2c1d",
  "incidentId": "inc_4d5e6f7a",
  "severity": "s4_escalate",
  "deliveryChannels": ["push", "email", "in_app"],
  "durationMs": 143
}
```

**Log rotation:**
```bash
# /etc/logrotate.d/nawebeus
/var/log/nawebeus/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 nawebeus nawebeus
    sharedscripts
    postrotate
        systemctl reload nawebeus-blue || true
        systemctl reload nawebeus-green || true
    endscript
}
```

**What is NEVER logged:**
- Passwords or password hashes
- JWT tokens or refresh tokens
- Paystack API keys or webhook secrets
- Social platform OAuth tokens
- MFA secrets or TOTP codes
- User PII (email, phone) at INFO level or above in production

---

## 7. Scaling Strategy

### 7.1 Scaling Phases and Triggers

| Phase | Timeline | Scale | Infrastructure | Trigger |
|-------|----------|-------|---------------|---------|
| **Pilot** | 2026 Q3–Q4 | 50–300 orgs, 5,000 MAU | 4 vCPU / 8 GB / 200 GB | — (launch baseline) |
| **Phase 2** | 2027 H1 | 300–2,000 orgs, 30,000 MAU | 8 vCPU / 16 GB / 500 GB | CPU >70% sustained or MAU >5,000 |
| **Year 2** | 2027 H2 | 2,000–7,000 orgs, 100,000 MAU | 16 vCPU / 32 GB / 1 TB | CPU >70% sustained or MAU >30,000 |
| **Year 3+** | 2028+ | 7,000–25,000 orgs, 500,000 MAU | Multi-VPS + Redis + Read Replicas | Single VPS capacity saturated |

### 7.2 Scaling Decision Triggers

| Metric | Scaling Trigger | Action |
|--------|----------------|--------|
| CPU >70% for 10+ minutes | Vertical scale required | Upgrade VPS tier |
| Memory >85% | Vertical scale required | Upgrade VPS tier |
| PostgreSQL connections >80% | Add PgBouncer or upgrade | Configure connection pooling |
| Cache hit rate <70% consistently | Cache strategy review | Tune TTLs; consider Redis |
| API P95 >500ms consistently | Performance investigation | Profile; optimize; scale |
| Single VPS saturated | Horizontal scaling required | See §7.3 |

### 7.3 Horizontal Scaling Architecture (Year 3+)

```
                    Cloudflare (DDoS + CDN)
                            │
                    Load Balancer (Nginx)
                   /         │          \
                  /          │           \
        VPS 1 (Bun)    VPS 2 (Bun)   VPS 3 (Bun)
                  \          │           /
                   \         │          /
           Redis Cluster (shared cache + rate limiting)
                            │
              ┌─────────────┴────────────┐
              │                          │
     PostgreSQL Primary           PostgreSQL Read Replica
     (writes)                     (analytics reads)
```

**Changes required for horizontal scaling:**

| Component | MVP | Horizontal Scale |
|-----------|-----|-----------------|
| **Cache** | SQLite (per-VPS file) | Redis 7+ Cluster (shared) |
| **Rate limiting** | SQLite (per-VPS file) | Redis 7+ Cluster (shared state) |
| **Sessions** | JWT (stateless — no change) | JWT (stateless — no change required) |
| **PostgreSQL** | Single instance | Primary + read replica + PgBouncer |
| **File storage** | Cloudflare R2 (no change) | Cloudflare R2 (no change) |
| **Secrets** | Shared `.env` | Centralized secret management (Vault) |

---

## 8. Access Control

### 8.1 Server Access Matrix

| Role | VPS Access | Database Access | Coolify Access | Grafana Access |
|------|-----------|-----------------|----------------|----------------|
| **Engineering Lead** | Full root via WireGuard + SSH | Full (all users) | Admin | Admin |
| **DevOps Lead** | Full root via WireGuard + SSH | Full (all users) | Admin | Admin |
| **Senior Engineer** | Limited (deploy, restart, logs) | Read-only | Deploy only | Read |
| **On-Call Engineer** | Limited (deploy, restart, logs) | Read-only | Deploy only | Read |
| **Security Lead** | Read-only (audit logs only) | Read-only | None | Read |
| **External Auditor** | Read-only (time-limited, escorted) | Read-only | None | Read |

### 8.2 SSH Key Management

```bash
# /home/nawebeus/.ssh/authorized_keys
# Each line: one engineer's public key with a comment
ssh-ed25519 AAAA... ade.ogunleye@firstbank.com.ng engineering-lead-2026
ssh-ed25519 AAAA... devops-lead@nawebeus.com devops-lead-2026
ssh-ed25519 AAAA... senior-eng-1@nawebeus.com senior-engineer-1-2026
```

**Key rotation procedure:**
1. Generate new key pair on engineer's machine
2. Engineering Lead adds new public key to `authorized_keys` via WireGuard + SSH
3. Engineer verifies access with new key
4. Old key removed from `authorized_keys`
5. Rotation logged in the access control log

### 8.3 Secret and Key Rotation Schedule

| Secret Type | Rotation Frequency | Who Rotates | How |
|-------------|-------------------|-------------|-----|
| SSH keys | Annually (or on departure) | Engineering Lead | New key pair + `authorized_keys` update |
| WireGuard keys | Annually (or on departure) | Engineering Lead | New key pair + `wg0.conf` update |
| JWT signing secret | Annually (or on compromise) | Engineering Lead | Update `.env`; all sessions invalidated |
| Database passwords | Annually | Engineering Lead | `ALTER USER` + `.env` update |
| Paystack API key | Per Paystack security guidelines | Engineering Lead | Paystack dashboard + `.env` update |
| Paystack webhook secret | Annually | Engineering Lead | Paystack dashboard + `.env` update |
| Backup passphrase | Annually | Engineering Lead | New passphrase; re-encrypt latest backup |
| API keys (internal) | Annually | Engineering Lead | Regenerate + update consuming services |

---

## 9. Cost Management

### 9.1 Monthly Infrastructure Cost Estimates

#### Pilot Phase (2026 Q3–Q4)

| Component | Cost (₦/month) | Notes |
|-----------|---------------|-------|
| VPS (4 vCPU, 8 GB RAM, 200 GB SSD) | ₦50,000 | Nigerian provider; NDPR compliant |
| Cloudflare Pro (DDoS + WAF + CDN) | ₦12,000 | Business DDoS protection |
| Cloudflare R2 (file storage) | ₦5,000 | ~50 GB storage + egress |
| Backblaze B2 (backup storage) | ₦3,000 | ~200 GB encrypted backups |
| Sentry (error tracking) | ₦8,000 | Team plan |
| AWS SES (email — via Nodemailer) | ₦4,000 | ~50K transactional emails |
| Domain + SSL + DNS | ₦2,000 | Annual cost amortized |
| Miscellaneous monitoring tools | ₦10,000 | Uptime monitoring, etc. |
| **Total Pilot** | **₦94,000/month** | Within Year 1 cost projection |

#### Phase 2 (2027 H1)

| Component | Cost (₦/month) | Notes |
|-----------|---------------|-------|
| VPS (8 vCPU, 16 GB RAM, 500 GB SSD) | ₦85,000 | Upgraded VPS |
| Cloudflare Pro | ₦12,000 | Unchanged |
| Cloudflare R2 | ₦15,000 | ~200 GB storage |
| Backblaze B2 | ₦8,000 | ~500 GB backups |
| Sentry | ₦15,000 | More events |
| AWS SES | ₦10,000 | ~150K emails |
| Monitoring (Grafana Cloud) | ₦20,000 | Cloud managed |
| **Total Phase 2** | **₦165,000/month** | |

#### Year 2 (2027 H2)

| Component | Cost (₦/month) | Notes |
|-----------|---------------|-------|
| VPS (16 vCPU, 32 GB RAM, 1 TB SSD) | ₦180,000 | Major vertical scale |
| Cloudflare Business | ₦40,000 | More bandwidth + advanced WAF |
| Cloudflare R2 | ₦40,000 | ~1 TB storage |
| Backblaze B2 | ₦20,000 | ~2 TB backups |
| Monitoring + Observability | ₦50,000 | More metrics, longer retention |
| Email (higher volume) | ₦30,000 | ~500K emails |
| **Total Year 2** | **~₦360,000/month** | |

### 9.2 Cost Optimization Strategies

| Strategy | Implementation | Estimated Saving |
|----------|---------------|-----------------|
| **VPS reserved commitment** | 1-year commitment with Nigerian provider | 15–20% vs. monthly |
| **Aggressive caching** | SQLite cache (MVP) reduces PostgreSQL load | Defers vertical scale |
| **Cloudflare CDN** | Serves static assets; reduces origin bandwidth | Reduces R2 egress |
| **Log tiering** | Move 30+ day logs to cold storage | 60% storage cost reduction |
| **Right-sizing** | Monthly review of CPU/RAM vs. actual utilization | Avoids over-provisioning |
| **R2 storage tiers** | Archive old exports and reports to R2 Infrequent Access | 40% storage cost reduction |

---

## 10. Operational Runbooks

### 10.1 High Error Rate (P1)

**Detection:** Grafana alert fires or Sentry shows error spike.

**Immediate actions:**
1. Check Sentry for the most common error — is it a new deployment?
2. Check Grafana: what changed in the last 30 minutes?
3. If related to a recent deployment → **immediately rollback** (see §4.3)
4. If related to an external service → check provider status page; implement circuit breaker
5. Post in Slack #incidents within 5 minutes of detection

**Investigation:** Correlate Sentry errors with structured logs by `requestId`.

**Resolution:** Fix root cause; deploy fix or rollback; update status page.

---

### 10.2 Database Connection Pool Exhaustion (P2)

**Detection:** Alert fires (PostgreSQL connections >85%).

**Immediate actions:**
1. `psql -U nawebeus_readonly -c "SELECT count(*), state, wait_event FROM pg_stat_activity GROUP BY state, wait_event;"` — identify idle connections or long-running queries
2. If long-running query found: `SELECT pg_cancel_backend(<pid>);` (or `pg_terminate_backend` for stuck queries)
3. If connection leak: identify and restart the leaking service instance
4. Temporary mitigation: restart the application service (closes all connections cleanly)

**Root cause investigation:** Check for unclosed connections in service code; check for N+1 query patterns.

---

### 10.3 Crisis Alert Delivery Failure (P1)

**Detection:** Alert fires (crisis alert latency >2 minutes) OR manual report from customer.

**Immediate actions:**
1. Check WebSocket connection count in Grafana — are users connected?
2. Check notification service logs for delivery errors
3. Verify Paystack/email service health (if alert delivery depends on them)
4. If WebSocket server is down: restart `nawebeus` service; connections will re-establish
5. Manually trigger crisis alert re-delivery if needed

**Communication:** Contact affected organization's admin directly if crisis alert was missed for a Severity 4/5 incident.

---

### 10.4 Paystack ₦ Webhook Failure (P1)

**Detection:** Alert fires (paystack_webhook_failures_total > 0).

**Immediate actions:**
1. Check `/api/webhooks/paystack` endpoint logs for signature verification failures
2. Verify `PAYSTACK_WEBHOOK_SECRET` environment variable is correct
3. Check if Paystack sent a new webhook secret (they rotate occasionally)
4. Retry failed webhooks manually from Paystack dashboard
5. If signature mismatch: update `PAYSTACK_WEBHOOK_SECRET` and restart service

**Escalation:** Finance Lead must be notified if any ₦ subscription activations or renewals were affected.

---

### 10.5 Backup Failure (P1)

**Detection:** Alert fires (backup has not run in 24 hours) OR nightly cron log shows failure.

**Immediate actions:**
1. Check `/var/log/nawebeus-backup.log` for the error
2. Verify Backblaze B2 connectivity: `rclone ls remote:backblaze-nawebeus/`
3. Verify disk space: `df -h /opt/nawebeus/backups/`
4. Run backup manually: `/opt/nawebeus/scripts/backup.sh`
5. Verify the manual backup uploaded successfully

**Important:** Do not deploy new code to production while a backup failure is unresolved.

---

### 10.6 Disk Space Low (P2–P3)

**Detection:** Alert fires (disk utilization >85%).

**Investigation and cleanup:**
```bash
# Identify what's using disk
du -sh /var/log/nawebeus/     # Application logs
du -sh /var/lib/postgresql/   # PostgreSQL data
du -sh /opt/nawebeus/backups/ # Local backup files
du -sh /var/log/              # System logs

# Free up space
find /var/log/nawebeus/ -name "*.log.gz" -mtime +30 -delete   # Old compressed logs
find /opt/nawebeus/backups/ -name "*.gpg" -mtime +7 -delete   # Old local backups

# Rotate PostgreSQL WAL if needed
psql -U postgres -c "SELECT pg_switch_wal();"
```

If disk is genuinely exhausted: upgrade VPS to next storage tier immediately.

---

### 10.7 VPS Completely Unresponsive (P0)

**Detection:** Health check fails; all monitoring dark; no SSH access.

**Immediate actions:**
1. Attempt SSH via WireGuard; try direct SSH if VPN is down
2. Access VPS provider emergency console (out-of-band console)
3. Check provider status page for data center issues
4. If hardware failure: provision a new VPS immediately and restore from backup (§5.4.3)
5. Update DNS to new VPS IP (TTL should be short — 300s in normal operations)
6. Post P0 incident in Slack immediately; escalate to Engineering Lead + CEO

---

### 10.8 WireGuard VPN Down (P1)

**Detection:** No operators can connect via WireGuard; management is inaccessible.

**Immediate actions:**
1. Emergency direct SSH access: use pre-authorized IP allowlist in UFW (maintain an emergency SSH allow rule from a known stable IP)
2. Once connected: `sudo systemctl status wg-quick@wg0` — check WireGuard status
3. Restart WireGuard: `sudo systemctl restart wg-quick@wg0`
4. Check WireGuard logs: `journalctl -u wg-quick@wg0 -n 50`
5. Verify the server's public IP hasn't changed (if using dynamic IP)

**Post-resolution:** Audit how VPN went down; add monitoring for WireGuard service health.

---

### 10.9 Security Incident (P0)

**Detection:** Security alert fires, suspicious activity detected, or user reports unauthorized access.

**Immediate actions (first 15 minutes):**
1. Isolate: block suspicious IPs at Cloudflare WAF immediately
2. Stop further damage: revoke compromised API keys, JWT signing key, or user sessions
3. Preserve evidence: create a snapshot of logs before any remediation
4. Notify Security Lead and Engineering Lead within 5 minutes

**Investigation:**
- Audit log query: identify all actions by suspected compromised user/token
- PostgreSQL logs: look for unusual queries or access patterns
- Nginx access logs: look for unusual request patterns

**Notification requirements (if personal data involved):**
- NITDA (NDPR regulator): within 72 hours
- Affected organization admins: within 24 hours
- All affected users: without undue delay after regulator notification

**Post-incident:** Blameless post-mortem within 48 hours; update incident response procedures.

---

## 11. Maintenance Windows

### 11.1 Scheduled Maintenance Schedule

| Window | Timing (WAT) | Duration | Purpose |
|--------|-------------|---------|---------|
| **Weekly** | Sunday 02:00–04:00 WAT | 2 hours | Routine updates, log rotation |
| **Monthly** | First Sunday 02:00–06:00 WAT | 4 hours | Major updates, database VACUUM, backup verification |
| **Quarterly** | As needed | 8 hours | Major version upgrades, schema changes |

### 11.2 Maintenance Procedures

1. **Notify:** 7 days advance notice via email and status page for monthly/quarterly windows
2. **Status Page:** Update status page 24 hours before with maintenance window
3. **Customer Email:** 48 hours advance notice for windows affecting availability
4. **Execute:** Perform maintenance using the deployment scripts (§4.3) — always blue-green
5. **Verify:** Run health check + smoke tests before closing the window
6. **Communicate:** Update status page when maintenance is complete

---

## 12. Operational Metrics and SLAs

### 12.1 Key Operational Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Platform uptime** | ≥99.9% | External uptime monitoring |
| **Mean time to detect (MTTD) — P0/P1** | <15 minutes | Alert timestamp vs. incident start |
| **Mean time to respond (MTTR) — P1** | <1 hour | Incident log |
| **Mean time to resolve (P0)** | <4 hours | Incident log |
| **Deployment frequency** | Daily | CI/CD pipeline |
| **Deployment lead time (commit to production)** | <2 hours | CI/CD timestamps |
| **Change failure rate** | <5% | Incident tracking |
| **Backup success rate** | 100% | Backup cron log |
| **Backup test frequency** | Monthly | Manual test log |
| **Critical security patch time** | <24 hours | Patch management log |

### 12.2 Capacity Metrics and Thresholds

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| CPU utilization (average) | <60% | 60–85% | >85% |
| Memory utilization | <70% | 70–85% | >90% |
| Disk utilization | <70% | 70–85% | >85% |
| PostgreSQL connections | <70% of max | 70–85% | >85% |
| Cache hit rate | >75% | 60–75% | <60% |
| Network bandwidth (monthly) | <8 TB | 8–9 TB | >9 TB |

---

## 13. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | _________________ | _________ | _______ |
| DevOps Lead | _________________ | _________ | _______ |
| Security Lead | _________________ | _________ | _______ |
| CTO / Project Sponsor | _________________ | _________ | _______ |

---

## 14. Related Documents

| Document | Relationship |
|----------|-------------|
| **Architecture** | System architecture decisions this infrastructure implements |
| **ADRs** | ADR-008 (VPS + WireGuard), ADR-001 (Bun), ADR-012 (Blue-Green), ADR-004 (SQLite cache) |
| **Engineering Standards** | Development standards that govern the CI/CD pipeline |
| **Security Architecture** | Security controls this infrastructure enforces |
| **Database Schema** | PostgreSQL schema this infrastructure hosts |
| **Tech Stack** | Technology choices this infrastructure runs |
| **QA Strategy** | Testing procedures that run in the CI/CD pipeline |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | Engineering Lead & DevOps Lead | Unified and expanded Infrastructure and Operations document. Merges and improves both source documents into a single comprehensive reference. Adds: Nigerian data sovereignty as a first-class infrastructure principle, ₦-denominated cost tables for all three phases, WAT timezone in cron schedules and maintenance windows, Paystack webhook failure runbook, crisis alert delivery failure runbook, complete monthly cost breakdown with ₦ figures, backup verification script with WAT date logging, Nginx rate limiting configuration, PostgreSQL slow query threshold of 200ms, Coolify deployment integration, complete GitHub Actions CI/CD pipeline with WAT timezone enforcement, SQLite as primary MVP cache/rate-limit store replacing Redis, NDPR-compliant backup retention policies, Sentry cron monitor integration, and expanded access control matrix with Grafana and Coolify columns. |

---

*This document is owned by the Engineering Lead and DevOps Lead. It is reviewed quarterly and updated immediately following any significant infrastructure change, incident post-mortem, or scaling event. All infrastructure changes must be documented in this runbook before they are applied to production.*