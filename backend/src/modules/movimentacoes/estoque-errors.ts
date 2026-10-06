import { BadRequestException } from '@nestjs/common';

type Mensagens = {
  estoqueInsuficiente?: string;
  produtoNaoEncontrado?: string;
};

/**
 * O repositório de movimentações sinaliza falhas de domínio com `Error`
 * (códigos fixos) para poder ser composto dentro de transações. Esta função
 * converte esses códigos em respostas 400 sem que cada serviço repita o mapa.
 * Retorna `undefined` para qualquer outro erro: quem chama deve relançá-lo.
 */
export function traduzirErroEstoque(
  error: unknown,
  mensagens: Mensagens = {},
): BadRequestException | undefined {
  if (!(error instanceof Error)) return undefined;

  if (error.message === 'ESTOQUE_INSUFICIENTE') {
    return new BadRequestException(
      mensagens.estoqueInsuficiente ?? 'Estoque insuficiente para esta saída.',
    );
  }
  if (error.message === 'PRODUTO_NAO_ENCONTRADO') {
    return new BadRequestException(
      mensagens.produtoNaoEncontrado ?? 'Produto não encontrado.',
    );
  }
  return undefined;
}
