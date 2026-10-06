import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FinanceiroRepository } from './financeiro.repository';
import { buildPaginated } from '../../common/dto/pagination.dto';
import type {
  CreateCategoriaDespesaInput,
  CreateDespesaInput,
  CreateReceitaInput,
  FinanceiroQuery,
  UpdateDespesaInput,
  UpdateReceitaInput,
} from './dto/financeiro.dto';
import type { Prisma } from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@Injectable()
export class FinanceiroService {
  constructor(
    private readonly repo: FinanceiroRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async desbloquear(senha: string, user: AuthenticatedUser) {
    if (user.cargo === 'ADMINISTRADOR') {
      return { token: null, expiresIn: null };
    }

    const ok = await this.repo.verifyFinanceiroSenha(senha);
    if (!ok) {
      throw new UnauthorizedException('Senha financeira incorreta.');
    }

    const expiresIn = '8h';
    const token = await this.jwtService.signAsync(
      { purpose: 'financeiro_unlock', sub: user.id },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn,
      },
    );

    return { token, expiresIn };
  }

  statusDesbloqueio(user: AuthenticatedUser) {
    return {
      requerDesbloqueio: user.cargo !== 'ADMINISTRADOR',
      desbloqueado: user.cargo === 'ADMINISTRADOR',
    };
  }

  async listDespesas({ page, limit, search, status }: FinanceiroQuery) {
    const where: Prisma.DespesaWhereInput = {
      ...(status === 'A_PAGAR' || status === 'PAGO' ? { status } : {}),
      ...(search
        ? {
            OR: [
              { descricao: { contains: search } },
              { fornecedor: { nomeRazaoSocial: { contains: search } } },
            ],
          }
        : {}),
    };
    const { data, total } = await this.repo.findDespesas(
      where,
      (page - 1) * limit,
      limit,
    );
    return buildPaginated(data, total, { page, limit });
  }

  async findDespesa(id: number) {
    const despesa = await this.repo.findDespesaById(id);
    if (!despesa) throw new NotFoundException('Despesa não encontrada.');
    return despesa;
  }

  createDespesa(input: CreateDespesaInput) {
    return this.repo.createDespesa(input);
  }

  async updateDespesa(id: number, input: UpdateDespesaInput) {
    const despesa = await this.findDespesa(id);
    if (despesa.compraId) {
      throw new BadRequestException(
        'Despesas geradas por compras não podem ser editadas aqui.',
      );
    }
    if (despesa.status === 'PAGO') {
      throw new BadRequestException('Despesa já paga não pode ser editada.');
    }
    return this.repo.updateDespesa(id, input);
  }

  async pagarDespesa(id: number, dataPagamento?: Date) {
    const despesa = await this.findDespesa(id);
    if (despesa.status === 'PAGO') {
      throw new BadRequestException('Despesa já está paga.');
    }
    return this.repo.pagarDespesa(id, dataPagamento ?? new Date());
  }

  async listReceitas({ page, limit, search, status }: FinanceiroQuery) {
    const where: Prisma.ReceitaWhereInput = {
      ...(status === 'A_RECEBER' || status === 'RECEBIDO' ? { status } : {}),
      ...(search
        ? {
            OR: [
              { descricao: { contains: search } },
              { cliente: { nomeCompleto: { contains: search } } },
            ],
          }
        : {}),
    };
    const { data, total } = await this.repo.findReceitas(
      where,
      (page - 1) * limit,
      limit,
    );
    return buildPaginated(data, total, { page, limit });
  }

  async findReceita(id: number) {
    const receita = await this.repo.findReceitaById(id);
    if (!receita) throw new NotFoundException('Receita não encontrada.');
    return receita;
  }

  createReceita(input: CreateReceitaInput) {
    return this.repo.createReceita(input);
  }

  async updateReceita(id: number, input: UpdateReceitaInput) {
    const receita = await this.findReceita(id);
    if (receita.status === 'RECEBIDO') {
      throw new BadRequestException('Receita já recebida não pode ser editada.');
    }
    return this.repo.updateReceita(id, input);
  }

  async receberReceita(id: number, dataRecebimento?: Date) {
    const receita = await this.findReceita(id);
    if (receita.status === 'RECEBIDO') {
      throw new BadRequestException('Receita já foi recebida.');
    }
    return this.repo.receberReceita(id, dataRecebimento ?? new Date());
  }

  listCategoriasDespesa() {
    return this.repo.findCategoriasDespesa();
  }

  async createCategoriaDespesa(input: CreateCategoriaDespesaInput) {
    const existing = await this.repo.findCategoriaDespesaByNome(input.nome);
    if (existing) {
      throw new ConflictException('Já existe uma categoria com este nome.');
    }
    return this.repo.createCategoriaDespesa(input);
  }

  async resumo() {
    const [despesas, receitas] = await Promise.all([
      this.repo.sumDespesasAPagar(),
      this.repo.sumReceitasAReceber(),
    ]);
    return {
      despesasAPagar: {
        total: despesas._sum.valor ?? 0,
        quantidade: despesas._count,
      },
      receitasAReceber: {
        total: receitas._sum.valor ?? 0,
        quantidade: receitas._count,
      },
    };
  }
}
