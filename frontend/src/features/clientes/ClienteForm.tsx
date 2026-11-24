import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField } from '../../components/form/TextField';
import { SelectField } from '../../components/form/SelectField';
import { TextareaField } from '../../components/form/TextareaField';
import { SwitchField } from '../../components/form/SwitchField';
import { CepField } from '../../components/form/CepField';
import { Alert } from '../../components/feedback';
import {
  formatCpfCnpj,
  getCpfCnpjLiveError,
  isValidCpfCnpj,
} from '../../lib/documents';
import { CepLookupError, formatCep, lookupCep } from '../../lib/cep';
import type { Cliente, ClienteFormValues } from './clientes.types';
import { useAuth } from '../auth/useAuth';
import { podeAlterarStatus } from '../auth/permissions';

const schema = z.object({
  tipo: z.enum(['PF', 'PJ']),
  nomeCompleto: z.string().trim().min(2, 'Informe o nome completo.'),
  cpfCnpj: z
    .string()
    .trim()
    .refine(isValidCpfCnpj, 'Informe um CPF ou CNPJ válido.'),
  telefone: z.string().trim().optional(),
  email: z.string().trim().email('E-mail inválido.').optional().or(z.literal('')),
  cep: z.string().trim().optional(),
  rua: z.string().trim().optional(),
  numero: z.string().trim().optional(),
  complemento: z.string().trim().optional(),
  bairro: z.string().trim().optional(),
  cidade: z.string().trim().optional(),
  estado: z
    .string()
    .trim()
    .max(2, 'Use a sigla (2 letras).')
    .optional()
    .or(z.literal('')),
  observacoes: z.string().trim().optional(),
  ativo: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function ClienteForm({
  initial,
  onSubmit,
  error,
}: {
  initial?: Cliente;
  onSubmit: (values: ClienteFormValues) => void;
  error?: string | null;
}) {
  const { user } = useAuth();
  const statusEditavel = podeAlterarStatus(user?.cargo);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const lastLookedUpCep = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: initial?.tipo ?? 'PF',
      nomeCompleto: initial?.nomeCompleto ?? '',
      cpfCnpj: initial?.cpfCnpj ? formatCpfCnpj(initial.cpfCnpj) : '',
      telefone: initial?.telefone ?? '',
      email: initial?.email ?? '',
      cep: initial?.cep ? formatCep(initial.cep) : '',
      rua: initial?.rua ?? '',
      numero: initial?.numero ?? '',
      complemento: initial?.complemento ?? '',
      bairro: initial?.bairro ?? '',
      cidade: initial?.cidade ?? '',
      estado: initial?.estado ?? '',
      observacoes: initial?.observacoes ?? '',
      ativo: initial?.ativo ?? true,
    },
  });

  const cepValue = watch('cep');
  const cpfCnpjValue = watch('cpfCnpj');
  const cpfLiveError = useMemo(
    () => getCpfCnpjLiveError(cpfCnpjValue ?? ''),
    [cpfCnpjValue],
  );
  const cpfError = cpfLiveError ?? errors.cpfCnpj?.message;

  useEffect(() => {
    const digits = (cepValue ?? '').replace(/\D/g, '');
    if (digits.length !== 8) {
      setCepError(null);
      return;
    }
    if (lastLookedUpCep.current === digits) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCepLoading(true);
      setCepError(null);
      try {
        const address = await lookupCep(digits);
        if (cancelled) return;
        lastLookedUpCep.current = digits;
        setValue('cep', address.cep, { shouldDirty: true });
        setValue('rua', address.rua, { shouldDirty: true });
        setValue('bairro', address.bairro, { shouldDirty: true });
        setValue('cidade', address.cidade, { shouldDirty: true });
        setValue('estado', address.estado, { shouldDirty: true });
        if (address.complemento) {
          setValue('complemento', address.complemento, { shouldDirty: true });
        }
      } catch (err) {
        if (cancelled) return;
        lastLookedUpCep.current = digits;
        setCepError(
          err instanceof CepLookupError
            ? err.message
            : 'Não foi possível consultar o CEP.',
        );
      } finally {
        if (!cancelled) setCepLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cepValue, setValue]);

  const cpfCnpjRegister = register('cpfCnpj');
  const cepRegister = register('cep');

  return (
    <form
      id="cliente-form"
      onSubmit={handleSubmit((v) =>
        // Sem permissão, `ativo` não vai no payload (a API responde 403).
        onSubmit(statusEditavel ? v : { ...v, ativo: undefined }),
      )}
      className="flex flex-col gap-3"
    >
      {error && <Alert kind="error">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Tipo"
          error={errors.tipo?.message}
          options={[
            { value: 'PF', label: 'Pessoa Física' },
            { value: 'PJ', label: 'Pessoa Jurídica' },
          ]}
          {...register('tipo')}
        />
        <TextField
          label="CPF / CNPJ"
          inputMode="numeric"
          placeholder="000.000.000-00"
          error={cpfError}
          {...cpfCnpjRegister}
          onChange={(e) => {
            e.target.value = formatCpfCnpj(e.target.value);
            void cpfCnpjRegister.onChange(e);
          }}
        />
      </div>
      <TextField
        label="Nome completo / Razão social"
        error={errors.nomeCompleto?.message}
        {...register('nomeCompleto')}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Telefone"
          error={errors.telefone?.message}
          {...register('telefone')}
        />
        <TextField
          label="E-mail"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
      </div>

      <fieldset className="grid gap-3 rounded-md border border-[#e5e5e5] p-3 sm:grid-cols-3">
        <legend className="px-1 text-xs font-semibold uppercase text-[#0a0a0a]/45">
          Endereço
        </legend>
        <CepField
          error={cepError ?? errors.cep?.message}
          loading={cepLoading}
          hint="Preenchimento automático ao informar o CEP."
          {...cepRegister}
          onChange={(e) => {
            e.target.value = formatCep(e.target.value);
            void cepRegister.onChange(e);
            const digits = e.target.value.replace(/\D/g, '');
            if (digits.length < 8) lastLookedUpCep.current = null;
          }}
        />
        <div className="sm:col-span-2">
          <TextField label="Rua" {...register('rua')} />
        </div>
        <TextField label="Número" {...register('numero')} />
        <TextField label="Complemento" {...register('complemento')} />
        <TextField label="Bairro" {...register('bairro')} />
        <TextField label="Cidade" {...register('cidade')} />
        <TextField
          label="Estado (UF)"
          error={errors.estado?.message}
          {...register('estado')}
        />
      </fieldset>

      <TextareaField
        label="Observações"
        rows={2}
        className="min-h-14"
        {...register('observacoes')}
      />
      {statusEditavel && (
        <SwitchField
          label="Ativo"
          description="Clientes inativos não aparecem em novas operações."
          {...register('ativo')}
        />
      )}
    </form>
  );
}
