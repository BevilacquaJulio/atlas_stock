import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from './useAuth';
import { getApiErrorMessage } from '../../lib/api';
import { TextField } from '../../components/form/TextField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/feedback';
import { BrandLogo } from '../../components/BrandLogo';
import {
  demoEmail,
  demoPassword,
  isDemoLoginEnabled,
} from '../../lib/demo-auth';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(1, 'Informe a senha.'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: LoginForm) => {
    setApiError(null);
    try {
      await login(values.email, values.senha);
      navigate('/', { replace: true });
    } catch (err) {
      setApiError(getApiErrorMessage(err, 'Não foi possível entrar.'));
    }
  };

  const fillDemoCredentials = () => {
    setValue('email', demoEmail, { shouldValidate: true, shouldDirty: true });
    setValue('senha', demoPassword, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fafafa] px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(680px 480px at 50% 42%, #000 0%, transparent 78%)',
          WebkitMaskImage:
            'radial-gradient(680px 480px at 50% 42%, #000 0%, transparent 78%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm rounded-2xl border border-[#e5e5e5] bg-white p-8 shadow-[var(--shadow-lift)]"
      >
        <div className="mb-6 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
            className="mx-auto mb-3 flex justify-center"
          >
            <BrandLogo className="h-14 w-auto max-w-[220px]" />
          </motion.div>
          <p className="mt-1 text-sm uppercase tracking-[0.18em] text-[#0a0a0a]/45">
            Sistema de Gestão
          </p>
        </div>

        {apiError && (
          <div className="mb-4">
            <Alert kind="error">{apiError}</Alert>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <TextField
            label="E-mail"
            type="email"
            autoComplete="username"
            error={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={errors.senha?.message}
            {...register('senha')}
          />
          <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
            Entrar
          </Button>
          {isDemoLoginEnabled && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={fillDemoCredentials}
            >
              Preencher acesso demo
            </Button>
          )}
        </form>
      </motion.div>
    </main>
  );
}
