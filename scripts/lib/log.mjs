// log.mjs — console output helpers: ANSI color and leveled log lines.

const useColor = process.stdout.isTTY;
const c = (n, s) => (useColor ? `\x1b[${n}m${s}\x1b[0m` : s);

export const dim = s => c('2', s);
export const bold = s => c('1', s);
export const green = s => c('32', s);
export const yellow = s => c('33', s);
export const red = s => c('31', s);
export const cyan = s => c('36', s);

export const ok = s => console.log(`${green('✓')} ${s}`);
export const info = s => console.log(`${cyan('•')} ${s}`);
export const warn = s => console.log(`${yellow('!')} ${s}`);
export const err = s => console.log(`${red('✗')} ${s}`);
