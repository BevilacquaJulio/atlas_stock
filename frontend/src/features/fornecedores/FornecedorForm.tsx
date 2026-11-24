import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField } from '../../components/form/TextField';
import { SwitchField } from '../../components/form/SwitchField';
import { Alert } from '../../components/feedback';
import {
  formatCpfCnpj,
  getCpfCnpjLiveError,
  isValidCpfCnpj,
} from '../../lib/documents';
import type { Fornecedor, FornecedorFormValues } from './fornecedores.types';
import { useAuth } from '../auth/useAuth';
import { podeAlterarStatus } from '../auth/permissions';

const schema = z.object({
  nomeRazaoSocial: z.string().trim().min(2, 'Informe o nome / razão social.'),
  cpfCnpj: z
    .string()
    .trim()
    .refine(isValidCpfCnpj, 'Informe um CPF ou CNPJ válido.'),
  telefone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .email('E-mail inválido.')
    .optional()
    .or(z.literal('')),
  ativo: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function FornecedorForm({
  initial,
  onSubmit,
  error,
}: {
  initial?: Fornecedor;
  onSubmit: (values: FornecedorFormValues) => void;
  error?: string | null;
}) {
  const { user } = useAuth();
  const statusEditavel = podeAlterarStatus(user?.cargo);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nomeRazaoSocial: initial?.nomeRazaoSocial ?? '',
      cpfCnpj: initial?.cpfCnpj ? formatCpfCnpj(initial.cpfCnpj) : '',
      telefone: initial?.telefone ?? '',
      email: initial?.email ?? '',
      ativo: initial?.ativo ?? true,
    },
  });

  const cpfCnpjRegister = register('cpfCnpj');
  const cpfCnpjValue = watch('cpfCnpj');
  const cpfError =
    useMemo(() => getCpfCnpjLiveError(cpfCnpjValue ?? ''), [cpfCnpjValue]) ??
    errors.cpfCnpj?.message;

  return (
    <form
      id="fornecedor-form"
      onSubmit={handleSubmit((v) =>
        // Sem permissão, `ativo` não vai no payload (a API responde 403).
        onSubmit(statusEditavel ? v : { ...v, ativo: undefined }),
      )}
      className="flex flex-col gap-4"
    >
      {error && <Alert kind="error">{error}</Alert>}
      <TextField
        label="Nome / Razão Social"
        error={errors.nomeRazaoSocial?.message}
        {...register('nomeRazaoSocial')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
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
        <TextField
          label="Telefone"
          error={errors.telefone?.message}
          {...register('telefone')}
        />
      </div>
      <TextField
        label="E-mail"
        type="email"
        error={errors.email?.message}
        {...register('email')}
      />
      {statusEditavel && (
        <SwitchField
          label="Ativo"
          description="Fornecedores inativos não podem ser usados em novas compras."
          {...register('ativo')}
        />
      )}
    </form>
  );
}
