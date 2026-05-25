import { homedir } from 'os';
import { isAbsolute, join } from 'path';

export interface KGConfig {
  vaultPath: string;
  dataDir: string;
  dbPath: string;
}

export interface ConfigOverrides {
  vaultPath?: string;
  dataDir?: string;
}

const UNRESOLVED_TEMPLATE = /^\$\{[A-Z0-9_]+\}$/;

/** True when an MCP host left a ${VAR} placeholder unexpanded. */
export function isUnresolvedTemplate(value: string | undefined): boolean {
  return !!value && UNRESOLVED_TEMPLATE.test(value);
}

function resolveEnvValue(value: string | undefined): string | undefined {
  if (!value || isUnresolvedTemplate(value)) return undefined;
  return value;
}

function resolveEnvDataDir(
  value: string | undefined,
  defaultDataDir: string,
): string {
  const resolved = resolveEnvValue(value);
  if (!resolved || !isAbsolute(resolved)) return defaultDataDir;
  return resolved;
}

export function resolveConfig(overrides: ConfigOverrides): KGConfig {
  const xdgData = process.env.XDG_DATA_HOME
    ?? join(homedir(), '.local', 'share');
  const defaultDataDir = join(xdgData, 'knowledge-graph');

  const vaultPath = overrides.vaultPath
    ?? resolveEnvValue(process.env.KG_VAULT_PATH);

  if (!vaultPath) {
    throw new Error(
      'Vault path not configured. Set KG_VAULT_PATH or pass --vault-path.'
    );
  }

  const dataDir = overrides.dataDir
    ?? resolveEnvDataDir(process.env.KG_DATA_DIR, defaultDataDir);

  return {
    vaultPath,
    dataDir,
    dbPath: join(dataDir, 'kg.db'),
  };
}
