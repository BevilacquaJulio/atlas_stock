export interface Veiculo {
  id: number;
  clienteId: number;
  placa: string;
  marca: string;
  modelo: string;
  ano: string | null;
  cor: string | null;
  observacoesTecnicas: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  cliente?: { id: number; nomeCompleto: string };
}

export interface VeiculoFormValues {
  clienteId: number;
  placa: string;
  marca: string;
  modelo: string;
  ano?: string | null;
  cor?: string | null;
  observacoesTecnicas?: string | null;
  ativo?: boolean;
}
