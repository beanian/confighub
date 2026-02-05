# ConfigHub — Prompt 3: Environment Promotion & History

You are continuing to build ConfigHub, a GitOps-based configuration management platform for a retail insurance company in Ireland. Prompts 1 and 2 are already complete — you have a working monorepo with:
- **API** (Express on :4000): config read API, auth (JWT), change request CRUD with submit/approve/reject/merge workflow
- **UI** (React/TypeScript on :3000): login, dashboard, config browser with Monaco editor, diff viewer, change request list and review flow
- **Git-backed storage**: local git repo with `dev/`, `staging/`, `prod/` folders, configs stored as YAML
- **SQLite database**: users, sessions, change_requests tables

This prompt adds **environment promotion**, **rollback**, and **full audit history**.

---

## What You're Building

### 1. Environment Promotion Pipeline

Configs flow through environments: **dev → staging → prod**. Each promotion is an explicit action with its own approval gate.

**How it works:**
- When a change request is merged, it lands in `dev` (the default target environment)
- A user can then "promote" a config (or set of configs) from dev → staging, and staging → prod
- Each promotion creates a **promotion request** — similar to a change request but specifically for cross-environment movement
- Promotions require approval from a user with `approver` role (same as change requests)
- When approved, the system copies the config file(s) from the source environment folder to the target environment folder in git, commits, and tags
- A user cannot self-approve their own promotion request

**Git mechanics:**
```
# Promotion from dev → staging for pricing/motor-rates.yaml:
# 1. Read file from configs/dev/pricing/motor-rates.yaml
# 2. Write identical content to configs/staging/pricing/motor-rates.yaml
# 3. Commit with message: "promote: pricing/motor-rates.yaml dev → staging [PR-42]"
# 4. Tag: promote-staging-pricing-motor-rates-{timestamp}
```

**Batch promotions:** Users can select multiple configs from the same domain to promote together as a single promotion request. The commit includes all files.

### 2. Promotion Request Data Model

Add a `promotion_requests` table to SQLite:

```sql
CREATE TABLE promotion_requests (
  id TEXT PRIMARY KEY,           -- "PR-" + incrementing number
  source_env TEXT NOT NULL,      -- "dev" or "staging"  
  target_env TEXT NOT NULL,      -- "staging" or "prod"
  domain TEXT NOT NULL,          -- e.g. "pricing"
  files TEXT NOT NULL,           -- JSON array of file paths, e.g. ["motor-rates.yaml","home-rates.yaml"]
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | promoted | failed
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  promoted_at TEXT,
  commit_sha TEXT,               -- git commit SHA after promotion
  notes TEXT,                    -- requester's notes explaining why
  review_notes TEXT,             -- reviewer's notes
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
```

### 3. Promotion API Routes

Add to the existing Express API under `/api/promotions`:

```
POST   /api/promotions                  -- Create promotion request
GET    /api/promotions                  -- List all (filterable: ?status=pending&target_env=prod)
GET    /api/promotions/:id              -- Get single with full detail
POST   /api/promotions/:id/approve      -- Approve (cannot self-approve)
POST   /api/promotions/:id/reject       -- Reject with review_notes
POST   /api/promotions/:id/execute      -- Execute approved promotion (does the git copy+commit)
GET    /api/promotions/:id/preview      -- Returns diff between source and target env for each file
```

**Preview endpoint is critical:** Before approving, reviewers need to see what's actually changing in the target environment. The preview should return, for each file:
- The current content in the target env (or "new file" if it doesn't exist there yet)
- The content being promoted from the source env
- A unified diff between them

### 4. Audit History

Add an `audit_log` table:

```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,           -- user ID
  action TEXT NOT NULL,          -- e.g. "change_request.created", "promotion.approved", "config.rollback"
  entity_type TEXT NOT NULL,     -- "change_request", "promotion", "config"
  entity_id TEXT,                -- the ID of the thing acted on
  environment TEXT,              -- which env was affected
  domain TEXT,                   -- which config domain
  details TEXT,                  -- JSON blob with action-specific data
  commit_sha TEXT                -- associated git commit if applicable
);
```

**Log these events:**
- `change_request.created`, `.submitted`, `.approved`, `.rejected`, `.merged`
- `promotion.created`, `.approved`, `.rejected`, `.executed`, `.failed`
- `config.rollback` (see below)
- `auth.login`, `auth.logout`

Add audit logging as middleware/helper — every existing change request route should also write audit entries. Retrofit the change request routes from Prompt 2 to log events.

**Audit API routes:**

```
GET /api/audit                           -- List audit entries (paginated, filterable)
GET /api/audit/config/:env/:domain/:key  -- History for a specific config file
GET /api/audit/user/:userId              -- All actions by a specific user
```

### 5. Rollback

Two types of rollback:

**a) Config rollback (revert a specific file to a previous version):**
```
POST /api/config/:env/:domain/:key/rollback
Body: { "target_commit": "abc123", "reason": "Rate increase caused issues" }
```
- Checks out the file content at the specified commit
- Writes it back as a new commit (not a git revert — we want forward-only history)
- Commit message: "rollback: {domain}/{key} in {env} to {commit_sha_short} — {reason}"
- Creates an audit log entry

**b) Promotion rollback (undo a specific promotion):**
```
POST /api/promotions/:id/rollback
Body: { "reason": "Staging rates not validated yet" }
```
- Looks up the promotion request to find which files were promoted and to which env
- For each file, restores the content from the commit BEFORE the promotion commit
- Creates a new commit: "rollback promotion PR-42: {reason}"
- Sets promotion status to "rolled_back"
- Creates audit log entries

### 6. Config History API

```
GET /api/config/:env/:domain/:key/history
```

Returns the git log for a specific config file — all commits that touched it, with:
- Commit SHA
- Author
- Timestamp
- Commit message
- Whether it was a merge, promotion, or rollback (parse from commit message prefix)

This powers the history timeline in the UI.

---

## UI Components to Build

### 6.1 Environment Switcher (Global)

Add an environment selector to the top navigation bar — a segmented control or tab group showing `DEV | STAGING | PROD`. This controls which environment the config browser shows. Highlight the active environment:
- **Dev**: default, blue accent
- **Staging**: amber/orange accent  
- **Prod**: red accent (subtle — conveys "careful here")

The existing config browser should respect this selection. When switching environments, the file tree and config preview update.

### 6.2 Promotion Flow Page — `/promotions`

A dedicated page with two sections:

**Top section — "Promote Configs":**
- Source environment selector (dev or staging)
- Target automatically set (dev→staging or staging→prod)
- Domain dropdown
- Checklist of config files in that domain (fetched from the source env)
- User ticks the files to promote, adds a note, clicks "Create Promotion Request"

**Bottom section — "Promotion Requests":**
- Table of all promotion requests with columns: ID, Direction (e.g. "dev → staging"), Domain, Files, Status, Requested By, Date
- Filter tabs: All | Pending | Approved | Promoted
- Click a row to open the promotion detail view

### 6.3 Promotion Detail / Review Page — `/promotions/:id`

Shows:
- Header with promotion ID, status badge, direction (dev → staging), domain
- Requester info and notes
- **For each file being promoted:** a diff view showing current target env content vs incoming source env content (use the same diff component from Prompt 2)
- If status is `pending`: Approve / Reject buttons (hidden if the viewer is the requester — no self-approval)
- If status is `approved`: "Execute Promotion" button
- If status is `promoted`: "Rollback" button with reason field
- Timeline of status changes at the bottom

### 6.4 Audit Log Page — `/audit`

Full-width table with:
- Timestamp (relative, e.g. "2 hours ago" with full date on hover)
- Actor (user display name)
- Action (human-readable, e.g. "Approved promotion PR-42")
- Environment badge
- Domain
- Link to the related entity (change request or promotion)

**Filters:** date range picker, action type multi-select, environment, domain, user
**Search:** free text search across action descriptions

Design this as a dense, information-rich table — think Bloomberg terminal aesthetic. Monospace timestamps, tight rows, alternating subtle row shading. This is a power-user screen.

### 6.5 Config History Timeline — integrated into config detail view

When viewing a specific config in the browser, add a "History" tab alongside the existing YAML preview. The history tab shows:
- A vertical timeline of all changes to that file
- Each entry shows: commit SHA (abbreviated, monospace), timestamp, author, action type icon (merge, promotion, rollback), commit message
- Clicking an entry loads that version into the Monaco viewer (read-only)
- "Rollback to this version" button on each historical entry (opens confirmation modal with reason field)

### 6.6 Dashboard Updates

Update the existing dashboard to include:
- A new stats card: "Pending Promotions" count
- A "Recent Promotions" feed alongside the existing "Recent Changes" feed
- Quick action button: "Promote to Staging" / "Promote to Prod"
- Environment health summary: for each env, show last updated timestamp and total config count

---

## Design Direction

Continue the established aesthetic from Prompt 2 (JetBrains Mono for code, IBM Plex Sans for UI, dark sidebar, blue accent). Extend it with:

- **Environment color coding**: Dev = blue (#3B82F6), Staging = amber (#F59E0B), Prod = red (#EF4444). Use these as subtle accents on badges, borders, and the environment switcher — not as backgrounds.
- **The promotion flow** should feel like a pipeline — consider a horizontal stepper or flow diagram showing the config's journey: dev → staging → prod with status indicators at each stage.
- **Audit log** should feel dense and powerful — tight line-height, monospace where appropriate, maximum information density. This is the "flight recorder" of the system.
- **History timeline** — vertical with subtle connecting lines, commit SHAs in monospace, icons differentiating merges/promotions/rollbacks.
- **Confirmation modals** for destructive actions (rollback, prod promotion) should feel weighty — larger than normal, with a clear description of impact and a required reason field.

---

## Implementation Notes

1. **Retrofit audit logging**: Go back through the existing change request routes and add audit log entries. Use a helper function like `logAudit(actor, action, entityType, entityId, env, domain, details, commitSha)` to keep it clean.

2. **Git operations for promotion**: Use simple-git. The promotion is: read file from source path, write to target path, git add, git commit with structured message, git tag.

3. **Diff for promotion preview**: Use the `diff` npm package (same as Prompt 2) to generate unified diffs between the source and target file contents.

4. **No self-approval**: The API must enforce that `reviewed_by !== requested_by` for promotions. Return 403 if a user tries to approve their own promotion.

5. **Forward-only git history**: Rollbacks create new commits (writing the old content forward), never rewrite history. This preserves the full audit trail.

6. **Pagination**: The audit log will grow fast. Implement cursor-based pagination on `/api/audit` routes from the start. Default page size: 50.

7. **Commit message conventions**: Use prefixes so the history API can classify entries:
   - `merge: ...` — change request merge
   - `promote: ...` — environment promotion  
   - `rollback: ...` — any rollback
   - `rollback promotion PR-X: ...` — promotion-specific rollback

---

## Verification

After building, verify these flows work end to end:

```bash
# 1. Environment switcher works
# - Login, switch to DEV → see configs
# - Switch to STAGING → may be empty or different
# - Switch to PROD → may be empty or different

# 2. Promotion flow
# - Go to Promotions page
# - Select dev → staging, pick pricing domain
# - Select motor-rates.yaml, add a note
# - Create promotion request
# - See the preview diff
# - (Log in as different user or skip self-approval check for testing)
# - Approve the promotion
# - Execute it
# - Switch to STAGING env — motor-rates.yaml should now be there

# 3. Audit trail
# - Go to Audit page
# - See entries for: login, promotion created, promotion approved, promotion executed
# - Filter by environment, by user

# 4. Config history
# - Browse to a config that has been changed/promoted
# - Click History tab
# - See timeline of commits
# - Click an older version — see it in the viewer
# - Click "Rollback to this version" — confirm — new commit created

# 5. Promotion rollback
# - Go to a promoted promotion request
# - Click Rollback, enter reason
# - Verify the target env file reverted
# - Check audit log shows the rollback

# 6. API verification
curl http://localhost:4000/api/promotions
curl http://localhost:4000/api/audit?limit=10
curl http://localhost:4000/api/config/dev/pricing/motor-rates/history
```

---

## File Structure Additions

```
packages/
  api/
    src/
      routes/
        promotions.ts        -- promotion request CRUD + approve/reject/execute/rollback
        audit.ts             -- audit log query routes  
        config.ts            -- ADD: history and rollback endpoints to existing
      services/
        promotion.service.ts -- git operations for promotion + rollback
        audit.service.ts     -- audit logging helper + query functions
      db/
        migrations/
          003-promotions.sql -- promotion_requests table
          004-audit-log.sql  -- audit_log table
  ui/
    src/
      pages/
        Promotions.tsx       -- promotion list + create form
        PromotionDetail.tsx  -- review, approve, execute, rollback
        AuditLog.tsx         -- full audit log with filters
      components/
        EnvironmentSwitcher.tsx  -- global env selector for nav bar
        PromotionPipeline.tsx    -- visual pipeline (dev→staging→prod)
        ConfigHistory.tsx        -- timeline component for config detail
        RollbackModal.tsx        -- confirmation modal with reason field
```
