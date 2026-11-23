import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthController readiness', () => {
  it('confirma disponibilidade do banco', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.readiness()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('retorna indisponibilidade sem expor detalhes de conexão', async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error('database secret')) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
