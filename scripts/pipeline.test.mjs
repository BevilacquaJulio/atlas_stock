import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unpinnedActions } from './check-action-pins.mjs';
import { healthUrl } from './deploy-url.mjs';

for (const uses of [
  '- uses: actions/checkout@v7 # checkout do projeto',
  '- uses: "actions/checkout@v7" # comentário com espaços',
  "uses: 'owner/repo/.github/workflows/ci.yml@main'",
  '- uses: docker://alpine:latest',
  '- uses: actions/checkout',
  '- uses: |',
  '- { uses: actions/checkout@v7 }',
]) {
  test(`rejeita ref mutável ou uses inválido: ${uses}`, () => {
    assert.equal(unpinnedActions(uses).length, 1);
  });
}

test('aceita SHA, actions locais, reusable local e imagem com digest', () => {
  const sha = 'a'.repeat(40);
  assert.deepEqual(unpinnedActions(`
    - uses: actions/checkout@${sha} # checkout do projeto
      uses: "owner/repo/path@${sha}" # v1.2.3 comentário livre
      uses: ./.github/workflows/ci.yml # workflow local
    - uses: ./local-action
    - uses: docker://alpine@sha256:${'b'.repeat(64)}
    # uses: owner/repo@main
  `), []);
});

test('informa a linha da action insegura, inclusive com CRLF', () => {
  assert.deepEqual(unpinnedActions('name: CI\r\n  - uses: actions/checkout@v7 # teste de regressão\r\n'), [
    { line: 2, reason: 'actions/checkout@v7 precisa de SHA imutável.' },
  ]);
});

test('monta health URL com e sem barra final', () => {
  assert.equal(healthUrl('https://atlas.example.test/'), 'https://atlas.example.test/api/health/ready');
  assert.equal(healthUrl('https://atlas.example.test', '/api/health/ready'), 'https://atlas.example.test/api/health/ready');
});

for (const url of [undefined, '', 'não é uma URL', 'http://atlas.example.test',
  'https://user:password@atlas.example.test', 'https://atlas.example.test?foo=1', 'https://atlas.example.test/#foo', 'https://atlas.example.test/subpath']) {
  test(`bloqueia APP_URL inválida: ${url}`, () => assert.throws(() => healthUrl(url)));
}

for (const path of ['api/health', '//other.example.test', '/api\\health', '/api/health?x=1', '/api/health#foo']) {
  test(`bloqueia HEALTH_PATH inválido: ${path}`, () => assert.throws(() => healthUrl('https://atlas.example.test', path)));
}
