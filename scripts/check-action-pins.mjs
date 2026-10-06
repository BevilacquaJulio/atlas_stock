import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function unpinnedActions(source) {
  const findings = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*(?:-\s*)?(?:uses|"uses"|'uses')\s*:\s*(.*)$/);
    if (!match) {
      if (!line.trimStart().startsWith('#') && /(?:^|[\s{,])(?:uses|"uses"|'uses')\s*:/.test(line)) {
        findings.push({ line: index + 1, reason: 'Use uses em uma propriedade YAML própria para validar seu SHA.' });
      }
      continue;
    }
    const value = match[1].match(/^(?:"([^"\n]+)"|'([^'\n]+)'|([^\s#]+))\s*(?:#.*)?$/);
    if (!value) {
      findings.push({ line: index + 1, reason: 'Formato de uses não reconhecido.' });
      continue;
    }
    const ref = value[1] || value[2] || value[3];
    if (ref.startsWith('./')) continue;
    const pinned = ref.startsWith('docker://')
      ? /^docker:\/\/.+@sha256:[0-9a-f]{64}$/.test(ref)
      : /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[^@\s]+)?@[0-9a-f]{40}$/.test(ref);
    if (!pinned) findings.push({ line: index + 1, reason: `${ref} precisa de SHA imutável.` });
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2);
  if (!files.length) {
    const dir = '.github/workflows';
    files.push(...readdirSync(dir).filter(file => /\.ya?ml$/.test(file)).map(file => join(dir, file)));
  }
  if (!files.length) throw new Error('Nenhum workflow encontrado.');
  let failures = 0;
  for (const file of files) {
    for (const finding of unpinnedActions(readFileSync(file, 'utf8'))) {
      console.error(`${file}:${finding.line}: ${finding.reason}`);
      failures++;
    }
  }
  if (failures) process.exitCode = 1;
  else console.log('Todas as actions remotas estão fixadas por SHA.');
}
