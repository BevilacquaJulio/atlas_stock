// Campos numéricos (Decimal) chegam do backend serializados como string.
export interface Produto {
  id: number;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoriaId: number | null;
  unidadeMedida: string;
  valorUnitario: string;
  quantidadeEstoque: string;
  custoMedio: string;
  escopo: 'GERAL' | 'PROJETO';
  projetoId: number | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  categoria?: { id: number; nome: string } | null;
}

export interface ProdutoFormValues {
  codigo: string;
  nome: string;
  descricao?: string | null;
  categoriaId: number;
  unidadeMedida: string;
  valorUnitario: number;
  estoqueInicial: number;
  ativo?: boolean;
}

export interface ProdutoUpdateValues {
  codigo: string;
  nome: string;
  descricao?: string | null;
  categoriaId: number;
  unidadeMedida: string;
  valorUnitario: number;
  ativo?: boolean;
}
