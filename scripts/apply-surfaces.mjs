import fs from 'node:fs';
import path from 'node:path';

const COMPONENTS_DIR = path.resolve('src/components');

function walkTsxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function transformClassTokensToCfCard(classStr, isClickable = false) {
  const tokens = classStr.trim().split(/\s+/);
  const filtered = tokens.filter((t) => {
    if (t === 'bg-white' || t === 'hover:bg-slate-50/80' || t === 'hover:bg-slate-50') return false;
    if (t === 'border' || t === 'border-2') return false;
    if (/^border-(slate|gray|zinc|neutral|\[\#DCE2E8\])/.test(t)) return false;
    if (/^rounded-(lg|xl|2xl|3xl)$/.test(t)) return false;
    if (/^shadow(-|$)/.test(t)) return false;
    return true;
  });
  const prefix = filtered.includes('cf-card') ? [] : ['cf-card'];
  if (isClickable && !filtered.includes('cf-card-hover')) {
    prefix.push('cf-card-hover');
  }
  return [...prefix, ...filtered].join(' ');
}

function transformDarkTokensToCfCardDark(classStr) {
  const tokens = classStr.trim().split(/\s+/);
  const filtered = tokens.filter((t) => {
    if (t === 'bg-[#0B0F19]' || t === 'bg-[#070B14]' || t === 'bg-slate-900' || t === 'bg-slate-950') return false;
    if (t === 'border') return false;
    if (/^border-slate-(700|800|900)/.test(t)) return false;
    if (/^rounded-(lg|xl|2xl|3xl)$/.test(t)) return false;
    if (/^shadow(-|$)/.test(t)) return false;
    return true;
  });
  const prefix = filtered.includes('cf-card-dark') ? [] : ['cf-card-dark'];
  return [...prefix, ...filtered].join(' ');
}

const files = walkTsxFiles(COMPONENTS_DIR);
const summary = {};

for (const file of files) {
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  let content = raw.replace(/\r\n/g, '\n');
  let count = 0;

  // 1. Match static/template className with bg-white + border + rounded-(lg|xl|2xl|3xl) + p-(3|3.5|4|5|6|7|8)
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLines = lines.slice(Math.max(0, i - 3), i + 1).join(' ');
    if (/<(button|input|select|a|header|footer)\b/.test(prevLines)) continue;
    if (/\b(rounded-full|inline-flex|absolute|fixed)\b/.test(line)) continue;
    if (line.includes('cf-card')) continue;

    if (
      /\bbg-white\b/.test(line) &&
      /\bborder\b/.test(line) &&
      /\brounded-(lg|xl|2xl|3xl)\b/.test(line) &&
      /\bp-(3|3\.5|4|5|6|7|8)\b/.test(line)
    ) {
      const isClickable = /\bonClick\b|\bcursor-pointer\b/.test(prevLines);
      lines[i] = line.replace(
        /className=(?:\{`([^`$]+)|"([^"]+)")/,
        (full, tplCls, strCls) => {
          count++;
          if (tplCls !== undefined) {
            return `className={\`${transformClassTokensToCfCard(tplCls, isClickable)} `;
          }
          return `className="${transformClassTokensToCfCard(strCls, isClickable)}"`;
        }
      );
    }
  }
  content = lines.join('\n');

  // 2. Match large dark panels (bg-[#0B0F19], bg-[#070B14], bg-slate-900, bg-slate-950 with p-4|p-5|p-6|p-7)
  const darkLines = content.split('\n');
  for (let i = 0; i < darkLines.length; i++) {
    const line = darkLines[i];
    const prevLines = darkLines.slice(Math.max(0, i - 3), i + 1).join(' ');
    if (/<(button|input|select|a|header|footer|pre)\b/.test(prevLines)) continue;
    if (/\b(rounded-full|inline-flex|absolute|fixed)\b/.test(line)) continue;
    if (line.includes('cf-card-dark')) continue;

    if (
      /(?:^|\s|["`])(bg-\[\#0B0F19\]|bg-\[\#070B14\]|bg-slate-900|bg-slate-950)(?=\s|["`]|$)/.test(line) &&
      /\bborder\b/.test(line) &&
      /\brounded-(lg|xl|2xl|3xl)\b/.test(line) &&
      /\bp-(4|5|6|7)\b/.test(line)
    ) {
      darkLines[i] = line.replace(
        /className=(?:\{`([^`$]+)|"([^"]+)")/,
        (full, tplCls, strCls) => {
          count++;
          if (tplCls !== undefined) {
            return `className={\`${transformDarkTokensToCfCardDark(tplCls)} `;
          }
          return `className="${transformDarkTokensToCfCardDark(strCls)}"`;
        }
      );
    }
  }
  content = darkLines.join('\n');

  // 3. IntegrityLedgerView artifact seal cards KPI accent
  if (relPath.endsWith('IntegrityLedgerView.tsx')) {
    const sealBefore =
      'className={`cf-card p-5 space-y-3.5 min-w-0 ${';
    const sealAfter =
      'style={{ \'--kpi\': isIntact ? \'#10B981\' : \'#F43F5E\' }}\n                  className={`cf-card cf-kpi p-5 space-y-3.5 min-w-0 ${';
    if (content.includes(sealBefore)) {
      content = content.replace(sealBefore, sealAfter);
      count++;
    }
  }

  if (count > 0) {
    fs.writeFileSync(file, content.split('\n').join(eol), 'utf8');
    summary[relPath] = count;
  }
}

console.log('=== apply-surfaces.mjs pass 2 replacement counts ===');
for (const [f, c] of Object.entries(summary)) {
  console.log(`  ${f}: ${c}`);
}
