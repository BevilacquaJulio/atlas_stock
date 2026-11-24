import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField } from '../../components/form/TextField';
import { SelectField } from '../../components/form/SelectField';
import { TextareaField } from '../../components/form/TextareaField';
import { SwitchField } from '../../components/form/SwitchField';
import { UnidadeMedidaField } from '../../components/form/UnidadeMedidaField';
import { Alert } from '../../components/feedback';
import { resolveUnidadeMedidaOptions } from '../../lib/unidades-medida';
import { listCategorias } from '../categorias/categorias.api';
import type { Produto, ProdutoFormValues } from './produtos.types';
import { useAuth } from '../auth/useAuth';
import { podeAlterarStatus } from '../auth/permissions';
import { useOptionSearch } from '../../hooks/useOptionSearch';

const schema = z.object({
  codigo: z.string().trim().min(1, 'Informe o código.'),
  nome: z.string().trim().min(2, 'Informe o nome.'),
  descricao: z.string().trim().optional(),
  categoriaId: z.coerce.number().int().positive('Selecione a categoria.'),
  unidadeMedida: z.string().trim().min(1, 'Selecione a unidade de medida.'),
  valorUnitario: z.coerce.number().min(0, 'Valor inválido.'),
  estoqueInicial: z.coerce.number().min(0, 'Estoque inválido.'),
  ativo: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function ProdutoForm({
  initial,
  onSubmit,
  error,
}: {
  initial?: Produto;
  onSubmit: (values: ProdutoFormValues) => void;
  error?: string | null;
}) {
  const { user } = useAuth();
  const statusEditavel = podeAlterarStatus(user?.cargo);
  const isEdit = Boolean(initial);
  const categoriasSearch = useOptionSearch({
    queryKey: ['categorias'],
    fetch: (search) => listCategorias({ limit: 100, search }),
    toOption: (c) => ({ value: c.id, label: c.nome }),
    pinned: initial?.categoria
      ? { value: initial.categoria.id, label: initial.categoria.nome }
      : null,
  });

  const unidadeOptions = resolveUnidadeMedidaOptions(initial?.unidadeMedida);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigo: initial?.codigo ?? '',
      nome: initial?.nome ?? '',
      descricao: initial?.descricao ?? '',
      categoriaId: initial?.categoriaId ?? 0,
      unidadeMedida: initial?.unidadeMedida ?? 'UN',
      valorUnitario: initial ? Number(initial.valorUnitario) : 0,
      estoqueInicial: initial ? Number(initial.quantidadeEstoque) : 0,
      ativo: initial?.ativo ?? true,
    },
  });

  return (
    <form
      id="produto-form"
      onSubmit={handleSubmit((v) =>
        // Sem permissão, `ativo` não vai no payload (a API responde 403).
        onSubmit(statusEditavel ? v : { ...v, ativo: undefined }),
      )}
      className="flex flex-col gap-4"
    >
      {error && <Alert kind="error">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Código"
          error={errors.codigo?.message}
          {...register('codigo')}
        />
        <TextField
          label="Nome"
          error={errors.nome?.message}
          {...register('nome')}
        />
      </div>

      <UnidadeMedidaField
        error={errors.unidadeMedida?.message}
        options={unidadeOptions}
        {...register('unidadeMedida')}
      />

      <SelectField
        label="Categoria"
        placeholder={
          categoriasSearch.isLoading ? 'Carregando…' : 'Selecione a categoria'
        }
        error={errors.categoriaId?.message}
        options={categoriasSearch.options}
        onSearch={categoriasSearch.onSearch}
        {...register('categoriaId')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Valor unitário (R$)"
          type="number"
          step="0.01"
          min="0"
          error={errors.valorUnitario?.message}
          {...register('valorUnitario')}
        />
        <TextField
          label={isEdit ? 'Estoque atual' : 'Estoque inicial'}
          type="number"
          step="0.001"
          min="0"
          disabled={isEdit}
          error={errors.estoqueInicial?.message}
          {...register('estoqueInicial')}
        />
      </div>
      {isEdit && (
        <p className="text-xs text-[#0a0a0a]/45">
          O estoque é alterado pelas Movimentações, não por aqui.
        </p>
      )}
      <TextareaField label="Descrição" {...register('descricao')} />
      {statusEditavel && (
        <SwitchField
          label="Ativo"
          description="Produtos inativos não entram em compras ou consumos."
          {...register('ativo')}
        />
      )}
    </form>
  );
}
