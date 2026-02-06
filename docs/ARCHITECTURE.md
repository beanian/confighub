# ConfigHub Architecture Documentation

ConfigHub is a configuration management platform that provides version-controlled configuration storage with environment promotion workflows, change request approvals, drift detection, and comprehensive audit logging.

## Table of Contents

- [Overview](#overview)
  - [What is ConfigHub?](#what-is-confighub)
  - [Tech Stack](#tech-stack)
- [Functional Overview](#functional-overview)
  - [Environments](#environments)
  - [Configuration Structure](#configuration-structure)
  - [Core Workflows](#core-workflows)
    - [Change Request Workflow](#1-change-request-workflow)
    - [Environment Promotion Workflow](#2-environment-promotion-workflow)
    - [Dependency Registry & Impact Analysis](#3-dependency-registry--impact-analysis)
    - [Drift Detection](#4-drift-detection)
  - [User Roles](#user-roles)
- [Architecture](#architecture)
  - [Project Structure](#project-structure)
  - [Backend Architecture](#backend-architecture)
  - [Frontend Architecture](#frontend-architecture)
  - [Data Flow Diagrams](#data-flow-diagrams)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Configuration](#configuration)
  - [Change Requests](#change-requests)
  - [Promotions](#promotions)
  - [Dependencies & Impact Analysis](#dependencies--impact-analysis)
  - [Drift Analysis](#drift-analysis)
  - [Audit Log](#audit-log)
- [Consumer Registration Guide](#consumer-registration-guide)
  - [How Consumer Registration Works](#how-consumer-registration-works)
  - [Registering Your App](#registering-your-app)
  - [Heartbeat Protocol](#heartbeat-protocol)
  - [Integration Patterns](#integration-patterns)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

---

## Overview

### What is ConfigHub?

ConfigHub manages application configurations across multiple environments (development, staging, production) using Git as the underlying storage mechanism. It provides:

- **Version Control**: All configurations stored in Git with full history
- **Change Workflows**: Draft → Review → Approve → Merge pipeline
- **Environment Promotions**: Controlled promotion of configs between environments
- **Drift Detection**: Identify configuration differences across environments
- **Audit Trail**: Complete logging of all actions and changes
- **Role-Based Access**: Viewer, Editor, Approver, and Admin roles

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express.js, TypeScript |
| Database | SQLite (via sql.js) |
| Storage | Git (via simple-git) |
| Auth | JWT with bcrypt password hashing |

[Back to top](#table-of-contents)

---

## Functional Overview

### Environments

ConfigHub manages three environments, each mapped to a Git branch:

| Environment | Git Branch | Purpose |
|-------------|------------|---------|
| `dev` | `main` | Development/testing |
| `staging` | `staging` | Pre-production validation |
| `prod` | `production` | Live production configs |

### Configuration Structure

Configurations are organized in a hierarchical structure:

```
config-repo/
└── config/
    ├── database/           # Domain: database
    │   ├── connection.yaml # Key: connection
    │   └── pool.yaml       # Key: pool
    ├── api/                # Domain: api
    │   ├── endpoints.yaml
    │   └── cache.yaml
    └── feature-flags/      # Domain: feature-flags
        └── flags.yaml
```

- **Domain**: A logical grouping (directory) of related configurations
- **Key**: An individual configuration file within a domain

### Core Workflows

#### 1. Change Request Workflow

Create and review configuration changes before they go live.

```
┌─────────┐    ┌────────────────┐    ┌──────────┐    ┌────────┐
│  Draft  │───▶│ Pending Review │───▶│ Approved │───▶│ Merged │
└─────────┘    └────────────────┘    └──────────┘    └────────┘
                      │
                      ▼
                ┌──────────┐
                │ Rejected │
                └──────────┘
```

**Operations supported:**
- `update` - Modify existing configuration
- `create` - Create new configuration file
- `delete` - Remove configuration file
- `create_domain` - Create new domain directory
- `delete_domain` - Remove domain directory

**Process:**
1. User creates a change request (creates a draft Git branch)
2. User edits configuration content
3. User submits for review
4. Approver reviews the diff and approves/rejects
5. If approved, user merges to target environment
6. Draft branch is deleted after merge

#### 2. Environment Promotion Workflow

Promote configurations from lower to higher environments.

```
┌─────────┐    ┌──────────┐    ┌──────────┐
│ Pending │───▶│ Approved │───▶│ Promoted │
└─────────┘    └──────────┘    └──────────┘
     │                              │
     ▼                              ▼
┌──────────┐                 ┌─────────────┐
│ Rejected │                 │ Rolled Back │
└──────────┘                 └─────────────┘
```

**Allowed promotion paths:**
- `dev` → `staging`
- `staging` → `prod`

**Process:**
1. User selects source environment, domain, and files to promote
2. System shows preview diff (source vs target content)
3. Approver reviews and approves
4. User executes promotion (copies files between Git branches)
5. System creates tagged commit for traceability
6. Optional rollback available if issues discovered

#### 3. Dependency Registry & Impact Analysis

Track which applications consume configurations and see impact warnings before making changes.

**Consumer Status:**

| Status | Definition |
|--------|------------|
| `active` | Heartbeat within last 24 hours |
| `stale` | Heartbeat between 1-7 days ago |
| `inactive` | No heartbeat for 7+ days |

**How it works:**

1. Applications register themselves via the API, declaring which configs they consume
2. Applications send periodic heartbeats to indicate they're still running
3. When viewing or promoting configs, ConfigHub shows which apps will be affected
4. Production promotions with active consumers show prominent warnings
5. Users must acknowledge impact before executing production promotions

**Registration example:**
```bash
curl -X POST https://confighub/api/dependencies \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Motor Pricing Engine",
    "app_id": "motor-pricing-engine",
    "environment": "prod",
    "domain": "pricing",
    "config_keys": ["motor-rates", "home-rates"],
    "contact_team": "Pricing Team",
    "contact_email": "pricing@company.com"
  }'
```

**Heartbeat example:**
```bash
curl -X POST https://confighub/api/dependencies/motor-pricing-engine/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"environment": "prod"}'
```

#### 4. Drift Detection

Identify configurations that differ across environments.

**Status classifications:**

| Status | Description |
|--------|-------------|
| `synced` | Identical content across all environments |
| `drifted` | Content differs between environments |
| `partial` | Exists in some environments but not others |
| `dev-only` | Only exists in development environment |

### User Roles

| Role | Permissions |
|------|-------------|
| `viewer` | Read-only access to all configurations |
| `editor` | Create and edit change requests |
| `approver` | Review and approve changes/promotions |
| `admin` | Full access, can self-approve |

**Key restrictions:**
- Non-admins cannot approve their own requests
- Only approved changes can be merged
- Only approved promotions can be executed

[Back to top](#table-of-contents)

---

## Architecture

### Project Structure

```
confighub/
├── packages/
│   ├── api/                 # Backend Express server
│   │   └── src/
│   │       ├── index.ts     # Server entry point
│   │       ├── db/          # Database initialization
│   │       ├── middleware/  # Auth middleware
│   │       ├── routes/      # API route handlers
│   │       └── services/    # Business logic (git, audit)
│   │
│   ├── ui/                  # Frontend React app
│   │   └── src/
│   │       ├── api/         # API client
│   │       ├── components/  # Reusable UI components
│   │       ├── hooks/       # React hooks (auth, env)
│   │       └── pages/       # Page components
│   │
│   └── shared/              # Shared types (reserved)
│
├── config-repo/             # Git repository for configs
├── data/                    # SQLite database
├── Dockerfile               # Production container build
└── package.json             # Workspace root
```

### Backend Architecture

#### Server Setup (`packages/api/src/index.ts`)

```typescript
// Middleware chain
app.use(cors());
app.use(express.json());
app.use(authMiddleware);  // JWT parsing

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/changes', changesRoutes);
app.use('/api/promotions', promotionsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/drift', driftRoutes);
app.use('/api/dependencies', dependenciesRoutes);
app.use('/api/impact', impactRoutes);

// Production: serve static UI
if (isProduction) {
  app.use(express.static('public'));
}
```

#### Git Service (`packages/api/src/services/git.ts`)

Handles all Git operations with a mutex lock to prevent concurrent operations:

```typescript
// Key functions
initializeRepo()           // Create repo with 3 branches
getConfig(env, domain, key) // Read YAML from branch
saveConfig(env, domain, key, content, message) // Write + commit
listDomains(env)           // List all domain directories
listKeys(env, domain)      // List config files in domain
```

**Branch mapping:**
- `dev` → `main` branch
- `staging` → `staging` branch
- `prod` → `production` branch

#### Authentication (`packages/api/src/middleware/auth.ts`)

```typescript
// JWT token extraction
const token = req.headers.authorization?.replace('Bearer ', '');
const decoded = jwt.verify(token, JWT_SECRET);
req.userId = decoded.userId;
req.userRole = decoded.role;
```

**Middleware levels:**
- `authMiddleware` - Parses token if present (optional auth)
- `requireAuth` - Enforces authentication
- `requireAdmin` - Enforces admin role

### Frontend Architecture

#### State Management

**Authentication** (`hooks/useAuth.tsx`):
- React Context for global auth state
- Token stored in localStorage
- Auto-restore session on app load

**Environment** (`hooks/useEnvironment.tsx`):
- React Context for current environment
- Persisted across navigation

#### API Client (`api/client.ts`)

Centralized HTTP client with automatic JWT injection:

```typescript
class ApiClient {
  private token: string | null = null;

  setToken(token: string) { this.token = token; }

  private async request(path: string, options: RequestInit) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` })
    };
    return fetch(`/api${path}`, { ...options, headers });
  }
}
```

#### Page Components

| Page | Path | Purpose |
|------|------|---------|
| Dashboard | `/` | Overview stats and quick actions |
| Browse | `/browse` | Navigate and edit configurations |
| Changes | `/changes` | List all change requests |
| ChangeDetail | `/changes/:id` | Review and manage single change |
| Promotions | `/promotions` | List all promotion requests |
| PromotionDetail | `/promotions/:id` | Review and execute promotion |
| Compare | `/compare` | Side-by-side environment comparison |
| Drift | `/drift` | Drift analysis dashboard |
| Dependencies | `/dependencies` | Dependency graph and consumer registry |
| AuditLog | `/audit` | Searchable audit trail |

### Data Flow Diagrams

#### Configuration Edit Flow

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│  User    │────▶│  React UI   │────▶│  API Server  │
│  edits   │     │  (Monaco)   │     │              │
└──────────┘     └─────────────┘     └──────┬───────┘
                                            │
                 ┌──────────────────────────┼──────────────────────────┐
                 │                          ▼                          │
                 │  ┌─────────────┐   ┌───────────┐   ┌─────────────┐ │
                 │  │  SQLite DB  │◀──│  Express  │──▶│  Git Repo   │ │
                 │  │  (metadata) │   │  Routes   │   │  (content)  │ │
                 │  └─────────────┘   └───────────┘   └─────────────┘ │
                 │                      Backend                        │
                 └─────────────────────────────────────────────────────┘
```

#### Promotion Execution Flow

```
1. Read files from source branch (e.g., main)
2. Write files to target branch (e.g., staging)
3. Create commit: "promote: domain/files source → target [id]"
4. Create tag: "promote-{env}-{domain}-{timestamp}"
5. Update promotion_requests table status
6. Log to audit_log table
```

[Back to top](#table-of-contents)

---

## API Reference

### Authentication

#### POST `/api/auth/login`
Authenticate and receive JWT token.

**Request:**
```json
{
  "email": "admin@confighub.local",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "usr_abc123",
    "email": "admin@confighub.local",
    "role": "admin"
  }
}
```

### Configuration

#### GET `/api/config/:env/domains`
List all domains in an environment.

#### GET `/api/config/:env/:domain/keys`
List all configuration keys in a domain.

#### GET `/api/config/:env/:domain/:key`
Get configuration content.

**Response:**
```json
{
  "raw": "database:\n  host: localhost\n  port: 5432",
  "parsed": {
    "database": {
      "host": "localhost",
      "port": 5432
    }
  }
}
```

### Change Requests

#### POST `/api/changes`
Create a new change request.

**Request:**
```json
{
  "domain": "database",
  "key": "connection",
  "targetEnvironment": "dev",
  "operation": "update",
  "title": "Update connection timeout",
  "description": "Increase timeout from 30s to 60s",
  "content": "timeout: 60"
}
```

#### POST `/api/changes/:id/submit`
Submit change for review.

#### POST `/api/changes/:id/approve`
Approve a pending change.

#### POST `/api/changes/:id/reject`
Reject a change with comment.

#### POST `/api/changes/:id/merge`
Merge approved change to target environment.

### Promotions

#### POST `/api/promotions`
Create promotion request.

**Request:**
```json
{
  "sourceEnv": "dev",
  "targetEnv": "staging",
  "domain": "api",
  "files": ["endpoints", "cache"],
  "notes": "Promoting new API endpoints"
}
```

#### GET `/api/promotions/:id/preview`
Get diff preview of promotion.

#### POST `/api/promotions/:id/approve`
Approve promotion request.

#### POST `/api/promotions/:id/execute`
Execute approved promotion.

#### POST `/api/promotions/:id/rollback`
Rollback a promoted change.

### Dependencies & Impact Analysis

#### POST `/api/dependencies`
Register an application as a consumer of configurations.

**Request:**
```json
{
  "app_name": "Motor Pricing Engine",
  "app_id": "motor-pricing-engine",
  "environment": "prod",
  "domain": "pricing",
  "config_keys": ["motor-rates", "home-rates"],
  "contact_team": "Pricing Team",
  "contact_email": "pricing@company.com",
  "metadata": { "version": "2.1.0" }
}
```

#### GET `/api/dependencies`
List all registered dependencies.

**Query parameters:**
- `environment` - Filter by environment
- `domain` - Filter by domain
- `app_id` - Filter by application ID

#### GET `/api/dependencies/:appId`
Get a specific application's registration.

#### POST `/api/dependencies/:appId/heartbeat`
Update the heartbeat timestamp to indicate the app is still active.

**Request:**
```json
{
  "environment": "prod"
}
```

#### DELETE `/api/dependencies/:appId`
Remove an application registration.

#### GET `/api/impact/:env/:domain/:key`
Get impact analysis for a specific configuration.

**Response:**
```json
{
  "environment": "prod",
  "domain": "pricing",
  "key": "motor-rates",
  "consumers": [
    {
      "app_id": "motor-pricing-engine",
      "app_name": "Motor Pricing Engine",
      "status": "active",
      "last_heartbeat": "2026-02-05T14:30:00Z",
      "contact_team": "Pricing Team",
      "contact_email": "pricing@company.com"
    }
  ],
  "consumer_count": 1,
  "status_counts": {
    "active": 1,
    "stale": 0,
    "inactive": 0
  }
}
```

### Drift Analysis

#### GET `/api/drift`
Get full drift analysis.

**Response:**
```json
{
  "syncPercentage": 75,
  "domains": [
    {
      "domain": "database",
      "syncPercentage": 100,
      "configs": [
        {
          "key": "connection",
          "status": "synced",
          "devVsStaging": "same",
          "stagingVsProd": "same"
        }
      ]
    }
  ]
}
```

#### GET `/api/drift/:domain/:key/diff`
Get specific drift diff between environments.

### Audit Log

#### GET `/api/audit`
Query audit entries with filters.

**Query parameters:**
- `action` - Filter by action type
- `entity_type` - Filter by entity type
- `environment` - Filter by environment
- `domain` - Filter by domain
- `actor` - Filter by user ID
- `from` / `to` - Date range
- `search` - Full-text search
- `limit` / `offset` - Pagination

[Back to top](#table-of-contents)

---

## Consumer Registration Guide

This section explains how applications register themselves as consumers of ConfigHub configurations. Consumer registration powers the **impact analysis** feature, which warns users when config changes affect production services.

### How Consumer Registration Works

1. **Register** - Your app calls the `/api/dependencies` endpoint to declare which configs it consumes
2. **Heartbeat** - Your app sends periodic heartbeats to signal it is still running
3. **Impact Visibility** - When anyone views or promotes configs your app consumes, ConfigHub shows your app as an affected consumer
4. **Status Tracking** - ConfigHub classifies consumers based on heartbeat recency:

| Status | Heartbeat Age | Meaning |
|--------|---------------|---------|
| `active` | < 24 hours | App is running and consuming this config |
| `stale` | 1-7 days | App may still be running but hasn't checked in recently |
| `inactive` | > 7 days | App is likely not running or no longer consuming this config |

### Registering Your App

Send a `POST` request to `/api/dependencies` with your app's details. If a registration already exists for the same `app_id` + `environment` combination, it will be updated (upsert behavior).

**Required fields:**

| Field | Type | Description |
|-------|------|-------------|
| `app_name` | string | Human-readable application name |
| `app_id` | string | Unique identifier (slug format recommended, e.g. `motor-pricing-engine`) |
| `environment` | string | Which environment this instance consumes from: `dev`, `staging`, or `prod` |
| `domain` | string | The config domain this app depends on (e.g. `pricing`, `database`) |
| `config_keys` | string[] | Array of config key names consumed (e.g. `["motor-rates", "home-rates"]`) |

**Optional fields:**

| Field | Type | Description |
|-------|------|-------------|
| `contact_team` | string | Team responsible for this app |
| `contact_email` | string | Contact email for notifications |
| `metadata` | object | Arbitrary JSON for extra context (e.g. `{"version": "2.1.0", "region": "us-east-1"}`) |

**Example - Register an app:**
```bash
curl -X POST https://confighub/api/dependencies \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Motor Pricing Engine",
    "app_id": "motor-pricing-engine",
    "environment": "prod",
    "domain": "pricing",
    "config_keys": ["motor-rates", "home-rates"],
    "contact_team": "Pricing Team",
    "contact_email": "pricing@company.com",
    "metadata": {"version": "2.1.0", "region": "us-east-1"}
  }'
```

**Example - Register the same app in multiple environments:**
```bash
# Dev instance
curl -X POST https://confighub/api/dependencies \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Motor Pricing Engine",
    "app_id": "motor-pricing-engine",
    "environment": "dev",
    "domain": "pricing",
    "config_keys": ["motor-rates", "home-rates"],
    "contact_team": "Pricing Team"
  }'

# Production instance
curl -X POST https://confighub/api/dependencies \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Motor Pricing Engine",
    "app_id": "motor-pricing-engine",
    "environment": "prod",
    "domain": "pricing",
    "config_keys": ["motor-rates", "home-rates"],
    "contact_team": "Pricing Team"
  }'
```

**Example - Deregister an app:**
```bash
# Remove from all environments
curl -X DELETE https://confighub/api/dependencies/motor-pricing-engine

# Remove from a specific environment only
curl -X DELETE "https://confighub/api/dependencies/motor-pricing-engine?environment=dev"
```

### Heartbeat Protocol

Heartbeats tell ConfigHub your app is still alive and consuming configs. Without heartbeats, your app's status will degrade from `active` → `stale` → `inactive`.

**Send a heartbeat:**
```bash
curl -X POST https://confighub/api/dependencies/motor-pricing-engine/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"environment": "prod"}'
```

**Recommended heartbeat interval:** Every 1-6 hours. A heartbeat within the last 24 hours keeps the app marked as `active`.

> **Tip:** Registration calls (`POST /api/dependencies`) also refresh the heartbeat, so if your app re-registers on startup, that counts as a heartbeat too.

### Integration Patterns

#### On Application Startup

Register your app and declare its config dependencies when it boots:

```typescript
// Example: Node.js app startup
async function registerWithConfigHub() {
  await fetch('https://confighub/api/dependencies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_name: 'My Service',
      app_id: 'my-service',
      environment: process.env.NODE_ENV === 'production' ? 'prod' : 'dev',
      domain: 'api',
      config_keys: ['endpoints', 'cache'],
      contact_team: 'Platform Team',
      contact_email: 'platform@company.com',
      metadata: { version: process.env.APP_VERSION }
    })
  });
}
```

#### Periodic Heartbeat

Set up a timer to send heartbeats while your app is running:

```typescript
// Example: Send heartbeat every 4 hours
setInterval(async () => {
  await fetch('https://confighub/api/dependencies/my-service/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      environment: process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
    })
  });
}, 4 * 60 * 60 * 1000);
```

#### CI/CD Pipeline

Register or update dependencies as part of your deployment pipeline:

```yaml
# Example: GitHub Actions step
- name: Register with ConfigHub
  run: |
    curl -X POST https://confighub/api/dependencies \
      -H "Content-Type: application/json" \
      -d '{
        "app_name": "My Service",
        "app_id": "my-service",
        "environment": "${{ env.DEPLOY_ENV }}",
        "domain": "api",
        "config_keys": ["endpoints", "cache"],
        "contact_team": "Platform Team",
        "metadata": {"version": "${{ github.sha }}", "build": "${{ github.run_id }}"}
      }'
```

#### Checking Impact Before Changes

Before promoting or changing configs, query the impact endpoint to see affected consumers:

```bash
# Who consumes pricing/motor-rates in production?
curl https://confighub/api/impact/prod/pricing/motor-rates \
  -H "Authorization: Bearer $TOKEN"
```

This returns a list of all registered consumers, their status, and contact information.

[Back to top](#table-of-contents)

---

## Database Schema

### users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'editor',  -- viewer, editor, approver, admin
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### change_requests
```sql
CREATE TABLE change_requests (
  id TEXT PRIMARY KEY,
  branch_name TEXT NOT NULL,
  target_environment TEXT NOT NULL,
  domain TEXT NOT NULL,
  key_name TEXT,
  operation TEXT DEFAULT 'update',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  created_by TEXT REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id),
  review_comment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### promotion_requests
```sql
CREATE TABLE promotion_requests (
  id TEXT PRIMARY KEY,
  source_env TEXT NOT NULL,
  target_env TEXT NOT NULL,
  domain TEXT NOT NULL,
  files TEXT NOT NULL,  -- JSON array
  notes TEXT,
  status TEXT DEFAULT 'pending',
  requested_by TEXT REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id),
  review_notes TEXT,
  commit_sha TEXT,
  requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  promoted_at TEXT,
  rolled_back_at TEXT
);
```

### audit_log
```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  actor TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  environment TEXT,
  domain TEXT,
  details TEXT,  -- JSON
  commit_sha TEXT
);
```

### dependencies
```sql
CREATE TABLE dependencies (
  id TEXT PRIMARY KEY,
  app_name TEXT NOT NULL,
  app_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  domain TEXT NOT NULL,
  config_keys TEXT NOT NULL,  -- JSON array of key names
  contact_email TEXT,
  contact_team TEXT,
  last_heartbeat TEXT DEFAULT CURRENT_TIMESTAMP,
  registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,  -- JSON for additional app info
  UNIQUE(app_id, environment)
);
```

[Back to top](#table-of-contents)

---

## Deployment

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` (dev) / `3000` (prod) | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `DATABASE_PATH` | `./data/confighub.db` | SQLite file path |
| `CONFIG_REPO_PATH` | `./config-repo` | Git repository path |
| `JWT_SECRET` | `dev-secret-change-me` | **Must change in production** |

### Local Development

```bash
# Install dependencies
npm install

# Start both API and UI in development mode
npm run dev

# Or start separately
npm run dev:api  # API on port 4000
npm run dev:ui   # UI with hot reload on port 5173
```

### Docker Production Build

```dockerfile
# Multi-stage build
FROM node:20-alpine AS ui-builder
# Build UI with Vite

FROM node:20-alpine AS api-builder
# Build API with TypeScript

FROM node:20-alpine
# Copy built UI to API's public folder
# Run combined server on port 3000
```

```bash
# Build and run
docker build -t confighub .
docker run -p 3000:3000 \
  -e JWT_SECRET=your-secure-secret \
  -v confighub-data:/data \
  confighub
```

### Railway Deployment

The app is configured for Railway with:
- Automatic builds from Dockerfile
- Persistent volume for `/data` (database + git repo)
- Public domain: `https://confighub-production-xxxx.up.railway.app`

**API endpoints available at:**
```
https://your-app.up.railway.app/api/health
https://your-app.up.railway.app/api/config/dev/domains
https://your-app.up.railway.app/api/auth/login
```

### Default Credentials

On first startup, a default admin user is created:

- **Email:** `admin@confighub.local`
- **Password:** `admin123`

**Important:** Change these credentials in production!

[Back to top](#table-of-contents)

---

## Security Considerations

1. **JWT Secret**: Always use a strong, unique `JWT_SECRET` in production
2. **HTTPS**: Deploy behind HTTPS in production
3. **Password Policy**: Consider implementing password requirements
4. **Rate Limiting**: Add rate limiting for auth endpoints
5. **Audit Logs**: Review audit logs regularly for suspicious activity
6. **Git Access**: The config-repo should not be directly accessible

[Back to top](#table-of-contents)

---

## Troubleshooting

### Common Issues

**"Config not found" errors:**
- Verify the environment branch exists in git repo
- Check that the domain/key path is correct

**Authentication failures:**
- Token may be expired (8-hour expiration)
- Check JWT_SECRET matches between restarts

**Git operation failures:**
- Ensure config-repo directory is writable
- Check for git lock files in `.git/`

**Database errors:**
- Verify DATABASE_PATH is writable
- Check disk space availability

[Back to top](#table-of-contents)
