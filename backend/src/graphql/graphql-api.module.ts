import { ApolloDriver } from '@nestjs/apollo';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriasModule } from '../modules/categorias/categorias.module';
import { ComprasModule } from '../modules/compras/compras.module';
import { ProdutosModule } from '../modules/produtos/produtos.module';
import { buildGraphqlOptions } from './graphql.options';
import {
  CampoCompraResolver,
  ComprasResolver,
} from './resolvers/compras.resolver';
import {
  CampoCategoriaResolver,
  CampoProdutoResolver,
  EstoqueResolver,
} from './resolvers/estoque.resolver';
import { SessaoResolver } from './resolvers/sessao.resolver';

/**
 * Camada GraphQL somente leitura. Não possui regra de negócio própria: os
 * resolvers delegam aos services já usados pelo REST, e os guards globais
 * (JWT, RBAC, throttler) protegem os dois transportes.
 */
@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [PrismaService, ConfigService],
      useFactory: (prisma: PrismaService, config: ConfigService) =>
        buildGraphqlOptions(
          { production: config.get<string>('NODE_ENV') === 'production' },
          prisma,
        ),
    }),
    CategoriasModule,
    ComprasModule,
    ProdutosModule,
  ],
  providers: [
    SessaoResolver,
    EstoqueResolver,
    CampoProdutoResolver,
    CampoCategoriaResolver,
    ComprasResolver,
    CampoCompraResolver,
  ],
})
export class GraphqlApiModule {}
