import DataLoader from 'dataloader';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Loaders por requisição: agrupam as buscas de campos aninhados em uma única
 * consulta por tipo de dado, eliminando o N+1 (ex.: a categoria de cada produto
 * numa listagem de 100 itens vira 1 consulta, não 100).
 *
 * Devem ser criados a cada requisição (cache próprio) — nunca compartilhados.
 */
export function createLoaders(prisma: PrismaService) {
  const categoria = new DataLoader(async (ids: readonly number[]) => {
    const rows = await prisma.categoria.findMany({
      where: { id: { in: [...ids] } },
    });
    const porId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => porId.get(id) ?? null);
  });

  const totalProdutos = new DataLoader(async (ids: readonly number[]) => {
    const grupos = await prisma.produto.groupBy({
      by: ['categoriaId'],
      where: { categoriaId: { in: [...ids] } },
      _count: { _all: true },
    });
    const porId = new Map(grupos.map((g) => [g.categoriaId, g._count._all]));
    return ids.map((id) => porId.get(id) ?? 0);
  });

  const itensPorCompra = new DataLoader(async (ids: readonly number[]) => {
    const itens = await prisma.compraItem.findMany({
      where: { compraId: { in: [...ids] } },
      include: { produto: true },
      orderBy: { id: 'asc' },
    });
    const porCompra = new Map<number, typeof itens>();
    for (const item of itens) {
      const lista = porCompra.get(item.compraId) ?? [];
      lista.push(item);
      porCompra.set(item.compraId, lista);
    }
    return ids.map((id) => porCompra.get(id) ?? []);
  });

  return { categoria, totalProdutos, itensPorCompra };
}

export type Loaders = ReturnType<typeof createLoaders>;
