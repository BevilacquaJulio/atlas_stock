export type ClienteTipo = 'PF' | 'PJ';

export interface Cliente {
  id: number;
  tipo: ClienteTipo;
  nomeCompleto: string;
  cpfCnpj: string;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClienteFormValues {
  tipo: ClienteTipo;
  nomeCompleto: string;
  cpfCnpj: string;
  telefone?: string | null;
  email?: string | null;
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
}
