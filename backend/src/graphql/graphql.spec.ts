import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ApolloDriver } from '@nestjs/apollo';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import request from 'supertest';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { configureApp } from '../bootstrap/configure-app';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../modules/produtos/produtos.service';
import { CategoriasService } from '../modules/categorias/categorias.service';
import { ComprasService } from '../modules/compras/compras.service';
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

const USUARIO = {
  sub: 7,
  nome: 'Ana',
  email: 'ana@exemplo.com',
  cargo: 'GERENTE',
};

const gql = (app: INestApplication, query: string, token = 'valido') =>
  request(app.getHttpServer())
    .post('/api/graphql')
    .set('Authorization', `Bearer ${token}`)
    .send({ query });

describe('GraphQL (camada de leitura sobre os services do REST)', () => {
  let app: INestApplication;
  const produtos = { list: vi.fn(), findOne: vi.fn() };
  const categorias = { list: vi.fn() };
  const compras = { list: vi.fn(), findOne: vi.fn() };
  const prisma = {
    categoria: { findMany: vi.fn() },
    produto: { groupBy: vi.fn() },
    compraItem: { findMany: vi.fn() },
  };

  const criar = async (production: boolean, maxDepth?: number) => {
    const jwt = {
      verifyAsync: vi.fn((token: string) =>
        token === 'valido'
          ? Promise.resolve(USUARIO)
          : Promise.reject(new Error('invalido')),
      ),
    };
    const config = { get: vi.fn(() => 'segredo') };
    const reflector = new Reflector();

    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          ...buildGraphqlOptions(
            { production, maxDepth },
            prisma as unknown as PrismaService,
          ),
        }),
      ],
      providers: [
        SessaoResolver,
        EstoqueResolver,
        CampoProdutoResolver,
        CampoCategoriaResolver,
        ComprasResolver,
        CampoCompraResolver,
        { provide: ProdutosService, useValue: produtos },
        { provide: CategoriasService, useValue: categorias },
        { provide: ComprasService, useValue: compras },
        { provide: APP_FILTER, useValue: new AllExceptionsFilter() },
        {
          provide: APP_GUARD,
          useValue: new JwtAuthGuard(jwt as never, config as never, reflector),
        },
        { provide: APP_GUARD, useValue: new RolesGuard(reflector) },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app, { production, corsOrigins: [] });
    await app.init();
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('exige autenticação (mesmo guard do REST)', async () => {
    await criar(false);
    const res = await gql(app, '{ me { id } }', 'invalido');
    expect(res.body.data).toBeNull();
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHORIZED');
  });

  it('me devolve o usuário autenticado', async () => {
    await criar(false);
    const res = await gql(app, '{ me { id nome cargo } }');
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.me).toEqual({ id: 7, nome: 'Ana', cargo: 'GERENTE' });
  });

  it('produtos reutiliza o ProdutosService e resolve categorias em lote', async () => {
    produtos.list.mockResolvedValue({
      data: [
        { id: 1, codigo: 'A1', nome: 'P1', categoriaId: 5, ativo: true },
        { id: 2, codigo: 'A2', nome: 'P2', categoriaId: 5, ativo: true },
        { id: 3, codigo: 'A3', nome: 'P3', categoriaId: null, ativo: true },
      ],
      total: 3,
      page: 1,
      limit: 20,
    });
    prisma.categoria.findMany.mockResolvedValue([{ id: 5, nome: 'Vidros' }]);
    await criar(false);

    const res = await gql(
      app,
      '{ produtos { total data { codigo categoria { nome } } } }',
    );

    expect(res.body.errors).toBeUndefined();
    expect(
      res.body.data.produtos.data.map((p: { categoria: unknown }) => p.categoria),
    ).toEqual([{ nome: 'Vidros' }, { nome: 'Vidros' }, null]);
    expect(prisma.categoria.findMany).toHaveBeenCalledTimes(1);
    expect(produtos.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('aplica o mesmo teto de paginação do REST (limit <= 100)', async () => {
    await criar(false);
    const res = await gql(app, '{ produtos(limit: 1000) { total } }');
    expect(res.body.errors[0].extensions.code).toBe('VALIDATION_ERROR');
    expect(produtos.list).not.toHaveBeenCalled();
  });

  it('itens das compras vêm de um único lote, não de N consultas', async () => {
    compras.list.mockResolvedValue({
      data: [
        { id: 1, status: 'A_PAGAR', valorTotal: '10.00' },
        { id: 2, status: 'PAGO', valorTotal: '20.00' },
      ],
      total: 2,
      page: 1,
      limit: 20,
    });
    prisma.compraItem.findMany.mockResolvedValue([
      {
        id: 1,
        compraId: 1,
        quantidade: '2',
        valorUnitario: '5',
        valorTotal: '10',
        produto: { id: 9, nome: 'X', codigo: 'X' },
      },
      {
        id: 2,
        compraId: 2,
        quantidade: '1',
        valorUnitario: '20',
        valorTotal: '20',
        produto: { id: 9, nome: 'X', codigo: 'X' },
      },
    ]);
    await criar(false);

    const res = await gql(
      app,
      '{ compras { data { id valorTotal itens { quantidade produto { nome } } } } }',
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.compras.data[0].itens).toHaveLength(1);
    expect(res.body.data.compras.data[0].valorTotal).toBe('10.00');
    expect(prisma.compraItem.findMany).toHaveBeenCalledTimes(1);
  });

  it('limita a profundidade das consultas', async () => {
    compras.list.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    await criar(false, 5);

    // compras > data > itens > produto > id = 5 níveis (dentro do limite)
    const dentro = await gql(
      app,
      '{ compras { data { itens { produto { id } } } } }',
    );
    expect(dentro.body.errors).toBeUndefined();

    // 6 níveis excede o limite configurado
    const fora = await gql(
      app,
      '{ compras { data { itens { produto { categoria { id } } } } } }',
    );
    expect(fora.body.errors[0].message).toContain('profundidade máxima');
  });

  it('mascara erros internos (sem vazar SQL/stack)', async () => {
    produtos.list.mockRejectedValue(
      new Error('select * from usuarios where senha = secret'),
    );
    await criar(true);
    const res = await gql(app, '{ produtos { total } }');
    expect(res.body.errors[0].message).toBe('Erro interno do servidor.');
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(res.body.errors[0].extensions.stacktrace).toBeUndefined();
  });

  it('desliga introspecção em produção e mantém em desenvolvimento', async () => {
    await criar(true);
    const prod = await gql(app, '{ __schema { queryType { name } } }');
    expect(prod.body.errors).toBeDefined();
    await app.close();

    await criar(false);
    const dev = await gql(app, '{ __schema { queryType { name } } }');
    expect(dev.body.errors).toBeUndefined();
  });

  it('não oferece mutations (escrita fica no REST)', async () => {
    await criar(false);
    const res = await gql(app, 'mutation { x }');
    expect(res.body.errors).toBeDefined();
  });
});
