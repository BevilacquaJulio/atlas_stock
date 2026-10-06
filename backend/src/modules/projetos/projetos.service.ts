import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjetosRepository } from './projetos.repository';
import { ClientesRepository } from '../clientes/clientes.repository';
import { VeiculosRepository } from '../veiculos/veiculos.repository';
import { ProdutosRepository } from '../produtos/produtos.repository';
import { MovimentacoesRepository } from '../movimentacoes/movimentacoes.repository';
import { buildPaginated } from '../../common/dto/pagination.dto';
import type {
  AlterarStatusProjetoInput,
  CreateChecklistItemInput,
  CreateConsumoInput,
  CreateProjetoInput,
  ProjetoQuery,
  UpdateChecklistItemInput,
  UpdateProjetoInput,
} from './dto/projeto.dto';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjetosService {
  constructor(
    private readonly repo: ProjetosRepository,
    private readonly clientesRepo: ClientesRepository,
    private readonly veiculosRepo: VeiculosRepository,
    private readonly produtosRepo: ProdutosRepository,
    private readonly movimentacoesRepo: MovimentacoesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list({ page, limit, search, status, clienteId, ativo }: ProjetoQuery) {
    const where: Prisma.ProjetoWhereInput = {
      ...(status ? { status } : {}),
      ...(clienteId ? { clienteId } : {}),
      ...(ativo !== undefined ? { ativo } : {}),
      ...(search
        ? {
            OR: [
              { cliente: { nomeCompleto: { contains: search } } },
              { veiculo: { placa: { contains: search } } },
              { descricao: { contains: search } },
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
    const projeto = await this.repo.findById(id);
    if (!projeto) throw new NotFoundException('Projeto não encontrado.');
    return projeto;
  }

  async create(input: CreateProjetoInput, usuarioId: number) {
    const cliente = await this.clientesRepo.findById(input.clienteId);
    if (!cliente || !cliente.ativo) {
      throw new BadRequestException('Cliente inválido ou inativo.');
    }

    const veiculo = await this.veiculosRepo.findById(input.veiculoId);
    if (!veiculo || !veiculo.ativo) {
      throw new BadRequestException('Veículo inválido ou inativo.');
    }
    if (veiculo.clienteId !== input.clienteId) {
      throw new BadRequestException(
        'O veículo não pertence ao cliente informado.',
      );
    }

    return this.repo.create(input, usuarioId);
  }

  async update(id: number, input: UpdateProjetoInput) {
    const projeto = await this.findOne(id);
    if (projeto.status === 'CANCELADO') {
      throw new BadRequestException(
        'Projetos cancelados não podem ser editados.',
      );
    }
    return this.repo.update(id, input);
  }

  async alterarStatus(
    id: number,
    input: AlterarStatusProjetoInput,
    usuarioId: number,
  ) {
    const projeto = await this.findOne(id);

    if (projeto.status === 'CANCELADO') {
      throw new BadRequestException('Projeto cancelado não pode mudar de status.');
    }
    if (projeto.status === 'CONCLUIDO' && input.status !== 'CONCLUIDO') {
      throw new BadRequestException(
        'Projeto concluído não pode voltar a outro status.',
      );
    }
    if (input.status === projeto.status) {
      throw new BadRequestException('O projeto já está neste status.');
    }

    const dataInicio =
      input.status === 'EM_ANDAMENTO' && !projeto.dataInicio
        ? new Date()
        : undefined;
    const dataConclusao =
      input.status === 'CONCLUIDO' || input.status === 'CANCELADO'
        ? new Date()
        : undefined;

    return this.repo.updateStatus(id, {
      status: input.status,
      statusAnterior: projeto.status,
      observacao: input.observacao ?? null,
      usuarioId,
      dataInicio,
      dataConclusao,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.repo.softDelete(id);
  }

  async addChecklistItem(id: number, input: CreateChecklistItemInput) {
    const projeto = await this.findOne(id);
    if (projeto.status === 'CANCELADO' || projeto.status === 'CONCLUIDO') {
      throw new BadRequestException(
        'Não é possível alterar checklist de projeto encerrado.',
      );
    }
    return this.repo.addChecklistItem(id, input);
  }

  async updateChecklistItem(
    projetoId: number,
    itemId: number,
    input: UpdateChecklistItemInput,
  ) {
    const projeto = await this.findOne(projetoId);
    if (projeto.status === 'CANCELADO' || projeto.status === 'CONCLUIDO') {
      throw new BadRequestException(
        'Não é possível alterar checklist de projeto encerrado.',
      );
    }

    const item = await this.repo.findChecklistItem(itemId, projetoId);
    if (!item) {
      throw new NotFoundException('Item de checklist não encontrado.');
    }

    return this.repo.updateChecklistItem(itemId, input);
  }

  async removeChecklistItem(projetoId: number, itemId: number) {
    const projeto = await this.findOne(projetoId);
    if (projeto.status === 'CANCELADO' || projeto.status === 'CONCLUIDO') {
      throw new BadRequestException(
        'Não é possível alterar checklist de projeto encerrado.',
      );
    }

    const item = await this.repo.findChecklistItem(itemId, projetoId);
    if (!item) {
      throw new NotFoundException('Item de checklist não encontrado.');
    }

    await this.repo.deleteChecklistItem(itemId);
  }

  async registrarConsumo(
    projetoId: number,
    input: CreateConsumoInput,
    usuarioId: number,
  ) {
    const projeto = await this.findOne(projetoId);

    if (projeto.status === 'CANCELADO') {
      throw new BadRequestException(
        'Não é possível registrar consumo em projeto cancelado.',
      );
    }

    if (input.tipo === 'PRODUTO') {
      const produto = await this.produtosRepo.findById(input.produtoId!);
      if (!produto || !produto.ativo) {
        throw new BadRequestException('Produto inválido ou inativo.');
      }

      return this.prisma.$transaction(async (tx) => {
        await this.movimentacoesRepo.registrar(
          {
            produtoId: input.produtoId!,
            tipo: 'SAIDA',
            quantidade: input.quantidade,
            custoUnitario: Number(produto.custoMedio),
            motivo: `Consumo projeto #${projetoId}`,
            usuarioId,
            projetoId,
          },
          tx,
        );

        return this.repo.createConsumo(projetoId, input, usuarioId, tx);
      });
    }

    return this.repo.createConsumo(projetoId, input, usuarioId);
  }
}
