import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const old = 'a'.repeat(40);
const next = 'b'.repeat(40);
const source = readFileSync(new URL('../../deploy/deploy.sh', import.meta.url), 'utf8');

function deploy({ previous = old, fail = '', backup = false, project = 'bl_atlas_stock' } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-deploy-test-'));
  const app = join(directory, 'bl_atlas_stock');
  const bin = join(directory, 'bin');
  mkdirSync(join(app, 'hooks'), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(app, 'compose.yml'), 'name: bl_atlas_stock\n');
  writeFileSync(join(app, '.env'), `DOMAIN=atlas.example.test\n${previous ? `IMAGE_TAG=${previous}\n` : ''}`);
  writeFileSync(join(app, 'hooks/pre-migrate.sh'), '#!/usr/bin/env bash\n[[ "$FAIL" != backup ]]\n', { mode: 0o755 });
  writeFileSync(join(bin, 'flock'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  writeFileSync(join(bin, 'docker'), `#!/usr/bin/env bash
set -euo pipefail
printf '%s tag=%s\\n' "$*" "\${IMAGE_TAG:-}" >> "$TRACE"
case "$*" in
  *'config --services') echo migrate ;;
  *'config --images') printf 'ghcr.io/bevilacquajulio/atlas_stock/api:%s\\nghcr.io/other/toolbox/api:abc\\n' "$IMAGE_TAG" ;;
  *'pull --quiet') [[ "$FAIL" != pull ]] ;;
  *'run --rm -T migrate') [[ "$FAIL" != migrate ]] ;;
  *'up -d'*) [[ "$FAIL" != up || "$IMAGE_TAG" != '${next}' ]] ;;
  'image ls'*) printf 'ghcr.io/bevilacquajulio/atlas_stock/api:${old}\\nghcr.io/bevilacquajulio/atlas_stock/api:${next}\\nghcr.io/bevilacquajulio/atlas_stock/api:${'c'.repeat(40)}\\n' ;;
esac
`, { mode: 0o755 });
  const script = join(directory, 'deploy.sh');
  writeFileSync(script, source.replace('readonly APPS_ROOT="/home/juliobevi/htdocs/bevilabs"', `readonly APPS_ROOT="${directory}"`));
  const trace = join(directory, 'trace');
  try {
    const result = spawnSync('bash', [script, project, 'deploy', next, ...(backup ? ['--backup'] : [])], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TRACE: trace, FAIL: fail, SSH_ORIGINAL_COMMAND: '' },
      encoding: 'utf8', timeout: 10000,
    });
    let calls = '';
    try { calls = readFileSync(trace, 'utf8'); } catch { /* Comando rejeitado antes do Docker. */ }
    return { ...result, calls, environment: readFileSync(join(app, '.env'), 'utf8') };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('pull falha antes de migration e mantém tag anterior', () => {
  const result = deploy({ fail: 'pull' });
  assert.notEqual(result.status, 0);
  assert.ok(!result.calls.includes('run --rm'));
  assert.ok(result.environment.includes(old));
});

test('backup falha e impede migration e up', () => {
  const result = deploy({ fail: 'backup', backup: true });
  assert.notEqual(result.status, 0);
  assert.ok(!result.calls.includes('run --rm'));
  assert.ok(!result.calls.includes('up -d'));
});

test('migration falha e mantém versão anterior', () => {
  const result = deploy({ fail: 'migrate' });
  assert.notEqual(result.status, 0);
  assert.ok(!result.calls.includes('up -d'));
  assert.ok(result.environment.includes(old));
});

test('versão sem saúde restaura imagem anterior', () => {
  const result = deploy({ fail: 'up' });
  assert.notEqual(result.status, 0);
  assert.ok(result.environment.includes(old));
  assert.ok(result.calls.includes(`tag=${old}`));
  assert.match(result.stdout, /rollback concluído/);
});

test('primeiro deploy falho não registra tag como versão anterior', () => {
  const result = deploy({ fail: 'up', previous: '' });
  assert.notEqual(result.status, 0);
  assert.ok(!result.environment.includes('IMAGE_TAG='));
  assert.match(result.stdout, /sem versão anterior/);
});

test('sucesso instala SHA e limpa apenas imagens do Atlas Stock', () => {
  const result = deploy({ backup: true });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.environment.includes(next));
  assert.ok(result.calls.includes('image rm ghcr.io/bevilacquajulio/atlas_stock/api:'));
  assert.ok(!result.calls.includes('prune'));
  assert.ok(!result.calls.includes('image rm ghcr.io/other/'));
  assert.ok(!result.calls.includes('down'));
});

test('executor exclusivo rejeita outro projeto antes de acessar Docker', () => {
  const result = deploy({ project: 'bl_toolbox' });
  assert.notEqual(result.status, 0);
  assert.equal(result.calls, '');
});
