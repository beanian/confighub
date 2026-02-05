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
