import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjetosService } from './projetos.service';
import { ProjetosRepository } from './projetos.repository';
import { ClientesRepository } from '../clientes/clientes.repository';
import { VeiculosRepository } from '../veiculos/veiculos.repository';
import { ProdutosRepository } from '../produtos/produtos.repository';
import { MovimentacoesRepository } from '../movimentacoes/movimentacoes.repository';
import { PrismaService } from '../../prisma/prisma.service';

const makeProjetosRepo = () => ({
  findMany: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
  softDelete: vi.fn(),
  addChecklistItem: vi.fn(),
  updateChecklistItem: vi.fn(),
  deleteChecklistItem: vi.fn(),
  findChecklistItem: vi.fn(),
  createConsumo: vi.fn(),
});

const makeClientesRepo = () => ({ findById: vi.fn() });
const makeVeiculosRepo = () => ({ findById: vi.fn() });
const makeProdutosRepo = () => ({ findById: vi.fn() });
const makeMovimentacoesRepo = () => ({ registrar: vi.fn() });
const makePrisma = () => ({
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
});

describe('ProjetosService', () => {
  let projetosRepo: ReturnType<typeof makeProjetosRepo>;
  let clientesRepo: ReturnType<typeof makeClientesRepo>;
  let veiculosRepo: ReturnType<typeof makeVeiculosRepo>;
  let service: ProjetosService;

  beforeEach(() => {
    projetosRepo = makeProjetosRepo();
    clientesRepo = makeClientesRepo();
    veiculosRepo = makeVeiculosRepo();
    service = new ProjetosService(
      projetosRepo as unknown as ProjetosRepository,
      clientesRepo as unknown as ClientesRepository,
      veiculosRepo as unknown as VeiculosRepository,
      makeProdutosRepo() as unknown as ProdutosRepository,
      makeMovimentacoesRepo() as unknown as MovimentacoesRepository,
      makePrisma() as unknown as PrismaService,
    );
  });

  it('lista de forma paginada', async () => {
    projetosRepo.findMany.mockResolvedValue({
      data: [{ id: 1, status: 'AGUARDANDO' }],
      total: 1,
    });
    const result = await service.list({ page: 1, limit: 20 });
    expect(result.total).toBe(1);
  });

  it('findOne inexistente lança 404', async () => {
    projetosRepo.findById.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita veículo de outro cliente', async () => {
    clientesRepo.findById.mockResolvedValue({ id: 1, ativo: true });
    veiculosRepo.findById.mockResolvedValue({
      id: 2,
      clienteId: 99,
      ativo: true,
    });
    await expect(
      service.create({ clienteId: 1, veiculoId: 2, valorOrcado: 0 }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cria projeto com cliente e veículo válidos', async () => {
    clientesRepo.findById.mockResolvedValue({ id: 1, ativo: true });
    veiculosRepo.findById.mockResolvedValue({
      id: 2,
      clienteId: 1,
      ativo: true,
    });
    projetosRepo.create.mockResolvedValue({ id: 1, status: 'AGUARDANDO' });

    const result = await service.create(
      { clienteId: 1, veiculoId: 2, valorOrcado: 5000 },
      1,
    );
    expect(result).toEqual({ id: 1, status: 'AGUARDANDO' });
  });

  it('rejeita alteração de status igual', async () => {
    projetosRepo.findById.mockResolvedValue({
      id: 1,
      status: 'EM_ANDAMENTO',
      dataInicio: null,
    });
    await expect(
      service.alterarStatus(1, { status: 'EM_ANDAMENTO' }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
