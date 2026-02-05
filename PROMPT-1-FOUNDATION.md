# Prompt 1: Project Foundation

Build the foundation for ConfigHub, a configuration governance platform. This is Phase 1 of 3.

## What You're Building

A local-first platform where:
- Business users edit YAML configs through a web UI
- Changes go through PR-style approval workflow
- Apps consume config via REST API
- Git is the source of truth (audit trail, versioning, rollback)

## This Prompt: Foundation Only

Create the monorepo structure, database, sample configs, and basic API. No UI yet.

## Step 1: Create Project Structure

```bash
mkdir confighub && cd confighub

# Initialize monorepo with npm workspaces
npm init -y

# Create directory structure
mkdir -p packages/api/src/{routes,services,db,middleware}
mkdir -p packages/ui/src/{components,pages,hooks,api}
mkdir -p packages/shared/src
mkdir -p config-repo/config/pricing
mkdir -p config-repo/config/mulesoft-mappings
mkdir -p data
```

Update `package.json` to use workspaces:
```json
{
  "name": "confighub",
  "private": true,
  "workspaces": ["packages/*"]
}
```

## Step 2: Set Up API Package

Create `packages/api/package.json`:
```json
{
  "name": "@confighub/api",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "better-sqlite3": "^9.4.3",
    "simple-git": "^3.22.0",
    "js-yaml": "^4.1.0",
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/better-sqlite3": "^7.6.8",
    "@types/js-yaml": "^4.0.9",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcrypt": "^5.0.2",
    "@types/uuid": "^9.0.7",
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0"
  }
}
```

Create `packages/api/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Step 3: Create SQLite Database Schema

Create `packages/api/src/db/schema.sql`:
```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'approver', 'admin')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Sessions table  
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Change requests
CREATE TABLE IF NOT EXISTS change_requests (
    id TEXT PRIMARY KEY,
    branch_name TEXT NOT NULL,
    target_environment TEXT NOT NULL,
    domain TEXT NOT NULL,
    key_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'merged')),
    created_by TEXT NOT NULL REFERENCES users(id),
    reviewed_by TEXT REFERENCES users(id),
    review_comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    merged_at TEXT
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    user_id TEXT REFERENCES users(id),
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

Create `packages/api/src/db/index.ts`:
```typescript
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = process.env.DATABASE_PATH || './data/confighub.db';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_PATH);

export function initializeDatabase(): void {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  db.exec(schema);
  
  // Seed admin user if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@confighub.local');
  
  if (!adminExists) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), 'admin@confighub.local', passwordHash, 'admin');
    
    console.log('Created default admin user: admin@confighub.local / admin123');
  }
}
```

## Step 4: Create Git Service

Create `packages/api/src/services/git.ts`:
```typescript
import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

const REPO_PATH = process.env.CONFIG_REPO_PATH || './config-repo';

let git: SimpleGit;

export function getGit(): SimpleGit {
  if (!git) {
    git = simpleGit(REPO_PATH);
  }
  return git;
}

// Map environment to branch name
export function envToBranch(env: string): string {
  const mapping: Record<string, string> = {
    dev: 'main',
    staging: 'staging',
    prod: 'production',
  };
  return mapping[env] || 'main';
}

// Initialize repo with environment branches
export async function initializeRepo(): Promise<void> {
  const gitDir = path.join(REPO_PATH, '.git');
  
  if (!fs.existsSync(gitDir)) {
    console.log('Initializing config repository...');
    
    const g = getGit();
    await g.init();
    await g.addConfig('user.email', 'confighub@local');
    await g.addConfig('user.name', 'ConfigHub');
    
    // Create initial commit
    const gitkeep = path.join(REPO_PATH, 'config', '.gitkeep');
    fs.mkdirSync(path.dirname(gitkeep), { recursive: true });
    fs.writeFileSync(gitkeep, '');
    
    await g.add('.');
    await g.commit('Initial commit');
    
    // Create environment branches
    await g.branch(['staging']);
    await g.branch(['production']);
    
    console.log('Config repository initialized with branches: main, staging, production');
  }
}

// Get config from a specific environment
export async function getConfig(
  env: string,
  domain: string,
  key: string
): Promise<{ content: unknown; commitSha: string; raw: string } | null> {
  const g = getGit();
  const branch = envToBranch(env);
  const filePath = path.join(REPO_PATH, 'config', domain, `${key}.yaml`);
  
  // Stash any changes, checkout branch, then restore
  const currentBranch = (await g.branchLocal()).current;
  
  try {
    await g.checkout(branch);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const raw = fs.readFileSync(filePath, 'utf-8');
    const content = yaml.load(raw);
    
    const log = await g.log({ maxCount: 1, file: filePath });
    const commitSha = log.latest?.hash || 'unknown';
    
    return { content, commitSha, raw };
  } finally {
    // Return to original branch
    if (currentBranch !== branch) {
      await g.checkout(currentBranch);
    }
  }
}

// List all keys in a domain for an environment
export async function listKeys(env: string, domain: string): Promise<string[]> {
  const g = getGit();
  const branch = envToBranch(env);
  const domainPath = path.join(REPO_PATH, 'config', domain);
  
  const currentBranch = (await g.branchLocal()).current;
  
  try {
    await g.checkout(branch);
    
    if (!fs.existsSync(domainPath)) {
      return [];
    }
    
    const files = fs.readdirSync(domainPath);
    return files
      .filter(f => f.endsWith('.yaml') && f !== 'schema.yaml')
      .map(f => f.replace('.yaml', ''));
  } finally {
    if (currentBranch !== branch) {
      await g.checkout(currentBranch);
    }
  }
}

// List all domains
export async function listDomains(env: string): Promise<string[]> {
  const g = getGit();
  const branch = envToBranch(env);
  const configPath = path.join(REPO_PATH, 'config');
  
  const currentBranch = (await g.branchLocal()).current;
  
  try {
    await g.checkout(branch);
    
    if (!fs.existsSync(configPath)) {
      return [];
    }
    
    const entries = fs.readdirSync(configPath, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } finally {
    if (currentBranch !== branch) {
      await g.checkout(currentBranch);
    }
  }
}
```

## Step 5: Create Config Routes

Create `packages/api/src/routes/config.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { getConfig, listKeys, listDomains } from '../services/git';

const router = Router();

// GET /api/config/:env/:domain/:key
router.get('/:env/:domain/:key', async (req: Request, res: Response) => {
  const { env, domain, key } = req.params;
  const format = req.query.format as string;
  
  // Validate environment
  if (!['dev', 'staging', 'prod'].includes(env)) {
    return res.status(400).json({ error: 'Invalid environment. Use: dev, staging, prod' });
  }
  
  try {
    const result = await getConfig(env, domain, key);
    
    if (!result) {
      return res.status(404).json({ error: `Config not found: ${domain}/${key}` });
    }
    
    res.json({
      domain,
      key,
      environment: env,
      version: result.commitSha,
      data: result.content,
      raw: format === 'yaml' || format === 'raw' ? result.raw : undefined,
      lastModified: new Date().toISOString(), // TODO: get from git
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// GET /api/config/:env/:domain - list keys
router.get('/:env/:domain', async (req: Request, res: Response) => {
  const { env, domain } = req.params;
  
  if (!['dev', 'staging', 'prod'].includes(env)) {
    return res.status(400).json({ error: 'Invalid environment' });
  }
  
  try {
    const keys = await listKeys(env, domain);
    res.json({ domain, environment: env, keys });
  } catch (error) {
    console.error('Error listing keys:', error);
    res.status(500).json({ error: 'Failed to list keys' });
  }
});

// GET /api/config/:env - list domains
router.get('/:env', async (req: Request, res: Response) => {
  const { env } = req.params;
  
  if (!['dev', 'staging', 'prod'].includes(env)) {
    return res.status(400).json({ error: 'Invalid environment' });
  }
  
  try {
    const domains = await listDomains(env);
    res.json({ environment: env, domains });
  } catch (error) {
    console.error('Error listing domains:', error);
    res.status(500).json({ error: 'Failed to list domains' });
  }
});

export default router;
```

## Step 6: Create Express App

Create `packages/api/src/index.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './db';
import { initializeRepo } from './services/git';
import configRoutes from './routes/config';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/config', configRoutes);

// Initialize and start
async function start() {
  try {
    // Initialize database
    initializeDatabase();
    console.log('Database initialized');
    
    // Initialize git repo
    await initializeRepo();
    console.log('Git repository ready');
    
    app.listen(PORT, () => {
      console.log(`ConfigHub API running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
```

## Step 7: Create Sample Configs

Create `config-repo/config/pricing/schema.yaml`:
```yaml
$schema: "http://json-schema.org/draft-07/schema#"
type: object
properties:
  version:
    type: string
    pattern: "^\\d+\\.\\d+\\.\\d+$"
  effectiveDate:
    type: string
    format: date
  rates:
    type: object
    additionalProperties:
      type: object
      properties:
        baseRate:
          type: number
          minimum: 0
        factors:
          type: object
          additionalProperties:
            type: number
      required:
        - baseRate
required:
  - version
  - effectiveDate
  - rates
```

Create `config-repo/config/pricing/motor-rates.yaml`:
```yaml
# Motor Insurance Pricing Configuration
# Last updated: 2025-01-15
# Approved by: Actuarial Committee

version: "1.0.0"
effectiveDate: "2025-01-01"

rates:
  comprehensive:
    baseRate: 450.00
    factors:
      youngDriver: 1.8      # Ages 18-25, higher risk
      namedDriver: 0.95     # Additional named driver discount
      noClaimsBonus: 0.7    # 5+ years no claims
      
  thirdParty:
    baseRate: 280.00
    factors:
      youngDriver: 1.5
      namedDriver: 0.97

# Regional adjustments (multipliers)
regions:
  dublin:
    urban: 1.15
    suburban: 1.05
  cork: 1.02
  rural: 0.92
```

Create `config-repo/config/mulesoft-mappings/schema.yaml`:
```yaml
$schema: "http://json-schema.org/draft-07/schema#"
type: object
properties:
  version:
    type: string
  mappings:
    type: object
    additionalProperties:
      type: string
required:
  - version
  - mappings
```

Create `config-repo/config/mulesoft-mappings/document-events.yaml`:
```yaml
# Document API Event Mappings
# Maps internal event codes to external partner formats

version: "1.0.0"

mappings:
  # Policy lifecycle events
  POLICY_CREATED: PolicyIssuedEvent
  POLICY_RENEWED: PolicyRenewalEvent
  POLICY_CANCELLED: PolicyTerminationEvent
  
  # Claims events
  CLAIM_SUBMITTED: ClaimNotification
  CLAIM_APPROVED: ClaimSettlement
  CLAIM_REJECTED: ClaimDenial
```

## Step 8: Create Root Scripts

Update root `package.json`:
```json
{
  "name": "confighub",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm run dev -w @confighub/api",
    "dev:api": "npm run dev -w @confighub/api",
    "build": "npm run build -w @confighub/api",
    "setup": "npm install && npm run dev:api"
  }
}
```

Create `.env.example`:
```
PORT=4000
DATABASE_PATH=./data/confighub.db
CONFIG_REPO_PATH=./config-repo
JWT_SECRET=change-this-in-production
```

Create `.gitignore`:
```
node_modules/
dist/
data/
.env
*.log
```

## Verification

After building, run:
```bash
npm install
npm run dev
```

Then test:
```bash
# Health check
curl http://localhost:4000/api/health

# List domains
curl http://localhost:4000/api/config/dev

# List keys in pricing domain
curl http://localhost:4000/api/config/dev/pricing

# Get motor rates config
curl http://localhost:4000/api/config/dev/pricing/motor-rates

# Get raw YAML
curl "http://localhost:4000/api/config/dev/pricing/motor-rates?format=yaml"
```

Expected output for motor-rates:
```json
{
  "domain": "pricing",
  "key": "motor-rates",
  "environment": "dev",
  "version": "abc123...",
  "data": {
    "version": "1.0.0",
    "effectiveDate": "2025-01-01",
    "rates": { ... }
  }
}
```

## Done

When all verification passes, Phase 1 is complete. The foundation is ready for Phase 2 (UI + Change Management).
