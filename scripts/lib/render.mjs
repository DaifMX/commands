// render.mjs — turn a provider-agnostic source/*.md body into one provider's
// native command file: frontmatter, arg-token substitution, only-blocks.

const yq = s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function stripOnlyBlocks(body, providerKey) {
  return body
    .replace(/<!--\s*only:([a-z0-9,\- ]+)\s*-->([\s\S]*?)<!--\s*\/only\s*-->/gi, (_m, list, inner) => {
      const providers = list.split(',').map(s => s.trim());
      return providers.includes(providerKey) ? inner.replace(/^\n+/, '').replace(/\n+$/, '\n') : '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

function substituteTokens(body, providerKey, provider) {
  return body
    .replaceAll('{{ARGS}}', provider['args-token'] ?? '')
    .replaceAll('{{PROVIDER_DIR}}', `providers/${providerKey}`)
    .replaceAll('{{PROVIDER}}', providerKey);
}

function buildFrontmatter(name, cmdSpec, providerKey, provider) {
  const fields = provider.frontmatter || [];
  const fixed = provider.fixed || {};
  const lines = ['---'];
  for (const field of fields) {
    let value;
    if (field in fixed) value = fixed[field];
    else if (field === 'name') value = name;
    else if (cmdSpec && field in cmdSpec) value = cmdSpec[field];
    else if (field === 'description') value = name;
    else continue; // optional field with no value (e.g. argument-hint) — omit
    lines.push(`${field}: ${yq(value)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

export function renderCommand(name, sourceBody, cmdSpec, providerKey, provider) {
  const body = substituteTokens(stripOnlyBlocks(sourceBody, providerKey), providerKey, provider);
  return buildFrontmatter(name, cmdSpec, providerKey, provider) + '\n' + body;
}
