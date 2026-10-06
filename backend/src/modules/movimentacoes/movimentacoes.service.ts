import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovimentacoesRepository } from './movimentacoes.repository';
import { ProdutosRepository } from '../produtos/produtos.repository';
import { buildPaginated } from '../../common/dto/pagination.dto';
import type {
  CreateMovimentacaoInput,
  MovimentacaoQuery,
} from './dto/movimentacao.dto';
import type { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class MovimentacoesService {
  constructor(
    private readonly repo: MovimentacoesRepository,
    private readonly produtos: ProdutosRepository,
  ) {}

  async list({ page, limit, produtoId, tipo }: MovimentacaoQuery) {
    const where: Prisma.MovimentacaoWhereInput = {
      ...(produtoId ? { produtoId } : {}),
      ...(tipo ? { tipo } : {}),
    };
    const { data, total } = await this.repo.findMany(
      where,
      (page - 1) * limit,
      limit,
    );
    return buildPaginated(data, total, { page, limit });
  }

  async create(input: CreateMovimentacaoInput, usuarioId: number) {
    const produto = await this.produtos.findById(input.produtoId);
    if (!produto) throw new NotFoundException('Produto não encontrado.');

    // Para ENTRADA sem custo informado, usa o valor unitário do produto.
    const custoUnitario =
      input.custoUnitario ??
      (input.tipo === 'ENTRADA' ? Number(produto.valorUnitario) : Number(produto.custoMedio));

    try {
      return await this.repo.registrar({
        produtoId: input.produtoId,
        tipo: input.tipo,
        quantidade: input.quantidade,
        custoUnitario,
        motivo: input.motivo ?? null,
        usuarioId,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'ESTOQUE_INSUFICIENTE') {
        throw new BadRequestException(
          'Estoque insuficiente para esta saída.',
        );
      }
      throw err;
    }
  }
}
