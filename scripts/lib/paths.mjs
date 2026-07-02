// paths.mjs — filesystem path helpers for the source/ → providers/ layout.

import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const expand = p => (p.startsWith('~') ? join(homedir(), p.slice(1)) : p);

// `ignore: true` commands (config.yaml) render into an `ignored/` subfolder
// instead of the top level, so a single static .gitignore pattern covers
// them regardless of which commands are flagged.
export const sourcePath = (repo, name, ignored) =>
  join(repo, 'source', ...(ignored ? ['ignored'] : []), `${name.toUpperCase()}.md`);
export const providerDir = (repo, providerKey) => join(repo, 'providers', providerKey);
export const providerPath = (repo, providerKey, provider, name, ignored) =>
  join(providerDir(repo, providerKey), ...(ignored ? ['ignored'] : []), `${name}${provider.ext}`);

export function isSymlink(p) {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}
