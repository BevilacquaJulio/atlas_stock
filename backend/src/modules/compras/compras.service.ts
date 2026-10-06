import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ComprasRepository } from './compras.repository';
import { FornecedoresRepository } from '../fornecedores/fornecedores.repository';
import { ProdutosRepository } from '../produtos/produtos.repository';
import { MovimentacoesRepository } from '../movimentacoes/movimentacoes.repository';
import { buildPaginated } from '../../common/dto/pagination.dto';
import type {
  CompraQuery,
  CreateCompraInput,
  PagarCompraInput,
} from './dto/compra.dto';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const compraInclude = {
  fornecedor: { select: { id: true, nomeRazaoSocial: true } },
  usuario: { select: { id: true, nome: true } },
  itens: {
    include: {
      produto: {
        select: { id: true, codigo: true, nome: true, unidadeMedida: true },
      },
    },
  },
  despesa: { select: { id: true, status: true, valor: true } },
} satisfies Prisma.CompraInclude;

@Injectable()
export class ComprasService {
  constructor(
    private readonly repo: ComprasRepository,
    private readonly fornecedoresRepo: FornecedoresRepository,
    private readonly produtosRepo: ProdutosRepository,
    private readonly movimentacoesRepo: MovimentacoesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list({ page, limit, search, status, fornecedorId }: CompraQuery) {
    const where: Prisma.CompraWhereInput = {
      ...(status ? { status } : {}),
      ...(fornecedorId ? { fornecedorId } : {}),
      ...(search
        ? {
            OR: [
              { fornecedor: { nomeRazaoSocial: { contains: search } } },
              { observacoes: { contains: search } },
            ],
          }
        : {}),
    };
    const { data, total } = await this.repo.findMany(
      where,
      (page - 1) * limit,
      limit,
    );
    return buildPaginated(data, total, { page, limit });
  }

  async findOne(id: number) {
    const compra = await this.repo.findById(id);
    if (!compra) throw new NotFoundException('Compra não encontrada.');
    return compra;
  }

  async create(input: CreateCompraInput, usuarioId: number) {
    const fornecedor = await this.fornecedoresRepo.findById(input.fornecedorId);
    if (!fornecedor || !fornecedor.ativo) {
      throw new BadRequestException('Fornecedor inválido ou inativo.');
    }

    for (const item of input.itens) {
      const produto = await this.produtosRepo.findById(item.produtoId);
      if (!produto || !produto.ativo) {
        throw new BadRequestException(
          `Produto #${item.produtoId} inválido ou inativo.`,
        );
      }
    }

    return this.repo.createCompra(
      input,
      usuarioId,
      fornecedor.nomeRazaoSocial,
    );
  }

  /** A_PAGAR → PAGO: registra pagamento da nota (sem entrada no estoque). */
  async pagar(id: number, input: PagarCompraInput, _usuarioId: number) {
    const compra = await this.findOne(id);

    if (compra.status === 'PAGO' || compra.status === 'CONFIRMADA') {
      throw new BadRequestException('Esta compra já está paga.');
    }
    if (compra.status === 'CANCELADA') {
      throw new BadRequestException('Compra cancelada não pode ser paga.');
    }
    if (compra.status !== 'A_PAGAR') {
      throw new BadRequestException('Somente compras a pagar podem ser pagas.');
    }

    const dataPagamento = input.dataPagamento ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.compra.update({
        where: { id },
        data: {
          status: 'PAGO',
          dataPagamento,
          despesa: {
            update: {
              status: 'PAGO',
              dataPagamento,
            },
          },
        },
      });

      return tx.compra.findUniqueOrThrow({
        where: { id },
        include: compraInclude,
      });
    });
  }

  /** PAGO → CONFIRMADA: confirma recebimento e dá entrada no estoque. */
  async confirmar(id: number, usuarioId: number) {
    const compra = await this.findOne(id);

    if (compra.status === 'CONFIRMADA') {
      throw new BadRequestException('Esta compra já está confirmada.');
    }
    if (compra.status !== 'PAGO') {
      throw new BadRequestException(
        'Pague a compra antes de confirmar o recebimento.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of compra.itens) {
        await this.registrarMovimentacao(
          {
            produtoId: item.produtoId,
            tipo: 'ENTRADA',
            quantidade: Number(item.quantidade),
            custoUnitario: Number(item.valorUnitario),
            motivo: `Recebimento — Compra #${compra.id}`,
            usuarioId,
            compraId: compra.id,
          },
          tx,
        );
      }

      await tx.compra.update({
        where: { id },
        data: { status: 'CONFIRMADA' },
      });

      return tx.compra.findUniqueOrThrow({
        where: { id },
        include: compraInclude,
      });
    });
  }

  /** CONFIRMADA → PAGO: estorna recebimento e remove entrada do estoque. */
  async desconfirmar(id: number, usuarioId: number) {
    const compra = await this.findOne(id);

    if (compra.status !== 'CONFIRMADA') {
      throw new BadRequestException(
        'Somente compras confirmadas podem ter o recebimento estornado.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of compra.itens) {
        await this.registrarMovimentacao(
          {
            produtoId: item.produtoId,
            tipo: 'SAIDA',
            quantidade: Number(item.quantidade),
            custoUnitario: Number(item.valorUnitario),
            motivo: `Estorno recebimento — Compra #${compra.id}`,
            usuarioId,
            compraId: compra.id,
          },
          tx,
        );
      }

      await tx.compra.update({
        where: { id },
        data: { status: 'PAGO' },
      });

      return tx.compra.findUniqueOrThrow({
        where: { id },
        include: compraInclude,
      });
    });
  }

  /** PAGO → A_PAGAR: estorna pagamento da nota. */
  async estornarPagamento(id: number) {
    const compra = await this.findOne(id);

    if (compra.status === 'CONFIRMADA') {
      throw new BadRequestException(
        'Desconfirme o recebimento antes de estornar o pagamento.',
      );
    }
    if (compra.status !== 'PAGO') {
      throw new BadRequestException(
        'Somente compras pagas podem ter o pagamento estornado.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.compra.update({
        where: { id },
        data: {
          status: 'A_PAGAR',
          dataPagamento: null,
          despesa: {
            update: {
              status: 'A_PAGAR',
              dataPagamento: null,
            },
          },
        },
      });

      return tx.compra.findUniqueOrThrow({
        where: { id },
        include: compraInclude,
      });
    });
  }

  async cancelar(id: number) {
    const compra = await this.findOne(id);

    if (compra.status === 'CANCELADA') {
      throw new BadRequestException('Esta compra já está cancelada.');
    }
    if (compra.status === 'CONFIRMADA') {
      throw new BadRequestException(
        'Desconfirme o recebimento antes de cancelar.',
      );
    }

    return this.repo.cancelarCompra(id);
  }

  private async registrarMovimentacao(
    params: Parameters<MovimentacoesRepository['registrar']>[0],
    tx: Prisma.TransactionClient,
  ) {
    try {
      await this.movimentacoesRepo.registrar(params, tx);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'ESTOQUE_INSUFICIENTE') {
          throw new BadRequestException(
            'Estoque insuficiente para estornar o recebimento desta compra.',
          );
        }
        if (error.message === 'PRODUTO_NAO_ENCONTRADO') {
          throw new BadRequestException('Produto da compra não encontrado.');
        }
      }
      throw error;
    }
  }
}
