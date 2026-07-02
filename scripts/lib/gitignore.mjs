// gitignore.mjs — commands marked `ignore: true` in config.yaml render into
// an `ignored/` subfolder (source/ignored/, providers/<provider>/ignored/)
// instead of the top level. That means .gitignore never needs a per-command
// entry — but it does need one `providers/<provider>/ignored/` line per
// configured provider, so this keeps that list in sync whenever a provider
// is added or removed.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { info, ok } from './log.mjs';

const BEGIN = '# ── begin ignored-command output (managed by scripts/sync.mjs) ──';
const END = '# ── end ignored-command output ──';

export function syncGitignore(repo, { providers }, apply) {
  const entries = ['source/ignored/', ...Object.keys(providers).sort().map(p => `providers/${p}/ignored/`)];

  const gitignorePath = join(repo, '.gitignore');
  const current = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  const blockRe = new RegExp(`\\n?${escapeRegExp(BEGIN)}[\\s\\S]*?${escapeRegExp(END)}\\n?`);
  const withoutBlock = current.replace(blockRe, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');

  const block = [BEGIN, ...entries, END].join('\n');
  const next = `${withoutBlock.trimEnd()}\n\n${block}\n`;

  if (next === current) { ok('.gitignore up to date'); return { changed: false }; }
  if (apply) {
    writeFileSync(gitignorePath, next);
    info(`.gitignore updated (${entries.length} entries for ignored-command output)`);
  } else {
    info(`.gitignore would be updated (${entries.length} entries for ignored-command output)`);
  }
  return { changed: true };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
