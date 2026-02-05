# ConfigHub Documentation

## Quick Links

- [Architecture Documentation](./ARCHITECTURE.md) - Full technical architecture and API reference
- [API Examples](./API_EXAMPLES.md) - Common API usage examples

## What is ConfigHub?

ConfigHub is a configuration management system that provides:

- **Git-backed storage** - All configs versioned with full history
- **Multi-environment support** - Dev, Staging, and Production
- **Change workflows** - Draft, review, approve, merge pipeline
- **Environment promotions** - Controlled promotion between environments
- **Drift detection** - Identify config differences across environments
- **Audit logging** - Complete trail of all changes

## Why ConfigHub Over Azure App Configuration?

| Feature | ConfigHub | Azure App Configuration |
|---------|-----------|------------------------|
| **Version Control** | Native Git with branches, commits, full history | Point-in-time snapshots only |
| **Approval Workflows** | Built-in draft → review → approve → merge | Requires external tooling (Azure DevOps) |
| **Environment Promotion** | One-click promotion with diff preview & rollback | Manual copy or external pipelines |
| **Drift Detection** | Built-in cross-environment comparison | Not available natively |
| **Config Format** | Structured YAML files | Flat key-value pairs |
| **Hosting** | Self-hosted anywhere (Docker, Railway, any cloud) | Azure-only |
| **Pricing** | Free (self-hosted) | Per-request pricing |
| **Vendor Lock-in** | None - portable Git storage | Azure ecosystem dependency |

### Key Advantages

**1. True Version Control**
Azure App Config offers snapshots, but ConfigHub uses actual Git. You get branches, commit history, blame, cherry-pick, and all Git workflows your team already knows.

**2. Built-in Governance**
No need to wire up Azure DevOps pipelines for approvals. ConfigHub has change requests with review workflows out of the box - editors submit, approvers review, then merge.

**3. Environment Promotion Done Right**
Promoting configs from dev → staging → prod is a first-class feature. Preview diffs before promoting, track what was promoted, and rollback if needed.

**4. See Drift Instantly**
ConfigHub shows you exactly which configs differ across environments. No scripting or external tools needed.

**5. No Cloud Lock-in**
Run ConfigHub on any infrastructure. Your configs live in a standard Git repo you fully control.

**6. Predictable Costs**
Self-hosted means no per-request charges. One container, SQLite database, done.

### Comparison with Other Platforms

| Platform | ConfigHub Advantage |
|----------|---------------------|
| **HashiCorp Consul** | Simpler setup, built-in UI, approval workflows, no distributed systems complexity |
| **AWS AppConfig** | No AWS dependency, Git-native versioning, built-in promotion workflows |
| **etcd** | Human-readable YAML, web UI, change approval process, audit logging |
| **Spring Cloud Config** | Full management UI, approval workflows, drift detection, not Java-specific |
| **LaunchDarkly** | Full config management (not just feature flags), self-hosted, no per-seat pricing |

## Quick Start

### Local Development

```bash
# Clone and install
git clone <repo-url>
cd confighub
npm install

# Start development servers
npm run dev
```

- UI: http://localhost:5173
- API: http://localhost:4000

### Default Login

- Email: `admin@confighub.local`
- Password: `admin123`

### Production (Docker)

```bash
docker build -t confighub .
docker run -p 3000:3000 -e JWT_SECRET=your-secret -v data:/data confighub
```

## Core Concepts

### Environments

| Environment | Git Branch | Color |
|-------------|------------|-------|
| dev | main | Blue |
| staging | staging | Amber |
| prod | production | Red |

### Configuration Hierarchy

```
Domain (directory)
└── Key (YAML file)
```

Example: `database/connection.yaml`

### Workflow States

**Change Requests:**
```
draft → pending_review → approved → merged
                      → rejected
```

**Promotions:**
```
pending → approved → promoted → rolled_back (optional)
       → rejected
```

### User Roles

| Role | Can Create | Can Approve | Self-Approve |
|------|------------|-------------|--------------|
| viewer | No | No | No |
| editor | Yes | No | No |
| approver | Yes | Yes | No |
| admin | Yes | Yes | Yes |

## API Quick Reference

```bash
# Health check
curl https://your-app/api/health

# Login
curl -X POST https://your-app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@confighub.local","password":"admin123"}'

# List domains (with auth)
curl https://your-app/api/config/dev/domains \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get config
curl https://your-app/api/config/dev/database/connection \
  -H "Authorization: Bearer YOUR_TOKEN"
```

See [API Examples](./API_EXAMPLES.md) for complete examples.
