import 'reflect-metadata';
import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  configureApp(app, {
    production: config.get<string>('NODE_ENV') === 'production',
    corsOrigins: config
      .get<string>('CORS_ORIGIN', 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim()),
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  new NestLogger('Bootstrap').log(`API rodando em http://0.0.0.0:${port}/api`);
}

void bootstrap();
