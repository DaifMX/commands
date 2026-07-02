// config.mjs — load config.yaml (or fall back to the example template).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseYaml } from './yaml.mjs';
import { warn, err } from './log.mjs';

export function loadConfig(repo) {
  let cfgPath = join(repo, 'config.yaml');
  if (!existsSync(cfgPath)) {
    const example = join(repo, 'example.config.yaml');
    if (existsSync(example)) {
      warn('config.yaml not found — falling back to example.config.yaml (copy it to config.yaml to customize)');
      cfgPath = example;
    } else {
      err(`config.yaml not found at ${cfgPath}`);
      process.exit(2);
    }
  }
  const cfg = parseYaml(readFileSync(cfgPath, 'utf8'));
  return {
    cfgPath,
    install: cfg.install || {},
    providers: cfg.providers || {},
    commands: cfg.commands || {},
  };
}
