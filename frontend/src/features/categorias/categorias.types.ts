export interface Categoria {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoriaFormValues {
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
}
