import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';

type RegistrarParams = {
  produtoId: number;
  tipo: 'ENTRADA' | 'SAIDA';
  quantidade: number;
  custoUnitario: number;
  motivo: string | null;
  usuarioId: number;
  compraId?: number;
  projetoId?: number;
};

@Injectable()
export class MovimentacoesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    where: Prisma.MovimentacaoWhereInput,
    skip: number,
    take: number,
  ) {
    const [data, total] = await Promise.all([
      this.prisma.movimentacao.findMany({
        where,
        skip,
        take,
        orderBy: { dataMovimentacao: 'desc' },
        include: {
          produto: { select: { id: true, codigo: true, nome: true } },
          usuario: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.movimentacao.count({ where }),
    ]);
    return { data, total };
  }

  /**
   * Registra a movimentação e ajusta o estoque do produto atomicamente.
   * ENTRADA: soma ao estoque e recalcula o custo médio ponderado.
   * SAIDA: subtrai do estoque (valida saldo).
   * Aceita um client de transação externo para composição com outras operações.
   */
  registrar(params: RegistrarParams, tx?: Prisma.TransactionClient) {
    const run = (client: Prisma.TransactionClient) =>
      this.executarRegistro(client, params);

    if (tx) return run(tx);
    return this.prisma.$transaction(run);
  }

  private async executarRegistro(
    tx: Prisma.TransactionClient,
    params: RegistrarParams,
  ) {
    const {
      produtoId,
      tipo,
      quantidade,
      custoUnitario,
      motivo,
      usuarioId,
      compraId,
      projetoId,
    } = params;

    const produto = await tx.produto.findUnique({ where: { id: produtoId } });
    if (!produto) {
      throw new Error('PRODUTO_NAO_ENCONTRADO');
    }

    const estoqueAtual = Number(produto.quantidadeEstoque);
    const custoMedioAtual = Number(produto.custoMedio);

    let novoEstoque: number;
    let novoCustoMedio = custoMedioAtual;

    if (tipo === 'ENTRADA') {
      novoEstoque = estoqueAtual + quantidade;
      const valorAtual = estoqueAtual * custoMedioAtual;
      const valorEntrada = quantidade * custoUnitario;
      novoCustoMedio =
        novoEstoque > 0
          ? (valorAtual + valorEntrada) / novoEstoque
          : custoUnitario;
    } else {
      if (estoqueAtual < quantidade) {
        throw new Error('ESTOQUE_INSUFICIENTE');
      }
      novoEstoque = estoqueAtual - quantidade;
    }

    const movimentacao = await tx.movimentacao.create({
      data: {
        produtoId,
        tipo,
        quantidade,
        custoUnitario,
        valorTotal: quantidade * custoUnitario,
        motivo,
        usuarioId,
        compraId: compraId ?? null,
        projetoId: projetoId ?? null,
      },
    });

    await tx.produto.update({
      where: { id: produtoId },
      data: {
        quantidadeEstoque: novoEstoque,
        custoMedio: novoCustoMedio,
      },
    });

    return movimentacao;
  }
}
