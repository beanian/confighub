import * as fs from 'fs';
import * as path from 'path';
import { getGit, envToBranch, withGitLock } from './git';
import { createPatch } from 'diff';

// Get the project root (2 levels up from src/services/)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REPO_PATH = process.env.CONFIG_REPO_PATH || path.join(PROJECT_ROOT, 'config-repo');

export interface PromotionFile {
  file: string;
  sourceContent: string;
  targetContent: string | null;
  diff: string;
}

export interface PromotionPreview {
  sourceEnv: string;
  targetEnv: string;
  domain: string;
  files: PromotionFile[];
}

// Get preview of what a promotion will do
export async function getPromotionPreview(
  sourceEnv: string,
  targetEnv: string,
  domain: string,
  files: string[]
): Promise<PromotionPreview> {
  return withGitLock(async () => {
    const g = getGit();
    const currentBranch = (await g.branchLocal()).current;

    const result: PromotionPreview = {
      sourceEnv,
      targetEnv,
      domain,
      files: [],
    };

    try {
      for (const file of files) {
        const fileName = file.endsWith('.yaml') ? file : `${file}.yaml`;
        const filePath = path.join(REPO_PATH, 'config', domain, fileName);

        // Get source content
        await g.checkout(envToBranch(sourceEnv));
        const sourceContent = fs.existsSync(filePath)
          ? fs.readFileSync(filePath, 'utf-8')
          : '';

        // Get target content
        await g.checkout(envToBranch(targetEnv));
        const targetContent = fs.existsSync(filePath)
          ? fs.readFileSync(filePath, 'utf-8')
          : null;

        // Generate diff
        const diff = createPatch(
          `${domain}/${fileName}`,
          targetContent || '',
          sourceContent,
          `${targetEnv}`,
          `${sourceEnv}`
        );

        result.files.push({
          file: fileName,
          sourceContent,
          targetContent,
          diff,
        });
      }
    } finally {
      await g.checkout(currentBranch);
    }

    return result;
  });
}

// Execute a promotion - copy files from source to target environment
export async function executePromotion(
  promotionId: string,
  sourceEnv: string,
  targetEnv: string,
  domain: string,
  files: string[],
  title: string
): Promise<{ commitSha: string }> {
  return withGitLock(async () => {
    const g = getGit();
    const currentBranch = (await g.branchLocal()).current;
    const sourceBranch = envToBranch(sourceEnv);
    const targetBranch = envToBranch(targetEnv);

    try {
      // Read files from source
      await g.checkout(sourceBranch);
      const fileContents: Map<string, string> = new Map();

      for (const file of files) {
        const fileName = file.endsWith('.yaml') ? file : `${file}.yaml`;
        const filePath = path.join(REPO_PATH, 'config', domain, fileName);

        if (fs.existsSync(filePath)) {
          fileContents.set(fileName, fs.readFileSync(filePath, 'utf-8'));
        }
      }

      // Switch to target and write files
      await g.checkout(targetBranch);

      // Ensure domain directory exists
      const domainPath = path.join(REPO_PATH, 'config', domain);
      if (!fs.existsSync(domainPath)) {
        fs.mkdirSync(domainPath, { recursive: true });
      }

      for (const [fileName, content] of fileContents) {
        const filePath = path.join(domainPath, fileName);
        fs.writeFileSync(filePath, content, 'utf-8');
      }

      // Remove .gitkeep if it exists and we're adding real files
      const gitkeepPath = path.join(domainPath, '.gitkeep');
      if (fs.existsSync(gitkeepPath) && fileContents.size > 0) {
        fs.unlinkSync(gitkeepPath);
      }

      // Commit
      const fileList = files.map(f => f.endsWith('.yaml') ? f : `${f}.yaml`).join(', ');
      const commitMessage = `promote: ${domain}/${fileList} ${sourceEnv} → ${targetEnv} [${promotionId}]`;

      await g.add('.');
      await g.commit(commitMessage);

      // Get commit SHA
      const log = await g.log({ maxCount: 1 });
      const commitSha = log.latest?.hash || 'unknown';

      // Create tag
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const tagName = `promote-${targetEnv}-${domain}-${timestamp}`;
      await g.tag([tagName]);

      return { commitSha };
    } finally {
      await g.checkout(currentBranch);
    }
  });
}

// Rollback a promotion - restore files to their state before the promotion
export async function rollbackPromotion(
  promotionId: string,
  targetEnv: string,
  domain: string,
  files: string[],
  originalCommitSha: string,
  reason: string
): Promise<{ commitSha: string }> {
  return withGitLock(async () => {
    const g = getGit();
    const currentBranch = (await g.branchLocal()).current;
    const targetBranch = envToBranch(targetEnv);

    try {
      await g.checkout(targetBranch);

      // For each file, get content from before the promotion commit
      const domainPath = path.join(REPO_PATH, 'config', domain);

      for (const file of files) {
        const fileName = file.endsWith('.yaml') ? file : `${file}.yaml`;
        const filePath = path.join(domainPath, fileName);
        const relativePath = `config/${domain}/${fileName}`;

        try {
          // Get the file content from the parent of the promotion commit
          const content = await g.show([`${originalCommitSha}^:${relativePath}`]);
          fs.writeFileSync(filePath, content, 'utf-8');
        } catch (e) {
          // File didn't exist before promotion, delete it
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }

      // Commit the rollback
      const commitMessage = `rollback promotion ${promotionId}: ${reason}`;
      await g.add('.');
      await g.commit(commitMessage);

      // Get commit SHA
      const log = await g.log({ maxCount: 1 });
      const commitSha = log.latest?.hash || 'unknown';

      return { commitSha };
    } finally {
      await g.checkout(currentBranch);
    }
  });
}

// Rollback a specific config file to a previous commit
export async function rollbackConfig(
  env: string,
  domain: string,
  key: string,
  targetCommit: string,
  reason: string
): Promise<{ commitSha: string }> {
  return withGitLock(async () => {
    const g = getGit();
    const currentBranch = (await g.branchLocal()).current;
    const branch = envToBranch(env);
    const fileName = key.endsWith('.yaml') ? key : `${key}.yaml`;
    const relativePath = `config/${domain}/${fileName}`;
    const filePath = path.join(REPO_PATH, relativePath);

    try {
      await g.checkout(branch);

      // Get file content at the target commit
      const content = await g.show([`${targetCommit}:${relativePath}`]);

      // Write it back
      fs.writeFileSync(filePath, content, 'utf-8');

      // Commit
      const shortSha = targetCommit.substring(0, 7);
      const commitMessage = `rollback: ${domain}/${key} in ${env} to ${shortSha} — ${reason}`;
      await g.add('.');
      await g.commit(commitMessage);

      // Get commit SHA
      const log = await g.log({ maxCount: 1 });
      const commitSha = log.latest?.hash || 'unknown';

      return { commitSha };
    } finally {
      await g.checkout(currentBranch);
    }
  });
}

// Get git history for a specific config file
export async function getConfigHistory(
  env: string,
  domain: string,
  key: string
): Promise<Array<{
  sha: string;
  author: string;
  date: string;
  message: string;
  type: 'merge' | 'promote' | 'rollback' | 'other';
}>> {
  return withGitLock(async () => {
    const g = getGit();
    const currentBranch = (await g.branchLocal()).current;
    const branch = envToBranch(env);
    const fileName = key.endsWith('.yaml') ? key : `${key}.yaml`;
    const filePath = path.join('config', domain, fileName);

    try {
      await g.checkout(branch);

      const log = await g.log({
        file: filePath,
        maxCount: 100,
      });

      return log.all.map((entry) => {
        // Determine type from commit message
        let type: 'merge' | 'promote' | 'rollback' | 'other' = 'other';
        const msg = entry.message.toLowerCase();
        if (msg.startsWith('merge:') || msg.startsWith('merge ')) {
          type = 'merge';
        } else if (msg.startsWith('promote:')) {
          type = 'promote';
        } else if (msg.startsWith('rollback')) {
          type = 'rollback';
        }

        return {
          sha: entry.hash,
          author: entry.author_name,
          date: entry.date,
          message: entry.message,
          type,
        };
      });
    } finally {
      await g.checkout(currentBranch);
    }
  });
}

// Get file content at a specific commit
export async function getConfigAtCommit(
  env: string,
  domain: string,
  key: string,
  commitSha: string
): Promise<string | null> {
  return withGitLock(async () => {
    const g = getGit();
    const currentBranch = (await g.branchLocal()).current;
    const branch = envToBranch(env);
    const fileName = key.endsWith('.yaml') ? key : `${key}.yaml`;
    const relativePath = `config/${domain}/${fileName}`;

    try {
      await g.checkout(branch);
      const content = await g.show([`${commitSha}:${relativePath}`]);
      return content;
    } catch (e) {
      return null;
    } finally {
      await g.checkout(currentBranch);
    }
  });
}
