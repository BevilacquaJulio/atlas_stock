import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ComprasService } from './compras.service';
import type { ComprasRepository } from './compras.repository';
import type { FornecedoresRepository } from '../fornecedores/fornecedores.repository';
import type { ProdutosRepository } from '../produtos/produtos.repository';
import type { MovimentacoesRepository } from '../movimentacoes/movimentacoes.repository';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Garante que cada transição de status é "claim" atômico: o UPDATE condicional
 * (WHERE status = origem) decide quem vence uma corrida, e o perdedor não
 * produz efeitos colaterais (nem estoque, nem despesa).
 */
const compraBase = (status: string) => ({
  id: 1,
  status,
  itens: [{ produtoId: 7, quantidade: 2, valorUnitario: 10 }],
});

const makeTx = (count: number) => ({
  compra: {
    updateMany: vi.fn(() => Promise.resolve({ count })),
    findUniqueOrThrow: vi.fn(() => Promise.resolve({ id: 1 })),
  },
  despesa: {
    updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
  },
});

describe('ComprasService — transições atômicas', () => {
  let comprasRepo: Record<string, ReturnType<typeof vi.fn>>;
  let movimentacoesRepo: { registrar: ReturnType<typeof vi.fn> };
  let tx: ReturnType<typeof makeTx>;
  let service: ComprasService;

  const build = (count: number) => {
    tx = makeTx(count);
    const prisma = {
      $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };
    service = new ComprasService(
      comprasRepo as unknown as ComprasRepository,
      { findById: vi.fn() } as unknown as FornecedoresRepository,
      { findById: vi.fn() } as unknown as ProdutosRepository,
      movimentacoesRepo as unknown as MovimentacoesRepository,
      prisma as unknown as PrismaService,
    );
  };

  beforeEach(() => {
    comprasRepo = {
      findById: vi.fn(),
      cancelarCompra: vi.fn(),
    };
    movimentacoesRepo = { registrar: vi.fn() };
  });

  it('confirmar: perdeu a corrida (count 0) não lança entrada no estoque', async () => {
    comprasRepo.findById.mockResolvedValue(compraBase('PAGO'));
    build(0);

    await expect(service.confirmar(1, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(movimentacoesRepo.registrar).not.toHaveBeenCalled();
  });

  it('confirmar: transição condicional PAGO -> CONFIRMADA e uma entrada por item', async () => {
    comprasRepo.findById.mockResolvedValue(compraBase('PAGO'));
    build(1);

    await service.confirmar(1, 1);

    expect(tx.compra.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'PAGO' },
      data: { status: 'CONFIRMADA' },
    });
    expect(movimentacoesRepo.registrar).toHaveBeenCalledTimes(1);
  });

  it('desconfirmar: perdeu a corrida não lança saída no estoque', async () => {
    comprasRepo.findById.mockResolvedValue(compraBase('CONFIRMADA'));
    build(0);

    await expect(service.desconfirmar(1, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(movimentacoesRepo.registrar).not.toHaveBeenCalled();
  });

  it('pagar: perdeu a corrida não altera a despesa', async () => {
    comprasRepo.findById.mockResolvedValue(compraBase('A_PAGAR'));
    build(0);

    await expect(service.pagar(1, {}, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.despesa.updateMany).not.toHaveBeenCalled();
  });

  it('pagar: transição condicional A_PAGAR -> PAGO e despesa vinculada paga', async () => {
    comprasRepo.findById.mockResolvedValue(compraBase('A_PAGAR'));
    build(1);

    await service.pagar(1, {}, 1);

    expect(tx.compra.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'A_PAGAR' },
      data: expect.objectContaining({ status: 'PAGO' }),
    });
    expect(tx.despesa.updateMany).toHaveBeenCalledWith({
      where: { compraId: 1 },
      data: expect.objectContaining({ status: 'PAGO' }),
    });
  });

  it('estornarPagamento: perdeu a corrida não altera a despesa', async () => {
    comprasRepo.findById.mockResolvedValue(compraBase('PAGO'));
    build(0);

    await expect(service.estornarPagamento(1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.despesa.updateMany).not.toHaveBeenCalled();
  });

  it('cancelar: repositório sem linha afetada vira 400', async () => {
    comprasRepo.findById.mockResolvedValue(compraBase('A_PAGAR'));
    comprasRepo.cancelarCompra.mockResolvedValue(null);
    build(1);

    await expect(service.cancelar(1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
