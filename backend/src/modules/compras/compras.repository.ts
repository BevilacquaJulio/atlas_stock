import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import type { CreateCompraInput } from './dto/compra.dto';

const compraInclude = {
  fornecedor: { select: { id: true, nomeRazaoSocial: true } },
  usuario: { select: { id: true, nome: true } },
  itens: {
    include: {
      produto: { select: { id: true, codigo: true, nome: true, unidadeMedida: true } },
    },
  },
  despesa: { select: { id: true, status: true, valor: true } },
} satisfies Prisma.CompraInclude;

@Injectable()
export class ComprasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    where: Prisma.CompraWhereInput,
    skip: number,
    take: number,
  ) {
    const [data, total] = await Promise.all([
      this.prisma.compra.findMany({
        where,
        skip,
        take,
        orderBy: { dataCompra: 'desc' },
        include: {
          fornecedor: { select: { id: true, nomeRazaoSocial: true } },
          usuario: { select: { id: true, nome: true } },
          _count: { select: { itens: true } },
        },
      }),
      this.prisma.compra.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: number) {
    return this.prisma.compra.findUnique({
      where: { id },
      include: compraInclude,
    });
  }

  updateStatus(id: number, status: Prisma.CompraUpdateInput['status']) {
    return this.prisma.compra.update({
      where: { id },
      data: { status },
      include: compraInclude,
    });
  }

  cancelarCompra(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.compra.update({
        where: { id },
        data: { status: 'CANCELADA' },
      });

      await tx.despesa.updateMany({
        where: {
          compraId: id,
          status: { in: ['A_PAGAR', 'PAGO'] },
        },
        data: { status: 'CANCELADA', dataPagamento: null },
      });

      return tx.compra.findUniqueOrThrow({
        where: { id },
        include: compraInclude,
      });
    });
  }

  createCompra(
    input: CreateCompraInput,
    usuarioId: number,
    fornecedorNome: string,
  ) {
    const valorTotal = input.itens.reduce(
      (sum, item) => sum + item.quantidade * item.valorUnitario,
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      const compra = await tx.compra.create({
        data: {
          fornecedorId: input.fornecedorId,
          dataCompra: input.dataCompra ?? new Date(),
          valorTotal,
          observacoes: input.observacoes ?? null,
          usuarioId,
          itens: {
            create: input.itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              valorUnitario: item.valorUnitario,
              valorTotal: item.quantidade * item.valorUnitario,
            })),
          },
        },
      });

      await tx.despesa.create({
        data: {
          descricao: `Compra #${compra.id} — ${fornecedorNome}`,
          valor: valorTotal,
          status: 'A_PAGAR',
          dataVencimento: input.dataCompra ?? new Date(),
          fornecedorId: input.fornecedorId,
          compraId: compra.id,
        },
      });

      return tx.compra.findUniqueOrThrow({
        where: { id: compra.id },
        include: compraInclude,
      });
    });
  }
}
