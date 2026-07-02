#!/usr/bin/env node
// sync.mjs — render provider commands from the canonical source/ files.
//
// source/<UPPER-NAME>.md is the single source of truth for a command's content.
// providers/<name>/ is GENERATED OUTPUT: for every command + provider pair
// declared in config.yaml, this script renders source into that provider's
// native format (frontmatter, arg-token, only-blocks) and writes it out.
//
// Adding a new tool (OpenCode, etc.) is a config.yaml edit — add an entry under
// `providers:` — not a code change, as long as it needs only a symlink install
// (directory-wide or per-file) and simple key/value frontmatter.
//
// Zero dependencies — ships its own tiny YAML parser, runs on bare Node (>=16).
// Implementation lives in ./lib/ — this file just wires the phases together.
//
// Usage:
//   node scripts/sync.mjs              # apply: render, prune, relink, report
//   node scripts/sync.mjs --check      # dry run, report only (non-zero exit on drift)
//   node scripts/sync.mjs --prune      # also remove stale per-file install symlinks
//   node scripts/sync.mjs --no-link    # skip the symlink step

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { renderProviders, pruneStaleFiles, rebuildSymlinks } from './lib/steps.mjs';
import { syncGitignore } from './lib/gitignore.mjs';
import { bold, dim, info, warn, ok } from './lib/log.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const opt = {
  check: args.includes('--check'),
  prune: args.includes('--prune'),
  noLink: args.includes('--no-link'),
};
const apply = !opt.check;

const { install, providers, commands } = loadConfig(REPO);

console.log(bold(`\ncommands sync  ${dim(`(repo: ${REPO})`)}`));
console.log(dim(apply ? 'mode: apply' : 'mode: check (dry run)') + '\n');

console.log(bold('Render providers from source/'));
const { staleCount, generatedCount } = renderProviders(REPO, { commands, providers }, apply);

console.log('\n' + bold('Prune stale generated files'));
const { prunedCount } = pruneStaleFiles(REPO, { commands, providers }, apply);

console.log('\n' + bold('Sync .gitignore for ignored-command output'));
syncGitignore(REPO, { providers }, apply);

if (!opt.noLink) {
  console.log('\n' + bold('Rebuild symlinks'));
  rebuildSymlinks(REPO, { commands, providers, install }, apply, opt.prune);
}

console.log('\n' + bold('Summary'));
info(`${Object.keys(commands).length} commands, ${Object.keys(providers).length} providers configured`);
if (apply) {
  if (generatedCount) info(`${generatedCount} file(s) generated/updated`);
  if (prunedCount) info(`${prunedCount} stale file(s) removed`);
} else {
  if (staleCount) warn(`${staleCount} file(s) stale or missing`);
  if (prunedCount) warn(`${prunedCount} file(s) would be pruned`);
}
if (!staleCount && !prunedCount) ok('all provider files up to date with source/');

if (opt.check && (staleCount || prunedCount)) process.exit(1);
