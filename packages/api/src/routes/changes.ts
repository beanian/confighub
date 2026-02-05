import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbGet, dbAll } from '../db';
import { getGit, envToBranch, getConfig, withGitLock } from '../services/git';
import { logAudit, AuditActions } from '../services/audit';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

const router = Router();

// Get the project root (2 levels up from src/routes/)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REPO_PATH = process.env.CONFIG_REPO_PATH || path.join(PROJECT_ROOT, 'config-repo');

type Operation = 'update' | 'create' | 'delete' | 'create_domain' | 'delete_domain';

interface ChangeRequest {
  id: string;
  branch_name: string;
  target_environment: string;
  domain: string;
  key_name: string | null;
  operation: Operation;
  title: string;
  description: string | null;
  status: string;
  created_by: string;
  reviewed_by: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
}

// List all change requests
router.get('/', async (req: Request, res: Response) => {
  try {
    const changes = await dbAll<ChangeRequest>(`
      SELECT * FROM change_requests
      WHERE status != 'discarded'
      ORDER BY created_at DESC
    `);

    res.json(changes);
  } catch (error) {
    console.error('Error listing changes:', error);
    res.status(500).json({ error: 'Failed to list changes' });
  }
});

// Get single change request
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const change = await dbGet<ChangeRequest>(
      'SELECT * FROM change_requests WHERE id = ?',
      [id]
    );

    if (!change) {
      return res.status(404).json({ error: 'Change request not found' });
    }

    // Get current and proposed content for diff
    let currentContent = '';
    let proposedContent = '';

    try {
      const operation = change.operation || 'update';

      if (operation === 'create_domain') {
        currentContent = '# Domain does not exist';
        proposedContent = `# New domain: ${change.domain}\n# This change will create the domain`;
      } else if (operation === 'delete_domain') {
        currentContent = `# Domain: ${change.domain}\n# Contains configuration files`;
        proposedContent = '# Domain will be deleted';
      } else if (operation === 'delete') {
        const current = await getConfig(
          change.target_environment,
          change.domain,
          change.key_name!
        );
        currentContent = current?.raw || '';
        proposedContent = '# This file will be deleted';
      } else {
        // update or create operations
        if (change.key_name) {
          // For create operation, current content might not exist
          if (operation === 'update') {
            const current = await getConfig(
              change.target_environment,
              change.domain,
              change.key_name
            );
            currentContent = current?.raw || '';
          } else {
            currentContent = '# File does not exist (new config)';
          }

          // Get proposed content from draft branch
          proposedContent = await withGitLock(async () => {
            const g = getGit();
            const currentBranch = (await g.branchLocal()).current;

            try {
              await g.checkout(change.branch_name);
              const proposedPath = path.join(
                REPO_PATH,
                'config',
                change.domain,
                `${change.key_name}.yaml`
              );
              return fs.existsSync(proposedPath)
                ? fs.readFileSync(proposedPath, 'utf-8')
                : '';
            } finally {
              await g.checkout(currentBranch);
            }
          });
        }
      }
    } catch (e) {
      console.error('Error fetching diff content:', e);
    }

    res.json({
      ...change,
      currentContent,
      proposedContent,
    });
  } catch (error) {
    console.error('Error fetching change:', error);
    res.status(500).json({ error: 'Failed to fetch change' });
  }
});

// Create change request
router.post('/', async (req: Request, res: Response) => {
  const { domain, key, targetEnvironment, title, description, content, operation = 'update' } = req.body;
  const userId = (req as any).userId || 'anonymous';

  // Validate operation
  const validOperations: Operation[] = ['update', 'create', 'delete', 'create_domain', 'delete_domain'];
  if (!validOperations.includes(operation)) {
    return res.status(400).json({ error: 'Invalid operation' });
  }

  // Validate YAML for operations that include content
  if (content && (operation === 'update' || operation === 'create')) {
    try {
      yaml.load(content);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid YAML content' });
    }
  }

  const id = uuidv4().slice(0, 8);
  const branchName = `draft/${id}`;

  try {
    await withGitLock(async () => {
      const g = getGit();
      const targetBranch = envToBranch(targetEnvironment);

      // Create branch from target
      await g.checkout(targetBranch);
      await g.checkoutLocalBranch(branchName);

      // Perform operation on branch
      if (operation === 'create_domain') {
        const domainPath = path.join(REPO_PATH, 'config', domain);
        fs.mkdirSync(domainPath, { recursive: true });
        fs.writeFileSync(path.join(domainPath, '.gitkeep'), '');
      } else if (operation === 'delete_domain') {
        const domainPath = path.join(REPO_PATH, 'config', domain);
        if (fs.existsSync(domainPath)) {
          fs.rmSync(domainPath, { recursive: true, force: true });
        }
      } else if (operation === 'delete') {
        const filePath = path.join(REPO_PATH, 'config', domain, `${key}.yaml`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else {
        // update or create - both create the file (and domain if needed)
        const domainPath = path.join(REPO_PATH, 'config', domain);
        const filePath = path.join(domainPath, `${key}.yaml`);

        // Create domain directory if it doesn't exist
        fs.mkdirSync(domainPath, { recursive: true });
        fs.writeFileSync(filePath, content, 'utf-8');

        // Remove .gitkeep if it exists (domain is no longer empty)
        const gitkeepPath = path.join(domainPath, '.gitkeep');
        if (fs.existsSync(gitkeepPath)) {
          fs.unlinkSync(gitkeepPath);
        }
      }

      // Commit
      await g.add('.');
      await g.commit(title);

      // Return to main
      await g.checkout('main');
    });

    // Save to database
    await dbRun(
      `
      INSERT INTO change_requests (id, branch_name, target_environment, domain, key_name, operation, title, description, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `,
      [id, branchName, targetEnvironment, domain, key || null, operation, title, description || null, userId]
    );

    const change = await dbGet<ChangeRequest>(
      'SELECT * FROM change_requests WHERE id = ?',
      [id]
    );

    // Log audit event
    await logAudit(
      userId,
      AuditActions.CHANGE_REQUEST_CREATED,
      'change_request',
      id,
      targetEnvironment,
      domain,
      { title, operation, key: key || null }
    );

    res.status(201).json(change);
  } catch (error) {
    console.error('Error creating change:', error);
    res.status(500).json({ error: 'Failed to create change request' });
  }
});

// Submit for review
router.post('/:id/submit', async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).userId || 'anonymous';

  try {
    await dbRun(
      `
      UPDATE change_requests
      SET status = 'pending_review', updated_at = datetime('now')
      WHERE id = ? AND status = 'draft'
    `,
      [id]
    );

    const change = await dbGet<ChangeRequest>(
      'SELECT * FROM change_requests WHERE id = ?',
      [id]
    );

    if (change) {
      await logAudit(
        userId,
        AuditActions.CHANGE_REQUEST_SUBMITTED,
        'change_request',
        id,
        change.target_environment,
        change.domain,
        { title: change.title }
      );
    }

    res.json(change);
  } catch (error) {
    console.error('Error submitting change:', error);
    res.status(500).json({ error: 'Failed to submit change' });
  }
});

// Approve
router.post('/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { comment } = req.body;
  const userId = (req as any).userId || 'anonymous';

  try {
    await dbRun(
      `
      UPDATE change_requests
      SET status = 'approved', reviewed_by = ?, review_comment = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'pending_review'
    `,
      [userId, comment || null, id]
    );

    const change = await dbGet<ChangeRequest>(
      'SELECT * FROM change_requests WHERE id = ?',
      [id]
    );

    if (change) {
      await logAudit(
        userId,
        AuditActions.CHANGE_REQUEST_APPROVED,
        'change_request',
        id,
        change.target_environment,
        change.domain,
        { title: change.title, comment: comment || null }
      );
    }

    res.json(change);
  } catch (error) {
    console.error('Error approving change:', error);
    res.status(500).json({ error: 'Failed to approve change' });
  }
});

// Reject
router.post('/:id/reject', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { comment } = req.body;
  const userId = (req as any).userId || 'anonymous';

  try {
    await dbRun(
      `
      UPDATE change_requests
      SET status = 'rejected', reviewed_by = ?, review_comment = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'pending_review'
    `,
      [userId, comment, id]
    );

    const change = await dbGet<ChangeRequest>(
      'SELECT * FROM change_requests WHERE id = ?',
      [id]
    );

    if (change) {
      await logAudit(
        userId,
        AuditActions.CHANGE_REQUEST_REJECTED,
        'change_request',
        id,
        change.target_environment,
        change.domain,
        { title: change.title, comment }
      );
    }

    res.json(change);
  } catch (error) {
    console.error('Error rejecting change:', error);
    res.status(500).json({ error: 'Failed to reject change' });
  }
});

// Merge
router.post('/:id/merge', async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).userId || 'anonymous';

  try {
    const change = await dbGet<ChangeRequest>(
      'SELECT * FROM change_requests WHERE id = ?',
      [id]
    );

    if (!change || change.status !== 'approved') {
      return res.status(400).json({ error: 'Change must be approved before merging' });
    }

    let commitSha: string | undefined;

    await withGitLock(async () => {
      const g = getGit();
      const targetBranch = envToBranch(change.target_environment);

      await g.checkout(targetBranch);
      await g.merge([change.branch_name, '--no-ff', '-m', `merge: ${change.title}`]);

      // Get the merge commit SHA
      const log = await g.log({ maxCount: 1 });
      commitSha = log.latest?.hash;

      // Delete draft branch
      await g.deleteLocalBranch(change.branch_name, true);
    });

    // Update status
    await dbRun(
      `
      UPDATE change_requests
      SET status = 'merged', merged_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `,
      [id]
    );

    // Log audit event
    await logAudit(
      userId,
      AuditActions.CHANGE_REQUEST_MERGED,
      'change_request',
      id,
      change.target_environment,
      change.domain,
      { title: change.title, key: change.key_name },
      commitSha || null
    );

    const updated = await dbGet<ChangeRequest>(
      'SELECT * FROM change_requests WHERE id = ?',
      [id]
    );
    res.json(updated);
  } catch (error) {
    console.error('Error merging:', error);
    res.status(500).json({ error: 'Failed to merge change' });
  }
});

// Discard change request
router.post('/:id/discard', async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).userId || 'anonymous';

  try {
    const change = await dbGet<ChangeRequest>(
      'SELECT * FROM change_requests WHERE id = ?',
      [id]
    );

    if (!change) {
      return res.status(404).json({ error: 'Change request not found' });
    }

    if (!['draft', 'pending_review', 'rejected'].includes(change.status)) {
      return res.status(400).json({ error: 'Cannot discard a change that is approved or merged' });
    }

    // Delete the draft branch
    try {
      await withGitLock(async () => {
        const g = getGit();
        const currentBranch = (await g.branchLocal()).current;

        // Make sure we're not on the branch we're trying to delete
        if (currentBranch === change.branch_name) {
          await g.checkout('main');
        }

        await g.deleteLocalBranch(change.branch_name, true);
      });
    } catch (e) {
      console.error('Error deleting branch:', e);
      // Continue even if branch deletion fails (branch might not exist)
    }

    // Update status
    await dbRun(
      `
      UPDATE change_requests
      SET status = 'discarded', updated_at = datetime('now')
      WHERE id = ?
    `,
      [id]
    );

    // Log audit event
    await logAudit(
      userId,
      AuditActions.CHANGE_REQUEST_DISCARDED,
      'change_request',
      id,
      change.target_environment,
      change.domain,
      { title: change.title }
    );

    const updated = await dbGet<ChangeRequest>(
      'SELECT * FROM change_requests WHERE id = ?',
      [id]
    );
    res.json(updated);
  } catch (error) {
    console.error('Error discarding change:', error);
    res.status(500).json({ error: 'Failed to discard change' });
  }
});

export default router;
