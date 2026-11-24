import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { traduzirErroEstoque } from './estoque-errors';

describe('traduzirErroEstoque', () => {
  it('converte ESTOQUE_INSUFICIENTE em BadRequestException', () => {
    const result = traduzirErroEstoque(new Error('ESTOQUE_INSUFICIENTE'));
    expect(result).toBeInstanceOf(BadRequestException);
  });

  it('converte PRODUTO_NAO_ENCONTRADO em BadRequestException', () => {
    const result = traduzirErroEstoque(new Error('PRODUTO_NAO_ENCONTRADO'));
    expect(result).toBeInstanceOf(BadRequestException);
  });

  it('usa a mensagem de contexto quando informada', () => {
    const result = traduzirErroEstoque(new Error('ESTOQUE_INSUFICIENTE'), {
      estoqueInsuficiente: 'Sem saldo para esta operação.',
    });
    expect(result?.message).toBe('Sem saldo para esta operação.');
  });

  it('retorna undefined para erros desconhecidos', () => {
    expect(traduzirErroEstoque(new Error('OUTRO'))).toBeUndefined();
    expect(traduzirErroEstoque('texto')).toBeUndefined();
  });
});
