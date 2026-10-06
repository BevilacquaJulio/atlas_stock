import { describe, it, expect, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { createLoaders } from './loaders';

const makePrisma = () => ({
  categoria: {
    findMany: vi.fn(() =>
      Promise.resolve([
        { id: 1, nome: 'A' },
        { id: 2, nome: 'B' },
      ]),
    ),
  },
  produto: {
    groupBy: vi.fn(() =>
      Promise.resolve([{ categoriaId: 1, _count: { _all: 4 } }]),
    ),
  },
  compraItem: {
    findMany: vi.fn(() =>
      Promise.resolve([
        { id: 10, compraId: 1 },
        { id: 11, compraId: 1 },
        { id: 12, compraId: 2 },
      ]),
    ),
  },
});

describe('createLoaders', () => {
  it('categoria: N cargas viram 1 consulta e preservam a ordem das chaves', async () => {
    const prisma = makePrisma();
    const { categoria } = createLoaders(prisma as unknown as PrismaService);

    const result = await Promise.all([
      categoria.load(2),
      categoria.load(1),
      categoria.load(99),
    ]);

    expect(prisma.categoria.findMany).toHaveBeenCalledTimes(1);
    expect(result[0]?.nome).toBe('B');
    expect(result[1]?.nome).toBe('A');
    expect(result[2]).toBeNull();
  });

  it('totalProdutos: 1 groupBy para todas as categorias; ausente vira 0', async () => {
    const prisma = makePrisma();
    const { totalProdutos } = createLoaders(prisma as unknown as PrismaService);

    const result = await Promise.all([
      totalProdutos.load(1),
      totalProdutos.load(2),
    ]);

    expect(prisma.produto.groupBy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([4, 0]);
  });

  it('itensPorCompra: 1 consulta e agrupa por compra', async () => {
    const prisma = makePrisma();
    const { itensPorCompra } = createLoaders(prisma as unknown as PrismaService);

    const [a, b, c] = await Promise.all([
      itensPorCompra.load(1),
      itensPorCompra.load(2),
      itensPorCompra.load(3),
    ]);

    expect(prisma.compraItem.findMany).toHaveBeenCalledTimes(1);
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(1);
    expect(c).toEqual([]);
  });

  it('cada chamada de createLoaders tem cache próprio (por requisição)', async () => {
    const prisma = makePrisma();
    const p = prisma as unknown as PrismaService;
    await createLoaders(p).categoria.load(1);
    await createLoaders(p).categoria.load(1);
    expect(prisma.categoria.findMany).toHaveBeenCalledTimes(2);
  });
});
