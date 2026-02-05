# ConfigHub Architecture Documentation

ConfigHub is a configuration management platform that provides version-controlled configuration storage with environment promotion workflows, change request approvals, drift detection, and comprehensive audit logging.

## Table of Contents

- [Overview](#overview)
- [Functional Overview](#functional-overview)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Deployment](#deployment)

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

#### 3. Drift Detection

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

---

## Security Considerations

1. **JWT Secret**: Always use a strong, unique `JWT_SECRET` in production
2. **HTTPS**: Deploy behind HTTPS in production
3. **Password Policy**: Consider implementing password requirements
4. **Rate Limiting**: Add rate limiting for auth endpoints
5. **Audit Logs**: Review audit logs regularly for suspicious activity
6. **Git Access**: The config-repo should not be directly accessible

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
