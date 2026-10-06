import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FinanceiroService } from './financeiro.service';
import { FinanceiroRepository } from './financeiro.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

const makeRepo = () => ({
  verifyFinanceiroSenha: vi.fn(),
  findDespesas: vi.fn(),
  findDespesaById: vi.fn(),
  createDespesa: vi.fn(),
  updateDespesa: vi.fn(),
  pagarDespesa: vi.fn(),
  findReceitas: vi.fn(),
  findReceitaById: vi.fn(),
  createReceita: vi.fn(),
  updateReceita: vi.fn(),
  receberReceita: vi.fn(),
  findCategoriasDespesa: vi.fn(),
  createCategoriaDespesa: vi.fn(),
  findCategoriaDespesaByNome: vi.fn(),
  sumDespesasAPagar: vi.fn(),
  sumReceitasAReceber: vi.fn(),
});

describe('FinanceiroService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: FinanceiroService;
  const jwt = { signAsync: vi.fn().mockResolvedValue('token-xyz') } as unknown as JwtService;
  const config = {
    get: vi.fn().mockReturnValue('secret'),
  } as unknown as ConfigService;

  beforeEach(() => {
    repo = makeRepo();
    service = new FinanceiroService(
      repo as unknown as FinanceiroRepository,
      jwt,
      config,
    );
  });

  it('administrador não precisa de token de desbloqueio', async () => {
    const result = await service.desbloquear('x', {
      id: 1,
      nome: 'Admin',
      email: 'a@b.c',
      cargo: 'ADMINISTRADOR',
    });
    expect(result.token).toBeNull();
  });

  it('rejeita senha financeira incorreta', async () => {
    repo.verifyFinanceiroSenha.mockResolvedValue(false);
    await expect(
      service.desbloquear('errada', {
        id: 1,
        nome: 'Op',
        email: 'a@b.c',
        cargo: 'OPERADOR',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('despesa inexistente lança 404', async () => {
    repo.findDespesaById.mockResolvedValue(null);
    await expect(service.findDespesa(1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejeita categoria duplicada', async () => {
    repo.findCategoriaDespesaByNome.mockResolvedValue({ id: 1 });
    await expect(
      service.createCategoriaDespesa({ nome: 'Operacional', ativo: true }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe('pagarDespesa', () => {
    it('rejeita despesa gerada por compra', async () => {
      repo.findDespesaById.mockResolvedValue({
        id: 1,
        status: 'A_PAGAR',
        compraId: 5,
      });
      await expect(service.pagarDespesa(1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.pagarDespesa).not.toHaveBeenCalled();
    });

    it('rejeita despesa cancelada', async () => {
      repo.findDespesaById.mockResolvedValue({
        id: 1,
        status: 'CANCELADA',
        compraId: null,
      });
      await expect(service.pagarDespesa(1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.pagarDespesa).not.toHaveBeenCalled();
    });

    it('paga despesa avulsa a pagar', async () => {
      repo.findDespesaById.mockResolvedValue({
        id: 1,
        status: 'A_PAGAR',
        compraId: null,
      });
      repo.pagarDespesa.mockResolvedValue({ id: 1, status: 'PAGO' });
      const result = await service.pagarDespesa(1);
      expect(result.status).toBe('PAGO');
    });
  });
});
