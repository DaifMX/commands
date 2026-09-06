// steps.mjs — the sync phases: render source/ into provider files, prune
// generated output that no longer matches config.yaml, and rebuild the
// install symlinks each tool reads its commands from.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, readlinkSync } from 'node:fs';
import { dirname, join, resolve, basename, relative } from 'node:path';
import { sourcePath, providerDir, providerPath, expand, isSymlink } from './paths.mjs';
import { renderCommand } from './render.mjs';
import { ensureDirSymlink, ensureFileSymlink } from './symlinks.mjs';
import { dim, ok, info, warn, err } from './log.mjs';

const isIgnored = (commands, name) => !!(commands[name] && commands[name].ignore);

// Commands whose `targets:` list includes a given provider (defaults to all
// providers when a command doesn't restrict its targets).
function targetsFor(commands, providerKey, providers) {
  return Object.entries(commands)
    .filter(([, spec]) => ((spec && spec.targets) || Object.keys(providers)).includes(providerKey))
    .map(([name]) => name);
}

// Render every command in config.yaml into every provider format it targets,
// writing anything stale or missing. Returns how many files were out of date
// and how many were (or would be) written.
export function renderProviders(repo, { commands, providers }, apply) {
  let staleCount = 0, generatedCount = 0;

  for (const [name, spec] of Object.entries(commands)) {
    const targets = (spec && spec.targets) || Object.keys(providers);
    const bad = targets.filter(t => !providers[t]);
    if (bad.length) warn(`${name}: unknown provider target(s) ${bad.join(', ')} — skipping those`);
    const valid = targets.filter(t => providers[t]);
    const ignored = isIgnored(commands, name);

    const srcPath = sourcePath(repo, name, ignored);
    if (!existsSync(srcPath)) { err(`${name}: no source file at source/${ignored ? 'ignored/' : ''}${basename(srcPath)}`); continue; }
    const sourceBody = readFileSync(srcPath, 'utf8');

    for (const providerKey of valid) {
      const provider = providers[providerKey];
      const outPath = providerPath(repo, providerKey, provider, name, ignored);
      const rendered = renderCommand(name, sourceBody, spec, providerKey, provider);
      const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;

      if (current === rendered) { ok(`${name} → ${providerKey}: up to date`); continue; }
      staleCount++;
      if (apply) {
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, rendered);
        generatedCount++;
        ok(`${name} → ${providerKey}: ${current === null ? 'generated' : 'updated'}`);
      } else {
        warn(`${name} → ${providerKey}: ${current === null ? 'missing' : 'stale'} (would ${current === null ? 'generate' : 'update'})`);
      }
    }
  }

  return { staleCount, generatedCount };
}

// providers/<name>/ is entirely generated output, so any file there that no
// longer corresponds to a configured command+target (a command removed from
// config.yaml, or a target dropped from a command's `targets:` list) is
// stale and safe to delete outright. Always runs, regardless of --prune.
export function pruneStaleFiles(repo, { commands, providers }, apply) {
  let prunedCount = 0;

  for (const [providerKey, provider] of Object.entries(providers)) {
    const dirTarget = providerDir(repo, providerKey);
    const cmdNames = targetsFor(commands, providerKey, providers);
    const visible = cmdNames.filter(n => !isIgnored(commands, n));
    const ignored = cmdNames.filter(n => isIgnored(commands, n));

    const prune = provider['install-mode'] === 'skill-dirs' ? pruneNestedDir : pruneDir;
    prunedCount += prune(providerKey, dirTarget, provider.ext, visible.map(n => `${n}${provider.ext}`), apply);
    prunedCount += prune(providerKey, join(dirTarget, 'ignored'), provider.ext, ignored.map(n => `${n}${provider.ext}`), apply);
  }

  if (!prunedCount) ok('no stale generated files');
  return { prunedCount };
}

// Removes generated files in `dirTarget` (non-recursive) that no longer
// correspond to a configured command+target. Skips subdirectories (e.g. the
// `ignored/` folder itself, scanned separately with its own expected set).
function pruneDir(providerKey, dirTarget, ext, expectedNames, apply) {
  if (!existsSync(dirTarget)) return 0;
  const expected = new Set(expectedNames);
  let count = 0;

  for (const entry of readdirSync(dirTarget)) {
    const p = join(dirTarget, entry);
    if (statSync(p).isDirectory() || !entry.endsWith(ext) || expected.has(entry)) continue;
    count++;
    if (apply) { rmSync(p); warn(`${providerKey}: removed stale ${dim(entry)} (no longer in config.yaml)`); }
    else warn(`${providerKey}: would remove stale ${entry} (no longer in config.yaml)`);
  }
  return count;
}

// Removes generated skill files whose command directory or SKILL.md no longer
// corresponds to config.yaml. Skill providers render one directory per
// command, so they need a recursive variant of pruneDir.
function pruneNestedDir(providerKey, dirTarget, ext, expectedNames, apply) {
  if (!existsSync(dirTarget)) return 0;
  const expected = new Set(expectedNames);
  let count = 0;

  for (const entry of readdirSync(dirTarget)) {
    const p = join(dirTarget, entry);
    if (entry === 'ignored' && statSync(p).isDirectory()) continue;
    if (statSync(p).isDirectory()) {
      const expectedPath = `${entry}${ext}`;
      if (!expected.has(expectedPath)) {
        count++;
        if (apply) { rmSync(p, { recursive: true }); warn(`${providerKey}: removed stale ${dim(entry)}/ (no longer in config.yaml)`); }
        else warn(`${providerKey}: would remove stale ${entry}/ (no longer in config.yaml)`);
        continue;
      }
      count += pruneSkillTree(providerKey, p, ext, entry, expected, apply);
      if (apply && existsSync(p) && readdirSync(p).length === 0) rmSync(p);
      continue;
    }
    count++;
    if (apply) { rmSync(p); warn(`${providerKey}: removed stale ${dim(entry)} (no longer in config.yaml)`); }
    else warn(`${providerKey}: would remove stale ${entry} (no longer in config.yaml)`);
  }
  return count;
}

function pruneSkillTree(providerKey, dirTarget, ext, relativeDir, expected, apply) {
  let count = 0;
  for (const entry of readdirSync(dirTarget)) {
    const p = join(dirTarget, entry);
    const rel = join(relativeDir, entry);
    if (statSync(p).isDirectory()) {
      count += pruneSkillTree(providerKey, p, ext, rel, expected, apply);
      if (apply && existsSync(p) && readdirSync(p).length === 0) rmSync(p);
    } else if (!expected.has(rel)) {
      count++;
      if (apply) { rmSync(p); warn(`${providerKey}: removed stale ${dim(rel)} (no longer in config.yaml)`); }
      else warn(`${providerKey}: would remove stale ${rel} (no longer in config.yaml)`);
    }
  }
  return count;
}

// Rebuild the symlinks each provider reads its commands from: either one
// symlink for the whole providers/<name>/ directory (install-mode: dir), one
// symlink per command file (install-mode: files), or one symlink per skill
// directory (install-mode: skill-dirs). With --prune, also removes stale
// per-file/per-skill install symlinks for commands no longer configured.
export function rebuildSymlinks(repo, { commands, providers, install }, apply, prune) {
  for (const [providerKey, provider] of Object.entries(providers)) {
    const installTarget = install[providerKey];
    if (!installTarget) { warn(`${providerKey}: no install path configured — skipping symlinks`); continue; }
    const dirTarget = providerDir(repo, providerKey);
    const configuredCmds = targetsFor(commands, providerKey, providers);

    if (provider['install-mode'] === 'dir') {
      ensureDirSymlink(installTarget, dirTarget, apply);
    } else if (provider['install-mode'] === 'files') {
      linkPerFile(repo, providerKey, provider, dirTarget, commands, configuredCmds, expand(installTarget), apply, prune);
    } else if (provider['install-mode'] === 'skill-dirs') {
      linkSkillDirs(repo, providerKey, provider, dirTarget, commands, configuredCmds, expand(installTarget), apply, prune);
    } else {
      warn(`${providerKey}: unknown install-mode ${JSON.stringify(provider['install-mode'])} — skipping symlinks`);
    }
  }
}

function linkPerFile(repo, providerKey, provider, dirTarget, commands, configuredCmds, dest, apply, prune) {
  if (configuredCmds.length && apply) mkdirSync(dest, { recursive: true });

  for (const name of configuredCmds) {
    const target = providerPath(repo, providerKey, provider, name, isIgnored(commands, name));
    if (!existsSync(target)) continue;
    const linkName = `${name}${provider.ext}`;
    const linkPath = join(dest, linkName);
    if (apply) mkdirSync(dirname(linkPath), { recursive: true });
    const r = ensureFileSymlink(linkPath, target, apply);
    if (r === 'linked' || r === 'repointed') ok(`link ${dim(linkName)} → ${dim(providerKey)} (${r})`);
    else if (r === 'ok') ok(`link ${dim(linkName)} (ok)`);
    else if (r === 'drift' || r === 'would') info(`would link ${linkName}`);
  }

  if (!prune || !existsSync(dest)) return;
  const wanted = new Set(configuredCmds.map(n => `${n}${provider.ext}`));
  for (const entry of readdirSync(dest)) {
    if (!entry.endsWith(provider.ext) || wanted.has(entry)) continue;
    const p = join(dest, entry);
    if (!isSymlink(p) || !resolve(dirname(p), readlinkSync(p)).startsWith(dirTarget)) continue;
    if (apply) { rmSync(p); warn(`pruned stale link ${entry}`); }
    else info(`would prune stale link ${entry}`);
  }
}

function linkSkillDirs(repo, providerKey, provider, dirTarget, commands, configuredCmds, dest, apply, prune) {
  if (configuredCmds.length && apply) mkdirSync(dest, { recursive: true });

  for (const name of configuredCmds) {
    const ignored = isIgnored(commands, name);
    const targetFile = providerPath(repo, providerKey, provider, name, ignored);
    if (!existsSync(targetFile)) continue;
    const targetDir = dirname(targetFile);
    const linkName = ignored ? join('ignored', name) : name;
    const linkPath = join(dest, linkName);
    if (apply) mkdirSync(dirname(linkPath), { recursive: true });
    ensureDirSymlink(linkPath, targetDir, apply);
  }

  if (!prune || !existsSync(dest)) return;
  const wanted = new Set(configuredCmds.map(name => isIgnored(commands, name) ? join('ignored', name) : name));
  pruneSkillLinks(dest, dest, dirTarget, wanted, apply);
}

function pruneSkillLinks(root, current, dirTarget, wanted, apply) {
  for (const entry of readdirSync(current)) {
    const p = join(current, entry);
    if (isSymlink(p)) {
      const rel = relative(root, p);
      const target = resolve(dirname(p), readlinkSync(p));
      const inside = target === dirTarget || target.startsWith(`${dirTarget}/`);
      if (inside && !wanted.has(rel)) {
        if (apply) { rmSync(p); warn(`pruned stale skill link ${rel}`); }
        else info(`would prune stale skill link ${rel}`);
      }
    } else if (statSync(p).isDirectory()) {
      pruneSkillLinks(root, p, dirTarget, wanted, apply);
    }
  }
}
