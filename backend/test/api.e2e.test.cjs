const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const bcrypt = require('bcryptjs');

// A suite cria dados: recusa qualquer banco que não seja o banco descartável da CI.
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.MYSQL_DATABASE, 'atlas_stock_ci');
assert.equal(process.env.MYSQL_HOST, '127.0.0.1');
const { PrismaService } = require('../dist/src/prisma/prisma.service.js');
const prisma = new PrismaService();
const marker = `ci-${process.pid}-${Date.now()}`;
const email = `${marker}@example.test`;
const password = 'ci-test-password-only';
const port = process.env.PORT || '3100';
const base = `http://127.0.0.1:${port}/api`;
let server;
let output = '';
let userId;
let categoryId;
let accessToken;

async function request(route, options = {}) {
  return fetch(`${base}${route}`, {
    ...options,
    signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
}

before(async () => {
  await prisma.$connect();
  const user = await prisma.usuario.create({ data: {
    nome: 'CI Admin', email, senha: await bcrypt.hash(password, 10), cargo: 'ADMINISTRADOR',
  } });
  userId = user.id;
  server = spawn(process.execPath, ['dist/src/main.js'], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: port },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', (data) => { output = (output + data.toString()).slice(-8000); });
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`API não iniciou: ${output}`);
    try { if ((await request('/health/ready')).ok) return; } catch { /* Aguarda o bootstrap. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timeout iniciando API: ${output}`);
}, { timeout: 45000 });

after(async () => {
  if (server && server.exitCode === null) {
    const stopped = new Promise((resolve) => server.once('exit', resolve));
    server.kill('SIGTERM');
    await stopped;
  }
  if (categoryId) await prisma.categoria.deleteMany({ where: { id: categoryId } });
  if (userId) await prisma.usuario.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

test('fluxo HTTP com API compilada e MySQL real', { timeout: 30000 }, async (t) => {
  await t.test('health público e banco pronto', async () => {
    assert.equal((await request('/health')).status, 200);
    const response = await request('/health/ready');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).database, 'up');
  });
  await t.test('rota protegida rejeita acesso sem token', async () => {
    assert.equal((await request('/categorias')).status, 401);
  });
  await t.test('login rejeita credenciais incorretas', async () => {
    const response = await request('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, senha: 'incorrect' }),
    });
    assert.equal(response.status, 401);
  });
  await t.test('login autentica usuário real', async () => {
    const response = await request('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, senha: password }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.id, userId);
    assert.equal(body.user.senha, undefined);
    assert.ok(body.accessToken);
    accessToken = body.accessToken;
  });
  await t.test('cria e consulta categoria persistida', async () => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const created = await request('/categorias', {
      method: 'POST', headers, body: JSON.stringify({ nome: marker }),
    });
    assert.equal(created.status, 201);
    categoryId = (await created.json()).id;
    const response = await request(`/categorias/${categoryId}`, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).nome, marker);
    assert.ok(await prisma.categoria.findUnique({ where: { id: categoryId } }));
  });
});
