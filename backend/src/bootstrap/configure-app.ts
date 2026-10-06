import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

export interface ConfigureAppOptions {
  /** Em produção o Swagger fica desligado. */
  production: boolean;
  corsOrigins: string[];
}

/**
 * Configuração HTTP compartilhada entre `main.ts` e os testes, para que os
 * testes exercitem o mesmo pipeline de produção.
 */
export function configureApp(
  app: INestApplication,
  { production, corsOrigins }: ConfigureAppOptions,
): void {
  // A API roda atrás do Traefik: sem isto o IP visto (e o rate limit) é o do
  // proxy, e todos os clientes dividem o mesmo balde.
  (app as NestExpressApplication).set('trust proxy', 1);

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigins, credentials: true });

  if (!production) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Atlas Stock API')
      .setDescription('API do ERP de gestão de blindagem de veículos.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }
}
