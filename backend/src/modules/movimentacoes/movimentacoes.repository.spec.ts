import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MovimentacoesRepository } from './movimentacoes.repository';
import type { PrismaService } from '../../prisma/prisma.service';

type ProdutoRow = { quantidadeEstoque: number; custoMedio: number };

const makeTx = (produto: ProdutoRow | null) => {
  const calls: string[] = [];
  const tx = {
    $queryRaw: vi.fn(() => {
      calls.push('lock');
      return Promise.resolve([]);
    }),
    produto: {
      findUnique: vi.fn(() => {
        calls.push('read');
        return Promise.resolve(produto);
      }),
      update: vi.fn(() => Promise.resolve({})),
    },
    movimentacao: {
      create: vi.fn(() => Promise.resolve({ id: 1 })),
    },
  };
  return { tx, calls };
};

describe('MovimentacoesRepository.registrar', () => {
  let repo: MovimentacoesRepository;

  beforeEach(() => {
    repo = new MovimentacoesRepository({} as unknown as PrismaService);
  });

  it('trava a linha do produto antes de ler o saldo', async () => {
    const { tx, calls } = makeTx({ quantidadeEstoque: 10, custoMedio: 5 });

    await repo.registrar(
      {
        produtoId: 1,
        tipo: 'SAIDA',
        quantidade: 3,
        custoUnitario: 5,
        motivo: null,
        usuarioId: 1,
      },
      tx as never,
    );

    expect(calls).toEqual(['lock', 'read']);
  });

  it('rejeita saída maior que o saldo sem gravar nada', async () => {
    const { tx } = makeTx({ quantidadeEstoque: 2, custoMedio: 5 });

    await expect(
      repo.registrar(
        {
          produtoId: 1,
          tipo: 'SAIDA',
          quantidade: 3,
          custoUnitario: 5,
          motivo: null,
          usuarioId: 1,
        },
        tx as never,
      ),
    ).rejects.toThrow('ESTOQUE_INSUFICIENTE');

    expect(tx.movimentacao.create).not.toHaveBeenCalled();
    expect(tx.produto.update).not.toHaveBeenCalled();
  });

  it('recalcula o custo médio ponderado na entrada', async () => {
    const { tx } = makeTx({ quantidadeEstoque: 10, custoMedio: 10 });

    await repo.registrar(
      {
        produtoId: 1,
        tipo: 'ENTRADA',
        quantidade: 10,
        custoUnitario: 20,
        motivo: null,
        usuarioId: 1,
      },
      tx as never,
    );

    expect(tx.produto.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantidadeEstoque: 20, custoMedio: 15 },
    });
  });

  it('falha com PRODUTO_NAO_ENCONTRADO quando o produto não existe', async () => {
    const { tx } = makeTx(null);

    await expect(
      repo.registrar(
        {
          produtoId: 9,
          tipo: 'ENTRADA',
          quantidade: 1,
          custoUnitario: 1,
          motivo: null,
          usuarioId: 1,
        },
        tx as never,
      ),
    ).rejects.toThrow('PRODUTO_NAO_ENCONTRADO');
  });
});
