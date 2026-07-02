// symlinks.mjs — create/repoint the symlinks each provider installs from.

import { existsSync, lstatSync, readlinkSync, symlinkSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expand, isSymlink } from './paths.mjs';
import { dim, ok, warn, info } from './log.mjs';

export function ensureDirSymlink(linkPath, target, apply) {
  linkPath = expand(linkPath);
  if (existsSync(linkPath) || isSymlink(linkPath)) {
    const st = lstatSync(linkPath);
    if (st.isSymbolicLink()) {
      const cur = resolve(dirname(linkPath), readlinkSync(linkPath));
      if (cur === target) { ok(`link ${dim(linkPath)} → ${dim(target)} (ok)`); return; }
      if (!apply) { warn(`link ${linkPath} points to ${cur}, expected ${target}`); return; }
      rmSync(linkPath); symlinkSync(target, linkPath); ok(`repointed ${dim(linkPath)} → ${dim(target)}`);
      return;
    }
    warn(`${linkPath} is a real directory, not a symlink — leaving it untouched (move its files aside and re-run, or remove it first)`);
    return;
  }
  if (!apply) { info(`would link ${linkPath} → ${target}`); return; }
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath); ok(`linked ${dim(linkPath)} → ${dim(target)}`);
}

export function ensureFileSymlink(linkPath, target, apply) {
  if (isSymlink(linkPath)) {
    const cur = resolve(dirname(linkPath), readlinkSync(linkPath));
    if (cur === target) return 'ok';
    if (!apply) return 'drift';
    rmSync(linkPath); symlinkSync(target, linkPath); return 'repointed';
  }
  if (existsSync(linkPath)) { warn(`${linkPath} exists and is not a symlink — skipping`); return 'skip'; }
  if (!apply) return 'would';
  symlinkSync(target, linkPath); return 'linked';
}
