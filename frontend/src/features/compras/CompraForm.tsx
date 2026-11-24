import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField } from '../../components/form/TextField';
import { SelectField } from '../../components/form/SelectField';
import { TextareaField } from '../../components/form/TextareaField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/feedback';
import { IconPlus, IconTrash } from '../../components/icons';
import { listFornecedores } from '../fornecedores/fornecedores.api';
import { listProdutos } from '../produtos/produtos.api';
import type { CompraFormValues } from './compras.types';
import { toApiDate } from '../../lib/format';
import { useOptionSearch } from '../../hooks/useOptionSearch';

const itemSchema = z.object({
  produtoId: z.coerce.number().int().positive('Selecione o produto.'),
  quantidade: z.coerce.number().positive('Quantidade deve ser maior que zero.'),
  valorUnitario: z.coerce
    .number()
    .min(0, 'Valor unitário não pode ser negativo.'),
});

const schema = z.object({
  fornecedorId: z.coerce.number().int().positive('Selecione o fornecedor.'),
  dataCompra: z.string().optional().transform(toApiDate),
  observacoes: z.string().trim().optional(),
  itens: z.array(itemSchema).min(1, 'Informe ao menos um item.'),
});

type FormValues = z.infer<typeof schema>;

export function CompraForm({
  onSubmit,
  error,
}: {
  onSubmit: (values: CompraFormValues) => void;
  error?: string | null;
}) {
  const fornecedoresSearch = useOptionSearch({
    queryKey: ['fornecedores'],
    fetch: (search) => listFornecedores({ limit: 100, ativo: true, search }),
    toOption: (f) => ({ value: f.id, label: f.nomeRazaoSocial }),
  });

  const produtosSearch = useOptionSearch({
    queryKey: ['produtos'],
    fetch: (search) => listProdutos({ limit: 100, ativo: true, search }),
    toOption: (p) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }),
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      itens: [
        { quantidade: 1, valorUnitario: 0 } as FormValues['itens'][number],
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });
  const itens = watch('itens');
  const total = itens.reduce(
    (sum, item) => sum + (item.quantidade || 0) * (item.valorUnitario || 0),
    0,
  );

  return (
    <form
      id="compra-form"
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      {error && <Alert kind="error">{error}</Alert>}

      <SelectField
        label="Fornecedor"
        placeholder={
          fornecedoresSearch.isLoading
            ? 'Carregando…'
            : 'Selecione o fornecedor'
        }
        error={errors.fornecedorId?.message}
        options={fornecedoresSearch.options}
        onSearch={fornecedoresSearch.onSearch}
        {...register('fornecedorId')}
      />

      <TextField
        label="Data da compra"
        type="date"
        error={errors.dataCompra?.message}
        {...register('dataCompra')}
      />

      <TextareaField
        label="Observações"
        rows={2}
        error={errors.observacoes?.message}
        {...register('observacoes')}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Itens</span>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              append({
                quantidade: 1,
                valorUnitario: 0,
              } as FormValues['itens'][number])
            }
          >
            <IconPlus width={16} height={16} />
            Adicionar item
          </Button>
        </div>

        {errors.itens?.message && (
          <p className="mb-2 text-sm font-medium text-[#0a0a0a]">
            {errors.itens.message}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-md border border-[#e5e5e5] p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-[#0a0a0a]/45">
                  Item {index + 1}
                </span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    className="rounded p-1 text-[#0a0a0a]/45 transition-colors hover:bg-[#0a0a0a] hover:text-white"
                    aria-label="Remover item"
                    onClick={() => remove(index)}
                  >
                    <IconTrash width={16} height={16} />
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectField
                  label="Produto"
                  placeholder="Selecione"
                  error={errors.itens?.[index]?.produtoId?.message}
                  options={produtosSearch.options}
                  onSearch={produtosSearch.onSearch}
                  {...register(`itens.${index}.produtoId`)}
                />
                <TextField
                  label="Quantidade"
                  type="number"
                  step="0.001"
                  min="0"
                  error={errors.itens?.[index]?.quantidade?.message}
                  {...register(`itens.${index}.quantidade`)}
                />
                <TextField
                  label="Valor unitário (R$)"
                  type="number"
                  step="0.01"
                  min="0"
                  error={errors.itens?.[index]?.valorUnitario?.message}
                  {...register(`itens.${index}.valorUnitario`)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-right text-sm font-semibold">
        Total:{' '}
        {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
    </form>
  );
}
