import { describe, it, expect, vi } from 'vitest';
import { ClientesService } from './clientes.service';
import { updateClienteSchema } from './dto/cliente.dto';
import { updateFornecedorSchema } from '../fornecedores/dto/fornecedor.dto';
import { updateVeiculoSchema } from '../veiculos/dto/veiculo.dto';
import { updateCategoriaSchema } from '../categorias/dto/categoria.dto';
import type { ClientesRepository } from './clientes.repository';

const build = () => {
  const repo = {
    findById: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({}),
  };
  return {
    repo,
    service: new ClientesService(repo as unknown as ClientesRepository),
  };
};

describe('ClientesService.update — UF em edição parcial', () => {
  it('omitir `estado` preserva a UF gravada', async () => {
    const { repo, service } = build();
    await service.update(
      1,
      updateClienteSchema.parse({ nomeCompleto: 'Novo Nome' }),
    );
    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('estado', null);
    expect(repo.update.mock.calls[0][1].estado).toBeUndefined();
  });

  it('normaliza a sigla enviada e trata vazio/null como limpeza', async () => {
    const { repo, service } = build();
    await service.update(1, { estado: 'mg' });
    await service.update(1, { estado: '' });
    await service.update(1, { estado: null });
    expect(repo.update.mock.calls.map((c) => c[1].estado)).toEqual([
      'MG',
      null,
      null,
    ]);
  });
});

describe('schemas de update sem defaults (pré-requisito do Zod 4)', () => {
  it('PATCH parcial não injeta `tipo` nem `ativo`', () => {
    expect(updateClienteSchema.parse({ nomeCompleto: 'x y' })).toEqual({
      nomeCompleto: 'x y',
    });
    expect(updateFornecedorSchema.parse({})).toEqual({});
    expect(updateVeiculoSchema.parse({})).toEqual({});
    expect(updateCategoriaSchema.parse({})).toEqual({});
  });
});
