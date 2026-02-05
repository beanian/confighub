import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

// Get the project root (2 levels up from src/services/)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REPO_PATH = process.env.CONFIG_REPO_PATH || path.join(PROJECT_ROOT, 'config-repo');

let git: SimpleGit | null = null;

// Simple mutex to prevent concurrent git operations
let gitLock: Promise<void> = Promise.resolve();

export async function withGitLock<T>(fn: () => Promise<T>): Promise<T> {
  const previousLock = gitLock;
  let releaseLock: () => void;
  gitLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  try {
    await previousLock;
    return await fn();
  } finally {
    releaseLock!();
  }
}

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
  // Ensure the repo directory exists
  if (!fs.existsSync(REPO_PATH)) {
    fs.mkdirSync(REPO_PATH, { recursive: true });
  }

  const gitDir = path.join(REPO_PATH, '.git');

  if (!fs.existsSync(gitDir)) {
    console.log('Initializing config repository...');

    // Use execSync for initial git init to ensure it creates .git in the right place
    const absPath = path.resolve(REPO_PATH);
    execSync('git init', { cwd: absPath, stdio: 'pipe' });
    execSync('git config user.email "confighub@local"', { cwd: absPath, stdio: 'pipe' });
    execSync('git config user.name "ConfigHub"', { cwd: absPath, stdio: 'pipe' });

    // Reset the cached git instance so it uses the newly initialized repo
    git = null;

    // Create config directory with a README so we have something to commit
    const configPath = path.join(REPO_PATH, 'config');
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
    }
    fs.writeFileSync(path.join(configPath, '.gitkeep'), '# ConfigHub repository\n');

    const g = getGit();

    // Create initial commit
    await g.add('.');
    await g.commit('Initial commit');

    // Rename default branch to main if needed
    const branches = await g.branchLocal();
    if (branches.current && branches.current !== 'main') {
      await g.branch(['-m', branches.current, 'main']);
    }

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
  return withGitLock(async () => {
    const g = getGit();
    const branch = envToBranch(env);
    const filePath = path.join(REPO_PATH, 'config', domain, `${key}.yaml`);

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
      if (currentBranch && currentBranch !== branch) {
        await g.checkout(currentBranch);
      }
    }
  });
}

// List all keys in a domain for an environment
export async function listKeys(env: string, domain: string): Promise<string[]> {
  return withGitLock(async () => {
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
      if (currentBranch && currentBranch !== branch) {
        await g.checkout(currentBranch);
      }
    }
  });
}

// List all domains
export async function listDomains(env: string): Promise<string[]> {
  return withGitLock(async () => {
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
      if (currentBranch && currentBranch !== branch) {
        await g.checkout(currentBranch);
      }
    }
  });
}

// Create a new domain
export async function createDomain(env: string, domain: string): Promise<void> {
  const g = getGit();
  const branch = envToBranch(env);
  const domainPath = path.join(REPO_PATH, 'config', domain);

  const currentBranch = (await g.branchLocal()).current;

  try {
    await g.checkout(branch);

    if (fs.existsSync(domainPath)) {
      throw new Error(`Domain '${domain}' already exists`);
    }

    fs.mkdirSync(domainPath, { recursive: true });

    // Create a .gitkeep to track empty directory
    fs.writeFileSync(path.join(domainPath, '.gitkeep'), '');

    await g.add('.');
    await g.commit(`Create domain: ${domain}`);
  } finally {
    if (currentBranch !== branch) {
      await g.checkout(currentBranch);
    }
  }
}

// Delete a domain
export async function deleteDomain(env: string, domain: string): Promise<void> {
  const g = getGit();
  const branch = envToBranch(env);
  const domainPath = path.join(REPO_PATH, 'config', domain);

  const currentBranch = (await g.branchLocal()).current;

  try {
    await g.checkout(branch);

    if (!fs.existsSync(domainPath)) {
      throw new Error(`Domain '${domain}' does not exist`);
    }

    fs.rmSync(domainPath, { recursive: true, force: true });

    await g.add('.');
    await g.commit(`Delete domain: ${domain}`);
  } finally {
    if (currentBranch !== branch) {
      await g.checkout(currentBranch);
    }
  }
}

// Create a new config key
export async function createKey(
  env: string,
  domain: string,
  key: string,
  content: string
): Promise<void> {
  const g = getGit();
  const branch = envToBranch(env);
  const domainPath = path.join(REPO_PATH, 'config', domain);
  const filePath = path.join(domainPath, `${key}.yaml`);

  const currentBranch = (await g.branchLocal()).current;

  try {
    await g.checkout(branch);

    // Create domain if it doesn't exist
    if (!fs.existsSync(domainPath)) {
      fs.mkdirSync(domainPath, { recursive: true });
    }

    if (fs.existsSync(filePath)) {
      throw new Error(`Key '${key}' already exists in domain '${domain}'`);
    }

    // Validate YAML
    yaml.load(content);

    fs.writeFileSync(filePath, content, 'utf-8');

    // Remove .gitkeep if it exists
    const gitkeepPath = path.join(domainPath, '.gitkeep');
    if (fs.existsSync(gitkeepPath)) {
      fs.unlinkSync(gitkeepPath);
    }

    await g.add('.');
    await g.commit(`Create config: ${domain}/${key}`);
  } finally {
    if (currentBranch !== branch) {
      await g.checkout(currentBranch);
    }
  }
}

// Delete a config key
export async function deleteKey(env: string, domain: string, key: string): Promise<void> {
  const g = getGit();
  const branch = envToBranch(env);
  const filePath = path.join(REPO_PATH, 'config', domain, `${key}.yaml`);

  const currentBranch = (await g.branchLocal()).current;

  try {
    await g.checkout(branch);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Key '${key}' does not exist in domain '${domain}'`);
    }

    fs.unlinkSync(filePath);

    await g.add('.');
    await g.commit(`Delete config: ${domain}/${key}`);
  } finally {
    if (currentBranch !== branch) {
      await g.checkout(currentBranch);
    }
  }
}
