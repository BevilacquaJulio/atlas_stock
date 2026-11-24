import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getApiErrorMessage } from '../../lib/api';
import { formatBRL, formatDate, formatQuantidade } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { TableContainer } from '../../components/ListToolbar';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { ModalFormFooter } from '../../components/ModalFormFooter';
import { Alert, EmptyState, Spinner } from '../../components/feedback';
import { TextField } from '../../components/form/TextField';
import { SelectField } from '../../components/form/SelectField';
import { TextareaField } from '../../components/form/TextareaField';
import { listProdutos } from '../produtos/produtos.api';
import {
  useAddChecklistItem,
  useAlterarStatusProjeto,
  useDeleteChecklistItem,
  useProjeto,
  useRegistrarConsumo,
  useUpdateChecklistItem,
} from './projetos.hooks';
import {
  PROJETO_STATUS_LABEL,
  type ConsumoFormValues,
  type ProjetoStatus,
} from './projetos.types';
import { useOptionSearch } from '../../hooks/useOptionSearch';

function StatusBadge({ status }: { status: ProjetoStatus }) {
  const styles: Record<ProjetoStatus, string> = {
    AGUARDANDO: 'badge--muted',
    EM_ANDAMENTO: 'badge--outline',
    CONCLUIDO: 'badge--solid',
    CANCELADO: 'badge--ghost',
  };
  return (
    <span className={`badge ${styles[status]}`}>
      {PROJETO_STATUS_LABEL[status]}
    </span>
  );
}

const statusSchema = z.object({
  status: z.enum(['AGUARDANDO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO']),
  observacao: z.string().trim().optional(),
});

const checklistSchema = z.object({
  descricao: z.string().trim().min(1, 'Informe a descrição.'),
});

const consumoSchema = z
  .object({
    tipo: z.enum(['PRODUTO', 'SERVICO']),
    produtoId: z.coerce.number().int().positive().optional(),
    descricao: z.string().trim().optional(),
    quantidade: z.coerce.number().positive(),
    valorUnitario: z.coerce.number().min(0),
  })
  .refine(
    (d) =>
      d.tipo === 'SERVICO'
        ? !!d.descricao?.trim()
        : d.produtoId != null && d.produtoId > 0,
    {
      message: 'Preencha produto ou descrição conforme o tipo.',
      path: ['produtoId'],
    },
  );

export default function ProjetoDetalhesPage() {
  const { id } = useParams();
  const projetoId = Number(id);
  const query = useProjeto(projetoId);

  const [statusModal, setStatusModal] = useState(false);
  const [checklistModal, setChecklistModal] = useState(false);
  const [consumoModal, setConsumoModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const alterarStatusMut = useAlterarStatusProjeto(projetoId);
  const addChecklistMut = useAddChecklistItem(projetoId);
  const updateChecklistMut = useUpdateChecklistItem(projetoId);
  const deleteChecklistMut = useDeleteChecklistItem(projetoId);
  const consumoMut = useRegistrarConsumo(projetoId);

  const produtosSearch = useOptionSearch({
    queryKey: ['produtos'],
    fetch: (search) => listProdutos({ limit: 100, ativo: true, search }),
    toOption: (p) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }),
  });

  const statusForm = useForm<z.infer<typeof statusSchema>>({
    resolver: zodResolver(statusSchema),
  });

  const checklistForm = useForm<z.infer<typeof checklistSchema>>({
    resolver: zodResolver(checklistSchema),
  });

  const consumoForm = useForm<z.infer<typeof consumoSchema>>({
    resolver: zodResolver(consumoSchema),
    defaultValues: { tipo: 'PRODUTO', quantidade: 1, valorUnitario: 0 },
  });

  const consumoTipo = consumoForm.watch('tipo');
  const projeto = query.data;
  const encerrado =
    projeto?.status === 'CONCLUIDO' || projeto?.status === 'CANCELADO';

  const handleStatus = async (values: z.infer<typeof statusSchema>) => {
    setFormError(null);
    try {
      await alterarStatusMut.mutateAsync(values);
      setStatusModal(false);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleChecklist = async (values: z.infer<typeof checklistSchema>) => {
    setFormError(null);
    try {
      await addChecklistMut.mutateAsync(values);
      checklistForm.reset();
      setChecklistModal(false);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleConsumo = async (values: ConsumoFormValues) => {
    setFormError(null);
    try {
      await consumoMut.mutateAsync(values);
      consumoForm.reset({ tipo: 'PRODUTO', quantidade: 1, valorUnitario: 0 });
      setConsumoModal(false);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const toggleChecklist = async (itemId: number, concluido: boolean) => {
    try {
      await updateChecklistMut.mutateAsync({
        itemId,
        values: { concluido: !concluido },
      });
    } catch (err) {
      window.alert(getApiErrorMessage(err));
    }
  };

  const removeChecklist = async (itemId: number) => {
    if (!window.confirm('Remover este item do checklist?')) return;
    try {
      await deleteChecklistMut.mutateAsync(itemId);
    } catch (err) {
      window.alert(getApiErrorMessage(err));
    }
  };

  if (query.isLoading) return <Spinner />;
  if (query.isError)
    return <Alert kind="error">{getApiErrorMessage(query.error)}</Alert>;
  if (!projeto) return <EmptyState title="Projeto não encontrado" />;

  return (
    <>
      <div className="mb-4">
        <Link
          to="/projetos"
          className="text-sm text-[#0a0a0a]/55 hover:text-[#0a0a0a] hover:underline"
        >
          ← Voltar para projetos
        </Link>
      </div>

      <PageHeader
        title={`Projeto #${projeto.id}`}
        subtitle={
          projeto.veiculo
            ? `${projeto.cliente?.nomeCompleto} — ${projeto.veiculo.placa}`
            : projeto.cliente?.nomeCompleto
        }
        action={
          !encerrado ? (
            <Button onClick={() => setStatusModal(true)}>Alterar status</Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-3 rounded-md border border-[#e5e5e5] bg-[#fafafa] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[#0a0a0a]/45">Status</p>
          <StatusBadge status={projeto.status} />
        </div>
        <div>
          <p className="text-[#0a0a0a]/45">Valor orçado</p>
          <p className="font-medium">{formatBRL(projeto.valorOrcado)}</p>
        </div>
        <div>
          <p className="text-[#0a0a0a]/45">Início</p>
          <p>{projeto.dataInicio ? formatDate(projeto.dataInicio) : '—'}</p>
        </div>
        <div>
          <p className="text-[#0a0a0a]/45">Conclusão</p>
          <p>
            {projeto.dataConclusao ? formatDate(projeto.dataConclusao) : '—'}
          </p>
        </div>
        {projeto.descricao && (
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-[#0a0a0a]/45">Descrição</p>
            <p className="text-[#0a0a0a]/80">{projeto.descricao}</p>
          </div>
        )}
      </div>

      {/* Checklist */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Checklist</h2>
          {!encerrado && (
            <Button variant="secondary" onClick={() => setChecklistModal(true)}>
              Adicionar item
            </Button>
          )}
        </div>
        {(projeto.checklist?.length ?? 0) === 0 ? (
          <EmptyState title="Checklist vazio" />
        ) : (
          <ul className="divide-y divide-[#e5e5e5] rounded-md border border-[#e5e5e5] bg-white">
            {projeto.checklist?.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={item.concluido}
                  disabled={encerrado || updateChecklistMut.isPending}
                  onChange={() => toggleChecklist(item.id, item.concluido)}
                  className="h-4 w-4 rounded border-[#d4d4d4] accent-[#0a0a0a]"
                  aria-label={`Marcar ${item.descricao}`}
                />
                <span
                  className={`flex-1 text-sm ${
                    item.concluido ? 'text-[#0a0a0a]/35 line-through' : ''
                  }`}
                >
                  {item.descricao}
                </span>
                {!encerrado && (
                  <button
                    type="button"
                    className="text-xs font-medium text-[#0a0a0a]/60 underline-offset-2 hover:text-[#0a0a0a] hover:underline"
                    onClick={() => removeChecklist(item.id)}
                  >
                    Remover
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Consumos */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Consumo de produtos e serviços
          </h2>
          {projeto.status !== 'CANCELADO' && (
            <Button variant="secondary" onClick={() => setConsumoModal(true)}>
              Registrar consumo
            </Button>
          )}
        </div>
        {(projeto.consumos?.length ?? 0) === 0 ? (
          <EmptyState title="Nenhum consumo registrado" />
        ) : (
          <TableContainer>
            <thead className="border-b border-[#e5e5e5] bg-[#fafafa] text-xs uppercase text-[#0a0a0a]/55">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Qtd.</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {projeto.consumos?.map((c) => (
                <tr key={c.id} className="border-b border-[#f0f0f0]">
                  <td className="px-4 py-3 text-sm text-[#0a0a0a]/70">
                    {formatDate(c.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">{c.tipo}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.tipo === 'PRODUTO' && c.produto
                      ? `${c.produto.codigo} — ${c.produto.nome}`
                      : (c.descricao ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-[#0a0a0a]/70">
                    {formatQuantidade(c.quantidade)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-[#0a0a0a]/70">
                    {formatBRL(c.valorTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableContainer>
        )}
      </section>

      {/* Histórico */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Histórico de status</h2>
        {(projeto.historico?.length ?? 0) === 0 ? (
          <EmptyState title="Sem histórico" />
        ) : (
          <ul className="space-y-2">
            {projeto.historico?.map((h) => (
              <li
                key={h.id}
                className="rounded-md border border-[#e5e5e5] bg-white px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#0a0a0a]/45">
                    {formatDate(h.createdAt)}
                  </span>
                  {h.statusAnterior && (
                    <>
                      <StatusBadge status={h.statusAnterior} />
                      <span>→</span>
                    </>
                  )}
                  <StatusBadge status={h.statusNovo} />
                  <span className="text-[#0a0a0a]/45">
                    por {h.usuario?.nome ?? '—'}
                  </span>
                </div>
                {h.observacao && (
                  <p className="mt-1 text-[#0a0a0a]/70">{h.observacao}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={statusModal}
        title="Alterar status"
        onClose={() => setStatusModal(false)}
        footer={
          <ModalFormFooter
            formId="projeto-status-form"
            onCancel={() => setStatusModal(false)}
            submitting={alterarStatusMut.isPending}
          />
        }
      >
        <form
          id="projeto-status-form"
          onSubmit={statusForm.handleSubmit(handleStatus)}
          className="flex flex-col gap-4"
        >
          {formError && <Alert kind="error">{formError}</Alert>}
          <SelectField
            label="Novo status"
            options={(
              [
                'AGUARDANDO',
                'EM_ANDAMENTO',
                'CONCLUIDO',
                'CANCELADO',
              ] as ProjetoStatus[]
            ).map((s) => ({ value: s, label: PROJETO_STATUS_LABEL[s] }))}
            error={statusForm.formState.errors.status?.message}
            {...statusForm.register('status')}
          />
          <TextareaField
            label="Observação"
            rows={2}
            {...statusForm.register('observacao')}
          />
        </form>
      </Modal>

      <Modal
        open={checklistModal}
        title="Novo item de checklist"
        onClose={() => setChecklistModal(false)}
        footer={
          <ModalFormFooter
            formId="projeto-checklist-form"
            onCancel={() => setChecklistModal(false)}
            submitting={addChecklistMut.isPending}
            submitLabel="Adicionar"
          />
        }
      >
        <form
          id="projeto-checklist-form"
          onSubmit={checklistForm.handleSubmit(handleChecklist)}
          className="flex flex-col gap-4"
        >
          {formError && <Alert kind="error">{formError}</Alert>}
          <TextField
            label="Descrição"
            error={checklistForm.formState.errors.descricao?.message}
            {...checklistForm.register('descricao')}
          />
        </form>
      </Modal>

      <Modal
        open={consumoModal}
        title="Registrar consumo"
        onClose={() => setConsumoModal(false)}
        footer={
          <ModalFormFooter
            formId="projeto-consumo-form"
            onCancel={() => setConsumoModal(false)}
            submitting={consumoMut.isPending}
            submitLabel="Registrar"
          />
        }
      >
        <form
          id="projeto-consumo-form"
          onSubmit={consumoForm.handleSubmit(handleConsumo)}
          className="flex flex-col gap-4"
        >
          {formError && <Alert kind="error">{formError}</Alert>}
          <SelectField
            label="Tipo"
            options={[
              { value: 'PRODUTO', label: 'Produto (baixa estoque)' },
              { value: 'SERVICO', label: 'Serviço' },
            ]}
            {...consumoForm.register('tipo')}
          />
          {consumoTipo === 'PRODUTO' ? (
            <SelectField
              label="Produto"
              placeholder="Selecione o produto"
              options={produtosSearch.options}
              onSearch={produtosSearch.onSearch}
              error={consumoForm.formState.errors.produtoId?.message}
              {...consumoForm.register('produtoId')}
            />
          ) : (
            <TextField
              label="Descrição do serviço"
              error={consumoForm.formState.errors.descricao?.message}
              {...consumoForm.register('descricao')}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Quantidade"
              type="number"
              step="0.001"
              min="0"
              error={consumoForm.formState.errors.quantidade?.message}
              {...consumoForm.register('quantidade')}
            />
            <TextField
              label="Valor unitário (R$)"
              type="number"
              step="0.01"
              min="0"
              error={consumoForm.formState.errors.valorUnitario?.message}
              {...consumoForm.register('valorUnitario')}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
