import { useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { getApiErrorMessage } from '../../lib/api';
import { financeiroUnlockStore } from '../../lib/financeiro-unlock';
import { formatBRL, formatDate, toApiDate } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { ListToolbar, TableContainer } from '../../components/ListToolbar';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { ModalFormFooter } from '../../components/ModalFormFooter';
import { Pagination } from '../../components/Pagination';
import { Alert, EmptyState, Spinner } from '../../components/feedback';
import { FilterTabs } from '../../components/FilterTabs';
import { TextField } from '../../components/form/TextField';
import { SelectField } from '../../components/form/SelectField';
import { IconPlus } from '../../components/icons';
import { useAuth } from '../auth/useAuth';
import {
  useCategoriasDespesa,
  useCreateDespesa,
  useCreateReceita,
  useDesbloquearFinanceiro,
  useDespesas,
  useFinanceiroResumo,
  useFinanceiroStatus,
  usePagarDespesa,
  useReceberReceita,
  useReceitas,
} from './financeiro.hooks';
import type { Despesa, DespesaFormValues, Receita, ReceitaFormValues } from './financeiro.types';

const unlockSchema = z.object({
  senha: z.string().min(1, 'Informe a senha.'),
});

const despesaSchema = z.object({
  descricao: z.string().trim().min(1),
  valor: z.coerce.number().positive(),
  dataVencimento: z.string().optional().transform(toApiDate),
  categoriaDespesaId: z.coerce.number().int().positive().optional(),
});

const receitaSchema = z.object({
  descricao: z.string().trim().min(1),
  valor: z.coerce.number().positive(),
  dataVencimento: z.string().optional().transform(toApiDate),
});

export default function FinanceiroPage() {
  const { user } = useAuth();
  const statusQuery = useFinanceiroStatus();
  const desbloquearMut = useDesbloquearFinanceiro();

  const isAdmin = user?.cargo === 'ADMINISTRADOR';
  const hasToken = !!useSyncExternalStore(
    financeiroUnlockStore.subscribe,
    financeiroUnlockStore.get,
  );
  const unlocked =
    isAdmin || hasToken || statusQuery.data?.desbloqueado === true;

  const [tab, setTab] = useState<'despesas' | 'receitas'>('despesas');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [modalDespesa, setModalDespesa] = useState(false);
  const [modalReceita, setModalReceita] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resumoQuery = useFinanceiroResumo(unlocked);
  const despesasQuery = useDespesas(
    {
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: filtroStatus || undefined,
    },
    unlocked && tab === 'despesas',
  );
  const receitasQuery = useReceitas(
    {
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: filtroStatus || undefined,
    },
    unlocked && tab === 'receitas',
  );
  const categoriasQuery = useCategoriasDespesa(unlocked);
  const createDespesaMut = useCreateDespesa();
  const createReceitaMut = useCreateReceita();
  const pagarMut = usePagarDespesa();
  const receberMut = useReceberReceita();

  const unlockForm = useForm<z.infer<typeof unlockSchema>>({
    resolver: zodResolver(unlockSchema),
  });
  const despesaForm = useForm<z.infer<typeof despesaSchema>>({
    resolver: zodResolver(despesaSchema),
    defaultValues: { valor: 0 },
  });
  const receitaForm = useForm<z.infer<typeof receitaSchema>>({
    resolver: zodResolver(receitaSchema),
    defaultValues: { valor: 0 },
  });

  const handleUnlock = async (values: z.infer<typeof unlockSchema>) => {
    setFormError(null);
    try {
      await desbloquearMut.mutateAsync(values.senha);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleCreateDespesa = async (values: DespesaFormValues) => {
    setFormError(null);
    try {
      await createDespesaMut.mutateAsync(values);
      setModalDespesa(false);
      despesaForm.reset({ valor: 0 });
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleCreateReceita = async (values: ReceitaFormValues) => {
    setFormError(null);
    try {
      await createReceitaMut.mutateAsync(values);
      setModalReceita(false);
      receitaForm.reset({ valor: 0 });
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  if (statusQuery.isLoading) return <Spinner />;

  if (!unlocked) {
    return (
      <>
        <PageHeader
          title="Financeiro"
          subtitle="Módulo protegido. Informe a senha de desbloqueio."
        />
        <div className="mx-auto max-w-md rounded-md border border-[#e5e5e5] bg-white p-6">
          {formError && (
            <div className="mb-4">
              <Alert kind="error">{formError}</Alert>
            </div>
          )}
          <form
            onSubmit={unlockForm.handleSubmit(handleUnlock)}
            className="flex flex-col gap-4"
          >
            <TextField
              label="Senha financeira"
              type="password"
              autoComplete="current-password"
              error={unlockForm.formState.errors.senha?.message}
              {...unlockForm.register('senha')}
            />
            <Button type="submit" loading={desbloquearMut.isPending}>
              Desbloquear
            </Button>
          </form>
          <p className="mt-4 text-xs text-[#0a0a0a]/45">
            Administradores acessam sem senha adicional. Demais usuários usam a
            senha financeira definida pelo administrador.
          </p>
        </div>
      </>
    );
  }

  const despesaItems: Despesa[] = despesasQuery.data?.data ?? [];
  const receitaItems: Receita[] = receitasQuery.data?.data ?? [];
  const total =
    tab === 'despesas'
      ? (despesasQuery.data?.total ?? 0)
      : (receitasQuery.data?.total ?? 0);
  const loading =
    tab === 'despesas' ? despesasQuery.isLoading : receitasQuery.isLoading;

  const statusOptions =
    tab === 'despesas'
      ? [
          { value: '', label: 'Todos' },
          { value: 'A_PAGAR', label: 'A pagar' },
          { value: 'PAGO', label: 'Pagas' },
        ]
      : [
          { value: '', label: 'Todos' },
          { value: 'A_RECEBER', label: 'A receber' },
          { value: 'RECEBIDO', label: 'Recebidas' },
        ];

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Despesas, receitas e fluxo de caixa."
        action={
          tab === 'despesas' ? (
            <Button onClick={() => setModalDespesa(true)}>
              <IconPlus width={18} height={18} />
              Nova despesa
            </Button>
          ) : (
            <Button onClick={() => setModalReceita(true)}>
              <IconPlus width={18} height={18} />
              Nova receita
            </Button>
          )
        }
      />

      {resumoQuery.data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0a0a0a]/45">
              A pagar
            </p>
            <p className="tabular mt-1 text-xl font-bold text-[#0a0a0a]">
              {formatBRL(String(resumoQuery.data.despesasAPagar.total))}
            </p>
            <p className="text-sm text-[#0a0a0a]/55">
              {resumoQuery.data.despesasAPagar.quantidade} despesa(s)
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-[#0a0a0a] bg-white p-4 shadow-[var(--shadow-soft)]">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1 bg-[#0a0a0a]"
            />
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0a0a0a]/45">
              A receber
            </p>
            <p className="tabular mt-1 text-xl font-bold text-[#0a0a0a]">
              {formatBRL(String(resumoQuery.data.receitasAReceber.total))}
            </p>
            <p className="text-sm text-[#0a0a0a]/55">
              {resumoQuery.data.receitasAReceber.quantidade} receita(s)
            </p>
          </div>
        </div>
      )}

      <FilterTabs
        scope="financeiro-tipo"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
          setFiltroStatus('');
        }}
        options={[
          { value: 'despesas', label: 'Despesas' },
          { value: 'receitas', label: 'Receitas' },
        ]}
        aria-label="Tipo de lançamento"
      />

      <ListToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Buscar…"
      />

      <FilterTabs
        scope="financeiro-status"
        value={filtroStatus}
        onChange={(v) => {
          setFiltroStatus(v);
          setPage(1);
        }}
        options={statusOptions}
        aria-label="Filtrar por status"
      />

      {loading ? (
        <Spinner />
      ) : tab === 'despesas' ? (
        despesaItems.length === 0 ? (
          <EmptyState title="Nenhum registro encontrado" />
        ) : (
          <>
          <TableContainer>
            <thead className="border-b border-[#e5e5e5] bg-[#fafafa] text-xs uppercase text-[#0a0a0a]/55">
              <tr>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {despesaItems.map((d) => (
                <tr key={d.id} className="border-b border-[#f0f0f0]">
                  <td className="px-4 py-3 font-medium">{d.descricao}</td>
                  <td className="px-4 py-3 text-sm text-[#0a0a0a]/70">
                    {d.categoriaDespesa?.nome ?? (d.compraId ? 'Compra' : '—')}
                  </td>
                  <td className="px-4 py-3 text-right">{formatBRL(d.valor)}</td>
                  <td className="px-4 py-3 text-sm text-[#0a0a0a]/70">
                    {d.dataVencimento ? formatDate(d.dataVencimento) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {d.status === 'PAGO' ? 'Pago' : 'A pagar'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.status === 'A_PAGAR' && (
                      <Button
                        variant="secondary"
                        loading={pagarMut.isPending}
                        onClick={() => pagarMut.mutate(d.id)}
                      >
                        Pagar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableContainer>
          <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
          </>
        )
      ) : receitaItems.length === 0 ? (
        <EmptyState title="Nenhum registro encontrado" />
      ) : (
        <>
          <TableContainer>
            <thead className="border-b border-[#e5e5e5] bg-[#fafafa] text-xs uppercase text-[#0a0a0a]/55">
              <tr>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {receitaItems.map((r) => (
                <tr key={r.id} className="border-b border-[#f0f0f0]">
                  <td className="px-4 py-3 font-medium">{r.descricao}</td>
                  <td className="px-4 py-3 text-sm text-[#0a0a0a]/70">
                    {r.cliente?.nomeCompleto ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{formatBRL(r.valor)}</td>
                  <td className="px-4 py-3 text-sm text-[#0a0a0a]/70">
                    {r.dataVencimento ? formatDate(r.dataVencimento) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.status === 'RECEBIDO' ? 'Recebido' : 'A receber'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'A_RECEBER' && (
                      <Button
                        variant="secondary"
                        loading={receberMut.isPending}
                        onClick={() => receberMut.mutate(r.id)}
                      >
                        Receber
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableContainer>
          <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
        </>
      )}

      <Modal
        open={modalDespesa}
        title="Nova despesa"
        onClose={() => setModalDespesa(false)}
        footer={
          <ModalFormFooter
            formId="despesa-form"
            onCancel={() => setModalDespesa(false)}
            submitting={createDespesaMut.isPending}
          />
        }
      >
        <form
          id="despesa-form"
          onSubmit={despesaForm.handleSubmit(handleCreateDespesa)}
          className="flex flex-col gap-4"
        >
          {formError && <Alert kind="error">{formError}</Alert>}
          <TextField label="Descrição" {...despesaForm.register('descricao')} />
          <TextField
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0"
            {...despesaForm.register('valor')}
          />
          <TextField
            label="Vencimento"
            type="date"
            {...despesaForm.register('dataVencimento')}
          />
          <SelectField
            label="Categoria"
            placeholder="Opcional"
            options={
              categoriasQuery.data?.map((c) => ({
                value: c.id,
                label: c.nome,
              })) ?? []
            }
            {...despesaForm.register('categoriaDespesaId')}
          />
        </form>
      </Modal>

      <Modal
        open={modalReceita}
        title="Nova receita"
        onClose={() => setModalReceita(false)}
        footer={
          <ModalFormFooter
            formId="receita-form"
            onCancel={() => setModalReceita(false)}
            submitting={createReceitaMut.isPending}
          />
        }
      >
        <form
          id="receita-form"
          onSubmit={receitaForm.handleSubmit(handleCreateReceita)}
          className="flex flex-col gap-4"
        >
          {formError && <Alert kind="error">{formError}</Alert>}
          <TextField label="Descrição" {...receitaForm.register('descricao')} />
          <TextField
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0"
            {...receitaForm.register('valor')}
          />
          <TextField
            label="Vencimento"
            type="date"
            {...receitaForm.register('dataVencimento')}
          />
        </form>
      </Modal>
    </>
  );
}
