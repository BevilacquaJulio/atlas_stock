import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField } from '../../components/form/TextField';
import { SelectField } from '../../components/form/SelectField';
import { TextareaField } from '../../components/form/TextareaField';
import { Alert } from '../../components/feedback';
import { listClientes } from '../clientes/clientes.api';
import { listVeiculos } from '../veiculos/veiculos.api';
import type { ProjetoFormValues } from './projetos.types';
import { useOptionSearch } from '../../hooks/useOptionSearch';

const schema = z.object({
  clienteId: z.coerce.number().int().positive('Selecione o cliente.'),
  veiculoId: z.coerce.number().int().positive('Selecione o veículo.'),
  descricao: z.string().trim().optional(),
  valorOrcado: z.coerce.number().min(0),
});

type FormValues = z.infer<typeof schema>;

export function ProjetoForm({
  onSubmit,
  error,
}: {
  onSubmit: (values: ProjetoFormValues) => void;
  error?: string | null;
}) {
  const clientesSearch = useOptionSearch({
    queryKey: ['clientes'],
    fetch: (search) => listClientes({ limit: 100, ativo: true, search }),
    toOption: (c) => ({ value: c.id, label: c.nomeCompleto }),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { valorOrcado: 0 },
  });

  const clienteIdRaw = watch('clienteId');
  const clienteId = Number(clienteIdRaw) || 0;

  const veiculosSearch = useOptionSearch({
    queryKey: ['veiculos', clienteId],
    fetch: (search) =>
      listVeiculos({ limit: 100, ativo: true, clienteId, search }),
    toOption: (v) => ({
      value: v.id,
      label: `${v.placa} — ${v.marca} ${v.modelo}`,
    }),
    enabled: clienteId > 0,
  });

  useEffect(() => {
    setValue('veiculoId', '' as unknown as number);
  }, [clienteId, setValue]);

  return (
    <form
      id="projeto-form"
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      {error && <Alert kind="error">{error}</Alert>}

      <SelectField
        label="Cliente"
        placeholder={
          clientesSearch.isLoading ? 'Carregando…' : 'Selecione o cliente'
        }
        error={errors.clienteId?.message}
        options={clientesSearch.options}
        onSearch={clientesSearch.onSearch}
        {...register('clienteId')}
      />

      <SelectField
        key={clienteId || 'no-client'}
        label="Veículo"
        placeholder={
          clienteId <= 0
            ? 'Selecione o cliente primeiro'
            : veiculosSearch.isLoading
              ? 'Carregando…'
              : veiculosSearch.options.length === 0
                ? 'Nenhum veículo ativo'
                : 'Selecione o veículo'
        }
        error={errors.veiculoId?.message}
        options={veiculosSearch.options}
        onSearch={veiculosSearch.onSearch}
        disabled={clienteId <= 0}
        {...register('veiculoId')}
      />

      <TextField
        label="Valor orçado (R$)"
        type="number"
        step="0.01"
        min="0"
        error={errors.valorOrcado?.message}
        {...register('valorOrcado')}
      />

      <TextareaField
        label="Descrição / observações"
        rows={3}
        error={errors.descricao?.message}
        {...register('descricao')}
      />
    </form>
  );
}
