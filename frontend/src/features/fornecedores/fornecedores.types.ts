export interface Fornecedor {
  id: number;
  nomeRazaoSocial: string;
  cpfCnpj: string;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FornecedorFormValues {
  nomeRazaoSocial: string;
  cpfCnpj: string;
  telefone?: string | null;
  email?: string | null;
  ativo?: boolean;
}
