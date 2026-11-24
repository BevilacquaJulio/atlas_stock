import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField } from '../../components/form/TextField';
import { SelectField } from '../../components/form/SelectField';
import { Alert } from '../../components/feedback';
import { listProdutos } from '../produtos/produtos.api';
import type { MovimentacaoFormValues } from './movimentacoes.types';
import { useOptionSearch } from '../../hooks/useOptionSearch';

const schema = z.object({
  produtoId: z.coerce.number().int().positive('Selecione o produto.'),
  tipo: z.enum(['ENTRADA', 'SAIDA']),
  quantidade: z.coerce.number().positive('Quantidade deve ser maior que zero.'),
  custoUnitario: z.coerce.number().min(0).optional(),
  motivo: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

export function MovimentacaoForm({
  onSubmit,
  error,
}: {
  onSubmit: (values: MovimentacaoFormValues) => void;
  error?: string | null;
}) {
  const produtosSearch = useOptionSearch({
    queryKey: ['produtos'],
    fetch: (search) => listProdutos({ limit: 100, ativo: true, search }),
    toOption: (p) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'ENTRADA', quantidade: 1 },
  });

  return (
    <form
      id="movimentacao-form"
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      {error && <Alert kind="error">{error}</Alert>}
      <SelectField
        label="Produto"
        placeholder={
          produtosSearch.isLoading ? 'Carregando…' : 'Selecione o produto'
        }
        error={errors.produtoId?.message}
        options={produtosSearch.options}
        onSearch={produtosSearch.onSearch}
        {...register('produtoId')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tipo"
          options={[
            { value: 'ENTRADA', label: 'Entrada' },
            { value: 'SAIDA', label: 'Saída' },
          ]}
          error={errors.tipo?.message}
          {...register('tipo')}
        />
        <TextField
          label="Quantidade"
          type="number"
          step="0.001"
          min="0"
          error={errors.quantidade?.message}
          {...register('quantidade')}
        />
      </div>
      <TextField
        label="Custo unitário (R$) — opcional"
        type="number"
        step="0.01"
        min="0"
        error={errors.custoUnitario?.message}
        {...register('custoUnitario')}
      />
      <TextField label="Motivo" {...register('motivo')} />
    </form>
  );
}
