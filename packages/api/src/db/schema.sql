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
    key_name TEXT,
    operation TEXT NOT NULL DEFAULT 'update' CHECK (operation IN ('update', 'create', 'delete', 'create_domain', 'delete_domain')),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'merged', 'discarded')),
    created_by TEXT NOT NULL REFERENCES users(id),
    reviewed_by TEXT REFERENCES users(id),
    review_comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    merged_at TEXT
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    environment TEXT,
    domain TEXT,
    details TEXT,
    commit_sha TEXT
);

-- Promotion requests
CREATE TABLE IF NOT EXISTS promotion_requests (
    id TEXT PRIMARY KEY,
    source_env TEXT NOT NULL,
    target_env TEXT NOT NULL,
    domain TEXT NOT NULL,
    files TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'promoted', 'failed', 'rolled_back')),
    requested_by TEXT NOT NULL,
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_by TEXT,
    reviewed_at TEXT,
    promoted_at TEXT,
    commit_sha TEXT,
    notes TEXT,
    review_notes TEXT,
    FOREIGN KEY (requested_by) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
