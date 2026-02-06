# ConfigHub API Examples

This document provides practical examples for interacting with the ConfigHub API.

**Base URL:** `https://confighub-production-06ed.up.railway.app`

## Table of Contents

- [Authentication](#authentication)
- [Configuration Operations](#configuration-operations)
- [Change Requests](#change-requests)
- [Promotions](#promotions)
- [Dependencies & Consumer Registration](#dependencies--consumer-registration)
- [Drift Detection](#drift-detection)
- [Audit Log](#audit-log)
- [Config History](#config-history)
- [Health Check](#health-check)
- [Error Responses](#error-responses)

---

## Authentication

### Login

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@confighub.local",
    "password": "admin123"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_default_admin",
    "email": "admin@confighub.local",
    "role": "admin"
  }
}
```

Save the token for subsequent requests:
```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

[Back to top](#table-of-contents)

---

## Configuration Operations

### List Domains

```bash
curl https://confighub-production-06ed.up.railway.app/api/config/dev/domains \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "domains": ["api", "database", "feature-flags"]
}
```

### List Keys in Domain

```bash
curl https://confighub-production-06ed.up.railway.app/api/config/dev/database/keys \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "keys": ["connection", "pool"]
}
```

### Get Configuration

```bash
curl https://confighub-production-06ed.up.railway.app/api/config/dev/database/connection \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "raw": "database:\n  host: localhost\n  port: 5432\n  name: myapp",
  "parsed": {
    "database": {
      "host": "localhost",
      "port": 5432,
      "name": "myapp"
    }
  }
}
```

### Get Config from Different Environments

```bash
# Development
curl https://confighub-production-06ed.up.railway.app/api/config/dev/database/connection \
  -H "Authorization: Bearer $TOKEN"

# Staging
curl https://confighub-production-06ed.up.railway.app/api/config/staging/database/connection \
  -H "Authorization: Bearer $TOKEN"

# Production
curl https://confighub-production-06ed.up.railway.app/api/config/prod/database/connection \
  -H "Authorization: Bearer $TOKEN"
```

[Back to top](#table-of-contents)

---

## Change Requests

### Create a Change Request

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/changes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "database",
    "key": "connection",
    "targetEnvironment": "dev",
    "operation": "update",
    "title": "Increase connection timeout",
    "description": "Bump timeout from 30s to 60s for slow queries",
    "content": "database:\n  host: localhost\n  port: 5432\n  timeout: 60"
  }'
```

**Response:**
```json
{
  "id": "chg_a1b2c3d4",
  "branch_name": "draft/a1b2c3d4",
  "status": "draft",
  "title": "Increase connection timeout",
  "domain": "database",
  "key_name": "connection",
  "target_environment": "dev",
  "operation": "update",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

### Create New Config File

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/changes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api",
    "key": "rate-limits",
    "targetEnvironment": "dev",
    "operation": "create",
    "title": "Add rate limiting config",
    "content": "rate_limits:\n  requests_per_minute: 100\n  burst: 20"
  }'
```

### Submit for Review

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/changes/chg_a1b2c3d4/submit \
  -H "Authorization: Bearer $TOKEN"
```

### List Change Requests

```bash
# All changes
curl https://confighub-production-06ed.up.railway.app/api/changes \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl "https://confighub-production-06ed.up.railway.app/api/changes?status=pending_review" \
  -H "Authorization: Bearer $TOKEN"
```

### Approve a Change

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/changes/chg_a1b2c3d4/approve \
  -H "Authorization: Bearer $TOKEN"
```

### Reject a Change

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/changes/chg_a1b2c3d4/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Please use environment variables for timeout values"
  }'
```

### Merge Approved Change

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/changes/chg_a1b2c3d4/merge \
  -H "Authorization: Bearer $TOKEN"
```

[Back to top](#table-of-contents)

---

## Promotions

### Create Promotion Request

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/promotions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceEnv": "dev",
    "targetEnv": "staging",
    "domain": "database",
    "files": ["connection", "pool"],
    "notes": "Promoting updated database configs after load testing"
  }'
```

**Response:**
```json
{
  "id": "promo_x1y2z3",
  "source_env": "dev",
  "target_env": "staging",
  "domain": "database",
  "files": ["connection", "pool"],
  "status": "pending",
  "requested_by": "usr_default_admin",
  "requested_at": "2024-01-15T11:00:00.000Z"
}
```

### Get Promotion Preview

```bash
curl https://confighub-production-06ed.up.railway.app/api/promotions/promo_x1y2z3/preview \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "files": [
    {
      "file": "connection",
      "sourceContent": "database:\n  host: localhost\n  timeout: 60",
      "targetContent": "database:\n  host: localhost\n  timeout: 30"
    },
    {
      "file": "pool",
      "sourceContent": "pool:\n  size: 20",
      "targetContent": "pool:\n  size: 10"
    }
  ]
}
```

### List Promotions

```bash
# All promotions
curl https://confighub-production-06ed.up.railway.app/api/promotions \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl "https://confighub-production-06ed.up.railway.app/api/promotions?status=pending" \
  -H "Authorization: Bearer $TOKEN"
```

### Approve Promotion

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/promotions/promo_x1y2z3/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "LGTM, tested in dev environment"
  }'
```

### Execute Promotion

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/promotions/promo_x1y2z3/execute \
  -H "Authorization: Bearer $TOKEN"
```

### Rollback Promotion

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/promotions/promo_x1y2z3/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Caused connection issues in staging"
  }'
```

[Back to top](#table-of-contents)

---

## Dependencies & Consumer Registration

Applications register as consumers of ConfigHub configurations so that impact analysis can warn users before changes affect running services.

### Register an App as a Consumer

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/dependencies \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Motor Pricing Engine",
    "app_id": "motor-pricing-engine",
    "environment": "prod",
    "domain": "pricing",
    "config_keys": ["motor-rates", "home-rates"],
    "contact_team": "Pricing Team",
    "contact_email": "pricing@company.com",
    "metadata": {"version": "2.1.0"}
  }'
```

**Response (201 Created):**
```json
{
  "id": "a1b2c3d4-e5f6-...",
  "app_name": "Motor Pricing Engine",
  "app_id": "motor-pricing-engine",
  "environment": "prod",
  "domain": "pricing",
  "config_keys": ["motor-rates", "home-rates"],
  "contact_team": "Pricing Team",
  "contact_email": "pricing@company.com",
  "last_heartbeat": "2026-02-05T14:30:00.000Z",
  "registered_at": "2026-02-05T14:30:00.000Z",
  "metadata": {"version": "2.1.0"}
}
```

> **Note:** If a registration already exists for the same `app_id` + `environment`, the existing record is updated (upsert).

### List All Consumers

```bash
# All registered consumers
curl https://confighub-production-06ed.up.railway.app/api/dependencies \
  -H "Authorization: Bearer $TOKEN"

# Filter by environment
curl "https://confighub-production-06ed.up.railway.app/api/dependencies?environment=prod" \
  -H "Authorization: Bearer $TOKEN"

# Filter by domain
curl "https://confighub-production-06ed.up.railway.app/api/dependencies?domain=pricing" \
  -H "Authorization: Bearer $TOKEN"

# Filter by specific app
curl "https://confighub-production-06ed.up.railway.app/api/dependencies?app_id=motor-pricing-engine" \
  -H "Authorization: Bearer $TOKEN"
```

### Get a Specific App's Registration

```bash
curl https://confighub-production-06ed.up.railway.app/api/dependencies/motor-pricing-engine \
  -H "Authorization: Bearer $TOKEN"

# Filter to a specific environment
curl "https://confighub-production-06ed.up.railway.app/api/dependencies/motor-pricing-engine?environment=prod" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Consumer Summary Counts

```bash
curl https://confighub-production-06ed.up.railway.app/api/dependencies/summary \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "total": 5,
  "dev": 2,
  "staging": 1,
  "prod": 2
}
```

### Send a Heartbeat

Keep your app's status as `active` by sending periodic heartbeats:

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/dependencies/motor-pricing-engine/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"environment": "prod"}'
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-02-05T18:00:00.000Z"
}
```

### Deregister an App

```bash
# Remove from all environments
curl -X DELETE https://confighub-production-06ed.up.railway.app/api/dependencies/motor-pricing-engine \
  -H "Authorization: Bearer $TOKEN"

# Remove from a specific environment
curl -X DELETE "https://confighub-production-06ed.up.railway.app/api/dependencies/motor-pricing-engine?environment=dev" \
  -H "Authorization: Bearer $TOKEN"
```

### Check Impact Analysis

See which consumers are affected by a specific config:

```bash
curl https://confighub-production-06ed.up.railway.app/api/impact/prod/pricing/motor-rates \
  -H "Authorization: Bearer $TOKEN"
```

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

[Back to top](#table-of-contents)

---

## Drift Detection

### Get Full Drift Analysis

```bash
curl https://confighub-production-06ed.up.railway.app/api/drift \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "syncPercentage": 67,
  "domains": [
    {
      "domain": "database",
      "syncPercentage": 50,
      "configs": [
        {
          "key": "connection",
          "status": "drifted",
          "devVsStaging": "different",
          "stagingVsProd": "same"
        },
        {
          "key": "pool",
          "status": "synced",
          "devVsStaging": "same",
          "stagingVsProd": "same"
        }
      ]
    },
    {
      "domain": "api",
      "syncPercentage": 100,
      "configs": [
        {
          "key": "endpoints",
          "status": "synced",
          "devVsStaging": "same",
          "stagingVsProd": "same"
        }
      ]
    }
  ]
}
```

### Get Specific Drift Diff

```bash
# Compare dev vs staging
curl "https://confighub-production-06ed.up.railway.app/api/drift/database/connection/diff?source=dev&target=staging" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "source": "dev",
  "target": "staging",
  "sourceContent": "database:\n  timeout: 60",
  "targetContent": "database:\n  timeout: 30",
  "diff": "@@ -1,2 +1,2 @@\n database:\n-  timeout: 60\n+  timeout: 30"
}
```

[Back to top](#table-of-contents)

---

## Audit Log

### Query Audit Entries

```bash
# Recent entries
curl https://confighub-production-06ed.up.railway.app/api/audit \
  -H "Authorization: Bearer $TOKEN"

# Filter by action
curl "https://confighub-production-06ed.up.railway.app/api/audit?action=change_request.merged" \
  -H "Authorization: Bearer $TOKEN"

# Filter by domain
curl "https://confighub-production-06ed.up.railway.app/api/audit?domain=database" \
  -H "Authorization: Bearer $TOKEN"

# Filter by environment
curl "https://confighub-production-06ed.up.railway.app/api/audit?environment=prod" \
  -H "Authorization: Bearer $TOKEN"

# Date range
curl "https://confighub-production-06ed.up.railway.app/api/audit?from=2024-01-01&to=2024-01-31" \
  -H "Authorization: Bearer $TOKEN"

# Pagination
curl "https://confighub-production-06ed.up.railway.app/api/audit?limit=20&offset=40" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "entries": [
    {
      "id": "aud_123",
      "timestamp": "2024-01-15T12:00:00.000Z",
      "actor": "usr_default_admin",
      "action": "change_request.merged",
      "entity_type": "change_request",
      "entity_id": "chg_a1b2c3d4",
      "environment": "dev",
      "domain": "database",
      "details": {
        "key": "connection",
        "title": "Increase connection timeout"
      },
      "commit_sha": "abc123def456"
    }
  ],
  "total": 150
}
```

[Back to top](#table-of-contents)

---

## Config History

### Get Config History

```bash
curl https://confighub-production-06ed.up.railway.app/api/config/dev/database/connection/history \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "history": [
    {
      "sha": "abc123",
      "message": "Update connection timeout",
      "author": "admin@confighub.local",
      "date": "2024-01-15T10:30:00.000Z"
    },
    {
      "sha": "def456",
      "message": "Initial database config",
      "author": "admin@confighub.local",
      "date": "2024-01-10T09:00:00.000Z"
    }
  ]
}
```

### Get Config at Specific Commit

```bash
curl https://confighub-production-06ed.up.railway.app/api/config/dev/database/connection/history/def456 \
  -H "Authorization: Bearer $TOKEN"
```

### Rollback Config

```bash
curl -X POST https://confighub-production-06ed.up.railway.app/api/config/dev/database/connection/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetSha": "def456",
    "reason": "Reverting timeout change that caused issues"
  }'
```

[Back to top](#table-of-contents)

---

## Health Check

```bash
curl https://confighub-production-06ed.up.railway.app/api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

[Back to top](#table-of-contents)

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400` - Bad request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `500` - Internal server error

[Back to top](#table-of-contents)
