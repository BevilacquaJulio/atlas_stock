import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientesRepository } from './clientes.repository';
import {
  buildPaginated,
  type PaginationParams,
} from '../../common/dto/pagination.dto';
import type { CreateClienteInput, UpdateClienteInput } from './dto/cliente.dto';
import type { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class ClientesService {
  constructor(private readonly repo: ClientesRepository) {}

  async list({ page, limit, search, ativo }: PaginationParams) {
    const where: Prisma.ClienteWhereInput = {
      ...(ativo !== undefined ? { ativo } : {}),
      ...(search
        ? {
            OR: [
              { nomeCompleto: { contains: search } },
              { cpfCnpj: { contains: search } },
              { email: { contains: search } },
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
    const cliente = await this.repo.findById(id);
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    return cliente;
  }

  create(input: CreateClienteInput) {
    return this.repo.create(this.normalize(input));
  }

  async update(id: number, input: UpdateClienteInput) {
    await this.findOne(id);
    return this.repo.update(id, this.normalize(input));
  }

  /** Exclusão lógica: inativa o cliente. */
  async remove(id: number) {
    await this.findOne(id);
    return this.repo.update(id, { ativo: false });
  }

  private normalize<
    T extends { email?: string | null; estado?: string | null },
  >(input: T): T {
    return {
      ...input,
      email: input.email === '' ? null : input.email,
      // Ausente = preservar (PATCH parcial); '' ou null = limpar.
      estado:
        input.estado === undefined
          ? undefined
          : input.estado?.toUpperCase() || null,
    };
  }
}
