import { Router, Request, Response } from 'express';
import { listDomains, listKeys, getConfig } from '../services/git';
import { createPatch } from 'diff';

const router = Router();

interface ConfigStatus {
  key: string;
  dev: { exists: boolean; hash?: string; lastModified?: string };
  staging: { exists: boolean; hash?: string; lastModified?: string };
  prod: { exists: boolean; hash?: string; lastModified?: string };
  status: 'synced' | 'drifted' | 'partial' | 'dev-only';
  driftDetails?: {
    devVsStaging: 'same' | 'different' | 'missing-source' | 'missing-target';
    stagingVsProd: 'same' | 'different' | 'missing-source' | 'missing-target';
  };
}

interface DomainDrift {
  domain: string;
  configs: ConfigStatus[];
  syncPercentage: number;
  totalConfigs: number;
}

interface DriftAnalysis {
  domains: DomainDrift[];
  summary: {
    totalConfigs: number;
    synced: number;
    drifted: number;
    partial: number;
    devOnly: number;
    overallSyncPercentage: number;
  };
  generatedAt: string;
}

// Simple hash function for comparing content
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// Get full drift analysis
router.get('/', async (req: Request, res: Response) => {
  try {
    const analysis: DriftAnalysis = {
      domains: [],
      summary: {
        totalConfigs: 0,
        synced: 0,
        drifted: 0,
        partial: 0,
        devOnly: 0,
        overallSyncPercentage: 0,
      },
      generatedAt: new Date().toISOString(),
    };

    // Get all domains from dev (source of truth)
    const devDomains = await listDomains('dev');
    const stagingDomains = await listDomains('staging');
    const prodDomains = await listDomains('prod');

    // Combine all unique domains
    const allDomains = [...new Set([...devDomains, ...stagingDomains, ...prodDomains])];

    for (const domain of allDomains) {
      const domainDrift: DomainDrift = {
        domain,
        configs: [],
        syncPercentage: 0,
        totalConfigs: 0,
      };

      // Get all keys from all environments
      const [devKeys, stagingKeys, prodKeys] = await Promise.all([
        listKeys('dev', domain).catch(() => []),
        listKeys('staging', domain).catch(() => []),
        listKeys('prod', domain).catch(() => []),
      ]);

      const allKeys = [...new Set([...devKeys, ...stagingKeys, ...prodKeys])];

      for (const key of allKeys) {
        // Get config from each environment
        const [devConfig, stagingConfig, prodConfig] = await Promise.all([
          getConfig('dev', domain, key).catch(() => null),
          getConfig('staging', domain, key).catch(() => null),
          getConfig('prod', domain, key).catch(() => null),
        ]);

        const configStatus: ConfigStatus = {
          key,
          dev: {
            exists: !!devConfig,
            hash: devConfig ? simpleHash(devConfig.raw) : undefined,
          },
          staging: {
            exists: !!stagingConfig,
            hash: stagingConfig ? simpleHash(stagingConfig.raw) : undefined,
          },
          prod: {
            exists: !!prodConfig,
            hash: prodConfig ? simpleHash(prodConfig.raw) : undefined,
          },
          status: 'synced',
          driftDetails: {
            devVsStaging: 'same',
            stagingVsProd: 'same',
          },
        };

        // Determine drift status
        const devHash = configStatus.dev.hash;
        const stagingHash = configStatus.staging.hash;
        const prodHash = configStatus.prod.hash;

        // Dev vs Staging comparison
        if (!devConfig && !stagingConfig) {
          configStatus.driftDetails!.devVsStaging = 'same';
        } else if (!devConfig) {
          configStatus.driftDetails!.devVsStaging = 'missing-source';
        } else if (!stagingConfig) {
          configStatus.driftDetails!.devVsStaging = 'missing-target';
        } else if (devHash === stagingHash) {
          configStatus.driftDetails!.devVsStaging = 'same';
        } else {
          configStatus.driftDetails!.devVsStaging = 'different';
        }

        // Staging vs Prod comparison
        if (!stagingConfig && !prodConfig) {
          configStatus.driftDetails!.stagingVsProd = 'same';
        } else if (!stagingConfig) {
          configStatus.driftDetails!.stagingVsProd = 'missing-source';
        } else if (!prodConfig) {
          configStatus.driftDetails!.stagingVsProd = 'missing-target';
        } else if (stagingHash === prodHash) {
          configStatus.driftDetails!.stagingVsProd = 'same';
        } else {
          configStatus.driftDetails!.stagingVsProd = 'different';
        }

        // Overall status
        const allSame = devHash === stagingHash && stagingHash === prodHash && devHash !== undefined;
        const devOnlyExists = devConfig && !stagingConfig && !prodConfig;
        const someMissing = [devConfig, stagingConfig, prodConfig].filter(Boolean).length < 3;
        const hasDifferences =
          configStatus.driftDetails!.devVsStaging === 'different' ||
          configStatus.driftDetails!.stagingVsProd === 'different';

        if (allSame) {
          configStatus.status = 'synced';
          analysis.summary.synced++;
        } else if (devOnlyExists) {
          configStatus.status = 'dev-only';
          analysis.summary.devOnly++;
        } else if (hasDifferences) {
          configStatus.status = 'drifted';
          analysis.summary.drifted++;
        } else if (someMissing) {
          configStatus.status = 'partial';
          analysis.summary.partial++;
        }

        domainDrift.configs.push(configStatus);
        analysis.summary.totalConfigs++;
      }

      // Calculate domain sync percentage
      const syncedInDomain = domainDrift.configs.filter(c => c.status === 'synced').length;
      domainDrift.totalConfigs = domainDrift.configs.length;
      domainDrift.syncPercentage = domainDrift.totalConfigs > 0
        ? Math.round((syncedInDomain / domainDrift.totalConfigs) * 100)
        : 100;

      analysis.domains.push(domainDrift);
    }

    // Calculate overall sync percentage
    analysis.summary.overallSyncPercentage = analysis.summary.totalConfigs > 0
      ? Math.round((analysis.summary.synced / analysis.summary.totalConfigs) * 100)
      : 100;

    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing drift:', error);
    res.status(500).json({ error: 'Failed to analyze drift' });
  }
});

// Get detailed diff between environments for a specific config
router.get('/:domain/:key/diff', async (req: Request, res: Response) => {
  const { domain, key } = req.params;
  const { source = 'dev', target = 'staging' } = req.query;

  try {
    const [sourceConfig, targetConfig] = await Promise.all([
      getConfig(source as string, domain, key).catch(() => null),
      getConfig(target as string, domain, key).catch(() => null),
    ]);

    const sourceContent = sourceConfig?.raw || '';
    const targetContent = targetConfig?.raw || '';

    const diff = createPatch(
      `${domain}/${key}.yaml`,
      targetContent,
      sourceContent,
      target as string,
      source as string
    );

    res.json({
      domain,
      key,
      source: source as string,
      target: target as string,
      sourceContent,
      targetContent,
      sourceExists: !!sourceConfig,
      targetExists: !!targetConfig,
      isDifferent: sourceContent !== targetContent,
      diff,
    });
  } catch (error) {
    console.error('Error getting diff:', error);
    res.status(500).json({ error: 'Failed to get diff' });
  }
});

export default router;
