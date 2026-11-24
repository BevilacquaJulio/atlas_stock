import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField } from '../../components/form/TextField';
import { TextareaField } from '../../components/form/TextareaField';
import { SwitchField } from '../../components/form/SwitchField';
import { Alert } from '../../components/feedback';
import type { Categoria, CategoriaFormValues } from './categorias.types';
import { useAuth } from '../auth/useAuth';
import { podeAlterarStatus } from '../auth/permissions';

const schema = z.object({
  nome: z.string().trim().min(2, 'Mínimo de 2 caracteres.').max(120),
  descricao: z.string().trim().max(2000).optional(),
  ativo: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function CategoriaForm({
  initial,
  onSubmit,
  error,
}: {
  initial?: Categoria;
  onSubmit: (values: CategoriaFormValues) => void;
  error?: string | null;
}) {
  const { user } = useAuth();
  const statusEditavel = podeAlterarStatus(user?.cargo);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: initial?.nome ?? '',
      descricao: initial?.descricao ?? '',
      ativo: initial?.ativo ?? true,
    },
  });

  return (
    <form
      id="categoria-form"
      onSubmit={handleSubmit((v) =>
        // Sem permissão, `ativo` não vai no payload (a API responde 403).
        onSubmit(statusEditavel ? v : { ...v, ativo: undefined }),
      )}
      className="flex flex-col gap-4"
    >
      {error && <Alert kind="error">{error}</Alert>}
      <TextField
        label="Nome"
        error={errors.nome?.message}
        {...register('nome')}
      />
      <TextareaField
        label="Descrição"
        error={errors.descricao?.message}
        {...register('descricao')}
      />
      {statusEditavel && (
        <SwitchField
          label="Ativo"
          description="Categorias inativas ficam ocultas em novos cadastros."
          {...register('ativo')}
        />
      )}
    </form>
  );
}
