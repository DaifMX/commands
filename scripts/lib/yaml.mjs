// yaml.mjs — minimal indent-based YAML parser (maps, block/flow lists,
// scalars, comments, quoting). Just enough to read this repo's config.yaml —
// not a general-purpose YAML implementation.

export function parseYaml(text) {
  const lines = [];
  for (let raw of text.split(/\r?\n/)) {
    let inS = false, inD = false, depth = 0, cut = -1;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === "'" && !inD) inS = !inS;
      else if (ch === '"' && !inS) inD = !inD;
      else if (!inS && !inD && (ch === '[' || ch === '{')) depth++;
      else if (!inS && !inD && (ch === ']' || ch === '}')) depth--;
      else if (ch === '#' && !inS && !inD && depth === 0 && (i === 0 || raw[i - 1] === ' ' || raw[i - 1] === '\t')) { cut = i; break; }
    }
    if (cut >= 0) raw = raw.slice(0, cut);
    if (!raw.trim()) continue;
    const indent = raw.length - raw.trimStart().length;
    lines.push({ indent, content: raw.trim() });
  }
  let i = 0;
  function parseBlock(minIndent) {
    if (i >= lines.length || lines[i].indent < minIndent) return null;
    const indent = lines[i].indent;
    if (lines[i].content.startsWith('- ')) {
      const arr = [];
      while (i < lines.length && lines[i].indent === indent && lines[i].content.startsWith('- ')) {
        arr.push(parseScalar(lines[i].content.slice(2).trim()));
        i++;
      }
      return arr;
    }
    const obj = {};
    while (i < lines.length && lines[i].indent === indent) {
      const m = lines[i].content.match(/^([^:]+):\s*(.*)$/);
      if (!m) { i++; continue; }
      const key = m[1].trim();
      const rest = m[2].trim();
      i++;
      if (rest === '') {
        const child = (i < lines.length && lines[i].indent > indent) ? parseBlock(indent + 1) : null;
        obj[key] = child == null ? null : child;
      } else {
        obj[key] = parseScalar(rest);
      }
    }
    return obj;
  }
  function parseScalar(s) {
    if (s.startsWith('[') && s.endsWith(']')) {
      const inner = s.slice(1, -1).trim();
      return inner === '' ? [] : splitFlow(inner).map(parseScalar);
    }
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
      return s.slice(1, -1);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~') return null;
    return s;
  }
  function splitFlow(s) {
    const out = []; let cur = '', inS = false, inD = false;
    for (const ch of s) {
      if (ch === "'" && !inD) inS = !inS;
      else if (ch === '"' && !inS) inD = !inD;
      if (ch === ',' && !inS && !inD) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  return parseBlock(0) || {};
}
