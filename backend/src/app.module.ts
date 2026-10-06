import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { ProdutosModule } from './modules/produtos/produtos.module';
import { FornecedoresModule } from './modules/fornecedores/fornecedores.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { VeiculosModule } from './modules/veiculos/veiculos.module';
import { MovimentacoesModule } from './modules/movimentacoes/movimentacoes.module';
import { ComprasModule } from './modules/compras/compras.module';
import { ProjetosModule } from './modules/projetos/projetos.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FinanceiroUnlockGuard } from './common/guards/financeiro-unlock.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization'],
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT ?? 120),
      },
    ]),
    PrismaModule,
    AuthModule,
    HealthModule,
    CategoriasModule,
    ProdutosModule,
    FornecedoresModule,
    ClientesModule,
    VeiculosModule,
    MovimentacoesModule,
    ComprasModule,
    ProjetosModule,
    FinanceiroModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FinanceiroUnlockGuard },
  ],
})
export class AppModule {}
