# ConfigHub — Prompt 4: Impact Analysis & Dependency Graph

You are continuing to build ConfigHub. The app has a working API (Express on :4000), React/TypeScript UI on :3000, git-backed YAML config storage, change requests with approval workflow, environment promotion, and audit logging.

This prompt adds a **dependency registry** and **impact analysis** so users can see which applications consume a config before changing it.

---

## What You're Building

### 1. Dependency Registry

Applications that consume config register themselves with ConfigHub. Add a `dependencies` table:

```sql
CREATE TABLE dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT NOT NULL,              -- e.g. "Motor Pricing Engine"
  app_id TEXT NOT NULL UNIQUE,         -- e.g. "motor-pricing-engine"
  environment TEXT NOT NULL,           -- "dev", "staging", "prod"
  domain TEXT NOT NULL,                -- e.g. "pricing"
  config_keys TEXT NOT NULL,           -- JSON array: ["motor-rates", "home-rates"]
  contact_email TEXT,                  -- team/owner email
  contact_team TEXT,                   -- e.g. "Actuarial Pricing"
  last_heartbeat TEXT,                 -- ISO timestamp, updated on each config fetch
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT                        -- JSON blob for anything else (repo URL, service URL, etc.)
);
```

### 2. Registration & Heartbeat API

```
POST   /api/dependencies                -- Register or update an app's dependencies
GET    /api/dependencies                -- List all (filterable: ?domain=pricing&environment=prod)
GET    /api/dependencies/:appId         -- Get single app's registrations
DELETE /api/dependencies/:appId         -- Deregister an app
GET    /api/config/:env/:domain/:key/consumers  -- List all apps consuming this specific config
```

**POST /api/dependencies** accepts:
```json
{
  "app_name": "Motor Pricing Engine",
  "app_id": "motor-pricing-engine",
  "environment": "prod",
  "domain": "pricing",
  "config_keys": ["motor-rates", "home-rates"],
  "contact_email": "pricing-team@company.ie",
  "contact_team": "Actuarial Pricing",
  "metadata": { "repo": "https://github.com/company/motor-pricing" }
}
```

If `app_id` + `environment` already exists, update it (upsert).

**Heartbeat**: Update `last_heartbeat` every time an app fetches config via `GET /api/config/:env/:domain/:key`. Add a middleware to the existing config read route that does this silently if a `X-ConfigHub-App-Id` header is present.

### 3. Impact Analysis Endpoint

```
GET /api/impact/:env/:domain/:key
```

Returns:
```json
{
  "config": "motor-rates",
  "domain": "pricing",
  "environment": "prod",
  "consumers": [
    {
      "app_name": "Motor Pricing Engine",
      "app_id": "motor-pricing-engine",
      "contact_team": "Actuarial Pricing",
      "contact_email": "pricing-team@company.ie",
      "last_heartbeat": "2026-02-05T10:30:00Z",
      "status": "active"
    }
  ],
  "consumer_count": 1,
  "environments_affected": ["prod"]
}
```

`status` is derived: "active" if heartbeat within last 24 hours, "stale" if 1-7 days, "inactive" if >7 days.

### 4. Impact Warning in Change Request Flow

When a user creates or submits a change request, and when a reviewer views it, the UI must show an **impact panel**:

- Fetch `/api/impact/:env/:domain/:key` for the config being changed
- Display a warning box listing consumers: app name, team, status badge (green/amber/red for active/stale/inactive)
- If there are prod consumers, show a prominent amber banner: "⚠ This config is consumed by {n} production services"
- This panel appears on both the change request creation screen and the review/approval screen

### 5. Impact Panel on Promotion Review

Same concept — when reviewing a promotion request (e.g. staging → prod), show the impact analysis for the **target** environment. The reviewer sees exactly which prod services will be affected by this promotion.

### 6. Dependency Graph Page — `/dependencies`

A dedicated page with two views:

**Table view (default):** All registered apps as rows. Columns: App Name, Environment, Domain, Configs, Team, Last Heartbeat, Status. Sortable and filterable.

**Graph view (toggle):** A simple visual showing configs as nodes on the left and consuming apps as nodes on the right, with edges between them. Group by domain. Use a basic force-directed or bipartite layout — keep it simple, a static SVG or a lightweight library like d3-force is fine. Don't over-engineer this.

### 7. Seed Data

Register three example consumers so the UI isn't empty:

```json
[
  {
    "app_name": "Motor Pricing Engine",
    "app_id": "motor-pricing-engine",
    "environment": "dev",
    "domain": "pricing",
    "config_keys": ["motor-rates"],
    "contact_team": "Actuarial Pricing",
    "contact_email": "pricing@confighub.local"
  },
  {
    "app_name": "MuleSoft Document API",
    "app_id": "mulesoft-doc-api",
    "environment": "dev",
    "domain": "document-events",
    "config_keys": ["event-mappings"],
    "contact_team": "Integration",
    "contact_email": "integration@confighub.local"
  },
  {
    "app_name": "Broker Portal",
    "app_id": "broker-portal",
    "environment": "dev",
    "domain": "pricing",
    "config_keys": ["motor-rates", "home-rates"],
    "contact_team": "Digital",
    "contact_email": "digital@confighub.local"
  }
]
```

---

## UI Integration Summary

- **Change request create/review pages**: Add impact panel showing consumers of the affected config
- **Promotion review page**: Add impact panel for the target environment
- **Dashboard**: Add a "Connected Apps" count card
- **New page `/dependencies`**: Table + graph view of all registered dependencies
- **Nav bar**: Add "Dependencies" link

---

## Verification

```bash
# 1. Register a dependency
curl -X POST http://localhost:4000/api/dependencies \
  -H "Content-Type: application/json" \
  -d '{"app_name":"Test App","app_id":"test-app","environment":"dev","domain":"pricing","config_keys":["motor-rates"],"contact_team":"Test"}'

# 2. Check consumers
curl http://localhost:4000/api/config/dev/pricing/motor-rates/consumers

# 3. Check impact
curl http://localhost:4000/api/impact/dev/pricing/motor-rates

# 4. Heartbeat updates on config fetch
curl http://localhost:4000/api/config/dev/pricing/motor-rates \
  -H "X-ConfigHub-App-Id: test-app"

# 5. UI: Create a change request for motor-rates — should see impact panel
# 6. UI: Visit /dependencies — should see table with seeded apps + graph view
```
