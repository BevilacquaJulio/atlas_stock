import { describe, it, expect, afterEach } from 'vitest';
import { Controller, Get, Req } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Request } from 'express';
import { configureApp } from './configure-app';

@Controller('eco')
class EcoController {
  @Get()
  ip(@Req() req: Request) {
    return { ip: req.ip };
  }
}

const criarApp = async (opts: { production: boolean; corsOrigins?: string[] }) => {
  const moduleRef = await Test.createTestingModule({
    controllers: [EcoController],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, {
    production: opts.production,
    corsOrigins: opts.corsOrigins ?? ['http://localhost:5173'],
  });
  await app.init();
  return app;
};

describe('configureApp', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('aplica o prefixo global /api', async () => {
    app = await criarApp({ production: false });
    await request(app.getHttpServer()).get('/api/eco').expect(200);
    await request(app.getHttpServer()).get('/eco').expect(404);
  });

  it('confia no proxy: req.ip vem do X-Forwarded-For (Traefik)', async () => {
    app = await criarApp({ production: true });
    const res = await request(app.getHttpServer())
      .get('/api/eco')
      .set('X-Forwarded-For', '203.0.113.7');
    expect(res.body.ip).toBe('203.0.113.7');
  });

  it('envia cabeçalhos de segurança do Helmet', async () => {
    app = await criarApp({ production: true });
    const res = await request(app.getHttpServer()).get('/api/eco');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('libera CORS só para origens configuradas', async () => {
    app = await criarApp({
      production: true,
      corsOrigins: ['https://app.exemplo.com'],
    });
    const ok = await request(app.getHttpServer())
      .get('/api/eco')
      .set('Origin', 'https://app.exemplo.com');
    expect(ok.headers['access-control-allow-origin']).toBe(
      'https://app.exemplo.com',
    );
    const negado = await request(app.getHttpServer())
      .get('/api/eco')
      .set('Origin', 'https://evil.exemplo.com');
    expect(negado.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('expõe Swagger fora de produção', async () => {
    app = await criarApp({ production: false });
    await request(app.getHttpServer()).get('/api/docs-json').expect(200);
  });

  it('não expõe Swagger em produção', async () => {
    app = await criarApp({ production: true });
    await request(app.getHttpServer()).get('/api/docs-json').expect(404);
    await request(app.getHttpServer()).get('/api/docs').expect(404);
  });
});
