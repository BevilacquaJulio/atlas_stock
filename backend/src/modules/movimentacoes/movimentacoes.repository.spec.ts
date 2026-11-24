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

  const estorno = (quantidade: number, custoUnitario: number) => ({
    produtoId: 1,
    tipo: 'SAIDA' as const,
    quantidade,
    custoUnitario,
    motivo: null,
    usuarioId: 1,
    estornoEntrada: true,
  });

  it('estorno de recebimento devolve o custo médio anterior à compra', async () => {
    // 10 un a R$10 + entrada de 10 a R$20 = 20 un a R$15; estorno volta a R$10.
    const { tx } = makeTx({ quantidadeEstoque: 20, custoMedio: 15 });

    await repo.registrar(estorno(10, 20), tx as never);

    expect(tx.produto.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantidadeEstoque: 10, custoMedio: 10 },
    });
  });

  it('estorno preserva o efeito de uma saída intermediária', async () => {
    // Após receber (20 un a R$15), saem 5 a R$15: 15 un, R$225. Estorno de 10 a R$20.
    const { tx } = makeTx({ quantidadeEstoque: 15, custoMedio: 15 });

    await repo.registrar(estorno(10, 20), tx as never);

    expect(tx.produto.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantidadeEstoque: 5, custoMedio: 5 },
    });
  });

  it('estorno que zera o saldo ou deixaria valor negativo mantém o custo corrente', async () => {
    const zerado = makeTx({ quantidadeEstoque: 10, custoMedio: 20 });
    await repo.registrar(estorno(10, 20), zerado.tx as never);
    expect(zerado.tx.produto.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantidadeEstoque: 0, custoMedio: 20 },
    });

    const negativo = makeTx({ quantidadeEstoque: 12, custoMedio: 15 });
    await repo.registrar(estorno(10, 20), negativo.tx as never);
    expect(negativo.tx.produto.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantidadeEstoque: 2, custoMedio: 15 },
    });
  });

  it('saída operacional comum mantém o custo médio', async () => {
    const { tx } = makeTx({ quantidadeEstoque: 20, custoMedio: 15 });

    await repo.registrar(
      { ...estorno(10, 20), estornoEntrada: false },
      tx as never,
    );

    expect(tx.produto.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantidadeEstoque: 10, custoMedio: 15 },
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
