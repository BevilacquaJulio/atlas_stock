/**
 * Popula o ERP Atlas Stock com dados de demonstração (cadastros, estoque, compras,
 * projetos e financeiro).
 *
 * Uso (após migrations + seed base):
 *   cd backend
 *   npm run db:seed      # admin + categorias mínimas
 *   npm run db:populate  # dados demo completos + conta demo
 *
 * Variáveis obrigatórias: DEMO_EMAIL e DEMO_PASSWORD (conta OPERADOR usada pelo
 * botão "Preencher acesso demo" do login). Essa senha é pública por design:
 * use só em ambiente de demonstração, nunca a de um usuário real.
 *
 * Idempotente: registros demo usam e-mails @atlas.com / códigos DEMO-*.
 * Para repopular do zero, defina POPULATE_RESET=1 (apaga apenas dados demo).
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcryptjs';
import {
  PrismaClient,
  type Prisma,
} from '../generated/prisma/client';
import { buildDatabaseConfig } from '../src/config/database-url';

function requireEnv(name: string, minLength = 1): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < minLength) {
    throw new Error(
      `A variável ${name} é obrigatória para o populate${
        minLength > 1 ? ` e deve ter ao menos ${minLength} caracteres` : ''
      }.`,
    );
  }
  return value;
}

const demoEmail = requireEnv('DEMO_EMAIL').toLowerCase();
const demoSenha = requireEnv('DEMO_PASSWORD', 8);

// Mesmo builder do seed: aplica TLS de verdade quando MYSQL_SSL=true.
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(buildDatabaseConfig()),
});

const DEMO_CLIENTE_EMAILS = [
  'joao.demo@atlas.com',
  'maria.demo@atlas.com',
  'frota@atlas.com',
] as const;

const DEMO_FORNECEDOR_EMAILS = ['supply@atlas.com', 'vidros@atlas.com'] as const;

const CHECKLIST_PADRAO = [
  'Desmontagem',
  'Preparação do veículo',
  'Aplicação da blindagem',
  'Remontagem',
  'Testes finais',
  'Entrega ao cliente',
];

type Tx = Prisma.TransactionClient;

async function registrarMovimentacao(
  tx: Tx,
  params: {
    produtoId: number;
    tipo: 'ENTRADA' | 'SAIDA';
    quantidade: number;
    custoUnitario: number;
    motivo: string | null;
    usuarioId: number;
    compraId?: number;
    projetoId?: number;
  },
) {
  const produto = await tx.produto.findUniqueOrThrow({
    where: { id: params.produtoId },
  });

  const estoqueAtual = Number(produto.quantidadeEstoque);
  const custoMedioAtual = Number(produto.custoMedio);
  const { quantidade, custoUnitario, tipo } = params;

  let novoEstoque: number;
  let novoCustoMedio = custoMedioAtual;

  if (tipo === 'ENTRADA') {
    novoEstoque = estoqueAtual + quantidade;
    const valorAtual = estoqueAtual * custoMedioAtual;
    const valorEntrada = quantidade * custoUnitario;
    novoCustoMedio =
      novoEstoque > 0
        ? (valorAtual + valorEntrada) / novoEstoque
        : custoUnitario;
  } else {
    if (estoqueAtual < quantidade) {
      throw new Error(`Estoque insuficiente: produto #${params.produtoId}`);
    }
    novoEstoque = estoqueAtual - quantidade;
  }

  await tx.movimentacao.create({
    data: {
      produtoId: params.produtoId,
      tipo,
      quantidade,
      custoUnitario,
      valorTotal: quantidade * custoUnitario,
      motivo: params.motivo,
      usuarioId: params.usuarioId,
      compraId: params.compraId ?? null,
      projetoId: params.projetoId ?? null,
    },
  });

  await tx.produto.update({
    where: { id: params.produtoId },
    data: {
      quantidadeEstoque: novoEstoque,
      custoMedio: novoCustoMedio,
    },
  });
}

/** Sem credencial padrão: o administrador vem do seed, com senha própria. */
async function findAdmin() {
  const admin = await prisma.usuario.findFirst({
    where: { cargo: 'ADMINISTRADOR', ativo: true },
    orderBy: { id: 'asc' },
  });
  if (!admin) {
    throw new Error('Nenhum administrador ativo. Rode `npm run db:seed` antes.');
  }
  return admin;
}

/**
 * Conta demo: sempre OPERADOR e ativa, com a senha atual de DEMO_PASSWORD.
 * Roda a cada populate para corrigir cargo/senha alterados por visitantes.
 */
async function ensureDemoUser() {
  const existente = await prisma.usuario.findUnique({ where: { email: demoEmail } });
  if (existente?.cargo === 'ADMINISTRADOR') {
    throw new Error('DEMO_EMAIL pertence a um administrador. Use outra conta.');
  }
  const senha = await bcrypt.hash(demoSenha, 10);
  return prisma.usuario.upsert({
    where: { email: demoEmail },
    update: { senha, cargo: 'OPERADOR', ativo: true },
    create: { nome: 'Visitante Demo', email: demoEmail, senha, cargo: 'OPERADOR' },
  });
}

async function resetDemoData() {
  const demoClientes = await prisma.cliente.findMany({
    where: { email: { in: [...DEMO_CLIENTE_EMAILS] } },
    select: { id: true },
  });
  const demoClienteIds = demoClientes.map((c) => c.id);

  if (demoClienteIds.length > 0) {
    await prisma.projeto.deleteMany({
      where: { clienteId: { in: demoClienteIds } },
    });
  }

  await prisma.receita.deleteMany({
    where: { descricao: { startsWith: '[DEMO]' } },
  });

  const demoCompras = await prisma.compra.findMany({
    where: { observacoes: { startsWith: '[DEMO]' } },
    select: { id: true },
  });
  const demoCompraIds = demoCompras.map((c) => c.id);

  if (demoCompraIds.length > 0) {
    await prisma.movimentacao.deleteMany({
      where: { compraId: { in: demoCompraIds } },
    });
    await prisma.compra.deleteMany({
      where: { id: { in: demoCompraIds } },
    });
  }

  await prisma.movimentacao.deleteMany({
    where: { motivo: { startsWith: '[DEMO]' } },
  });

  await prisma.despesa.deleteMany({
    where: { descricao: { startsWith: '[DEMO]' } },
  });

  await prisma.veiculo.deleteMany({
    where: { placa: { startsWith: 'DEM' } },
  });
  await prisma.cliente.deleteMany({
    where: { email: { in: [...DEMO_CLIENTE_EMAILS] } },
  });
  await prisma.fornecedor.deleteMany({
    where: { email: { in: [...DEMO_FORNECEDOR_EMAILS] } },
  });
  await prisma.produto.deleteMany({
    where: { codigo: { startsWith: 'DEMO-' } },
  });

}

async function isAlreadyPopulated() {
  const count = await prisma.cliente.count({
    where: { email: 'joao.demo@atlas.com' },
  });
  return count > 0;
}

async function main() {
  const operador = await ensureDemoUser();

  if (process.env.POPULATE_RESET === '1') {
    // eslint-disable-next-line no-console
    console.log('POPULATE_RESET=1 — removendo dados demo anteriores…');
    await resetDemoData();
  } else if (await isAlreadyPopulated()) {
    // eslint-disable-next-line no-console
    console.log(
      'Dados demo já existem. Use POPULATE_RESET=1 para repopular ou apague manualmente.',
    );
    return;
  }

  const admin = await findAdmin();

  // Só autora de registros demo: senha aleatória e descartada, ninguém entra com ela.
  const gerente = await prisma.usuario.upsert({
    where: { email: 'gerente@atlas.com' },
    update: {},
    create: {
      nome: 'Carla Gerente',
      email: 'gerente@atlas.com',
      senha: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
      cargo: 'GERENTE',
    },
  });

  const categoriasNomes = ['Vidros', 'Aço', 'Manta Balística', 'Acessórios'];
  const categorias: Record<string, { id: number }> = {};
  for (const nome of categoriasNomes) {
    const cat = await prisma.categoria.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
    categorias[nome] = cat;
  }

  for (const nome of ['Operacional', 'Materiais', 'Salários', 'Impostos']) {
    await prisma.categoriaDespesa.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }

  const catMateriais = await prisma.categoriaDespesa.findUniqueOrThrow({
    where: { nome: 'Materiais' },
  });
  const catOperacional = await prisma.categoriaDespesa.findUniqueOrThrow({
    where: { nome: 'Operacional' },
  });

  const produtosData = [
    {
      codigo: 'DEMO-VID-001',
      nome: 'Vidro laminado blindado 8mm',
      categoriaId: categorias['Vidros'].id,
      unidadeMedida: 'M²',
      valorUnitario: 850,
      estoqueInicial: 12,
    },
    {
      codigo: 'DEMO-ACO-001',
      nome: 'Chapa aço balístico NIJ III',
      categoriaId: categorias['Aço'].id,
      unidadeMedida: 'M²',
      valorUnitario: 1200,
      estoqueInicial: 8,
    },
    {
      codigo: 'DEMO-MAN-001',
      nome: 'Manta balística Kevlar',
      categoriaId: categorias['Manta Balística'].id,
      unidadeMedida: 'M²',
      valorUnitario: 420,
      estoqueInicial: 25,
    },
    {
      codigo: 'DEMO-ACE-001',
      nome: 'Kit acabamento interno',
      categoriaId: categorias['Acessórios'].id,
      unidadeMedida: 'UN',
      valorUnitario: 180,
      estoqueInicial: 15,
    },
    {
      codigo: 'DEMO-VID-002',
      nome: 'Vidro lateral reforçado',
      categoriaId: categorias['Vidros'].id,
      unidadeMedida: 'UN',
      valorUnitario: 950,
      estoqueInicial: 2,
    },
  ] as const;

  const produtos: Record<string, { id: number; valorUnitario: number }> = {};

  for (const p of produtosData) {
    const existing = await prisma.produto.findUnique({
      where: { codigo: p.codigo },
    });
    if (existing) {
      produtos[p.codigo] = {
        id: existing.id,
        valorUnitario: Number(existing.valorUnitario),
      };
      continue;
    }

    const created = await prisma.$transaction(async (tx) => {
      const produto = await tx.produto.create({
        data: {
          codigo: p.codigo,
          nome: p.nome,
          categoriaId: p.categoriaId,
          unidadeMedida: p.unidadeMedida,
          valorUnitario: p.valorUnitario,
          quantidadeEstoque: p.estoqueInicial,
          custoMedio: p.valorUnitario,
        },
      });

      if (p.estoqueInicial > 0) {
        await tx.movimentacao.create({
          data: {
            produtoId: produto.id,
            tipo: 'ENTRADA',
            quantidade: p.estoqueInicial,
            custoUnitario: p.valorUnitario,
            valorTotal: p.estoqueInicial * p.valorUnitario,
            motivo: '[DEMO] Estoque inicial',
            usuarioId: admin.id,
          },
        });
      }

      return produto;
    });

    produtos[p.codigo] = {
      id: created.id,
      valorUnitario: Number(created.valorUnitario),
    };
  }

  const fornecedor = await prisma.fornecedor.create({
    data: {
      nomeRazaoSocial: 'Blindagem Supply Ltda',
      cpfCnpj: '04252011000110',
      telefone: '11987654321',
      email: 'supply@atlas.com',
    },
  });

  const fornecedor2 = await prisma.fornecedor.create({
    data: {
      nomeRazaoSocial: 'Vidros Premium SA',
      cpfCnpj: '11444777000161',
      telefone: '11976543210',
      email: 'vidros@atlas.com',
    },
  });

  const cliente1 = await prisma.cliente.create({
    data: {
      tipo: 'PF',
      nomeCompleto: 'João Carlos Mendes',
      cpfCnpj: '52998224725',
      telefone: '11999887766',
      email: 'joao.demo@atlas.com',
      cep: '04438000',
      rua: 'Rua David Eid',
      numero: '120',
      bairro: 'Vila do Castelo',
      cidade: 'São Paulo',
      estado: 'SP',
    },
  });

  const cliente2 = await prisma.cliente.create({
    data: {
      tipo: 'PF',
      nomeCompleto: 'Maria Fernanda Lima',
      cpfCnpj: '39053344705',
      telefone: '11988776655',
      email: 'maria.demo@atlas.com',
      cep: '01310100',
      rua: 'Av. Paulista',
      numero: '1000',
      complemento: 'Sala 42',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
    },
  });

  const cliente3 = await prisma.cliente.create({
    data: {
      tipo: 'PJ',
      nomeCompleto: 'Transporte Executivo Ltda',
      cpfCnpj: '11222333000181',
      telefone: '1133221100',
      email: 'frota@atlas.com',
      cep: '04547006',
      rua: 'Av. Eng. Luís Carlos Berrini',
      numero: '500',
      bairro: 'Brooklin',
      cidade: 'São Paulo',
      estado: 'SP',
    },
  });

  const veiculo1 = await prisma.veiculo.create({
    data: {
      clienteId: cliente1.id,
      placa: 'DEM1A23',
      marca: 'Toyota',
      modelo: 'SW4',
      ano: '2024',
      cor: 'Preto',
      observacoesTecnicas: 'Blindagem nível III-A',
    },
  });

  const veiculo2 = await prisma.veiculo.create({
    data: {
      clienteId: cliente2.id,
      placa: 'DEM2B45',
      marca: 'BMW',
      modelo: 'X5',
      ano: '2023',
      cor: 'Cinza',
    },
  });

  const veiculo3 = await prisma.veiculo.create({
    data: {
      clienteId: cliente3.id,
      placa: 'DEM3C67',
      marca: 'Mercedes-Benz',
      modelo: 'Sprinter',
      ano: '2022',
      cor: 'Branco',
      observacoesTecnicas: 'Frota corporativa — 12 passageiros',
    },
  });

  // Compra paga (sem entrada no estoque — aguarda confirmação de recebimento)
  const compraPaga = await prisma.$transaction(async (tx) => {
    const itens = [
      {
        produtoId: produtos['DEMO-VID-001'].id,
        quantidade: 10,
        valorUnitario: 820,
      },
      {
        produtoId: produtos['DEMO-MAN-001'].id,
        quantidade: 20,
        valorUnitario: 400,
      },
    ];
    const valorTotal = itens.reduce(
      (s, i) => s + i.quantidade * i.valorUnitario,
      0,
    );

    const compra = await tx.compra.create({
      data: {
        fornecedorId: fornecedor.id,
        status: 'A_PAGAR',
        valorTotal,
        observacoes: '[DEMO] Reposição mensal — paga, aguardando recebimento',
        usuarioId: gerente.id,
        itens: {
          create: itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
            valorTotal: i.quantidade * i.valorUnitario,
          })),
        },
      },
    });

    await tx.despesa.create({
      data: {
        descricao: `Compra #${compra.id} — ${fornecedor.nomeRazaoSocial}`,
        valor: valorTotal,
        status: 'A_PAGAR',
        fornecedorId: fornecedor.id,
        compraId: compra.id,
        categoriaDespesaId: catMateriais.id,
      },
    });

    return { compra, itens, valorTotal };
  });

  const dataPagamento = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.compra.update({
      where: { id: compraPaga.compra.id },
      data: {
        status: 'PAGO',
        dataPagamento,
        despesa: {
          update: {
            status: 'PAGO',
            dataPagamento,
          },
        },
      },
    });
  });

  // Compra confirmada (paga + recebida, com entrada no estoque)
  const compraConfirmada = await prisma.$transaction(async (tx) => {
    const itens = [
      {
        produtoId: produtos['DEMO-ACO-001'].id,
        quantidade: 5,
        valorUnitario: 1150,
      },
    ];
    const valorTotal = itens.reduce(
      (s, i) => s + i.quantidade * i.valorUnitario,
      0,
    );

    const compra = await tx.compra.create({
      data: {
        fornecedorId: fornecedor2.id,
        status: 'A_PAGAR',
        valorTotal,
        observacoes: '[DEMO] Pedido de chapas — recebido e confirmado',
        usuarioId: operador.id,
        itens: {
          create: itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
            valorTotal: i.quantidade * i.valorUnitario,
          })),
        },
      },
    });

    await tx.despesa.create({
      data: {
        descricao: `Compra #${compra.id} — ${fornecedor2.nomeRazaoSocial}`,
        valor: valorTotal,
        status: 'A_PAGAR',
        dataVencimento: new Date(Date.now() + 7 * 86400000),
        fornecedorId: fornecedor2.id,
        compraId: compra.id,
        categoriaDespesaId: catMateriais.id,
      },
    });

    return { compra, itens };
  });

  await prisma.$transaction(async (tx) => {
    await tx.compra.update({
      where: { id: compraConfirmada.compra.id },
      data: {
        status: 'PAGO',
        dataPagamento,
        despesa: {
          update: {
            status: 'PAGO',
            dataPagamento,
          },
        },
      },
    });

    for (const item of compraConfirmada.itens) {
      await registrarMovimentacao(tx, {
        produtoId: item.produtoId,
        tipo: 'ENTRADA',
        quantidade: item.quantidade,
        custoUnitario: item.valorUnitario,
        motivo: `[DEMO] Recebimento — Compra #${compraConfirmada.compra.id}`,
        usuarioId: operador.id,
        compraId: compraConfirmada.compra.id,
      });
    }

    await tx.compra.update({
      where: { id: compraConfirmada.compra.id },
      data: { status: 'CONFIRMADA' },
    });
  });

  // Compra a pagar
  await prisma.$transaction(async (tx) => {
    const itens = [
      {
        produtoId: produtos['DEMO-ACE-001'].id,
        quantidade: 3,
        valorUnitario: 95,
      },
    ];
    const valorTotal = itens.reduce(
      (s, i) => s + i.quantidade * i.valorUnitario,
      0,
    );

    const compra = await tx.compra.create({
      data: {
        fornecedorId: fornecedor.id,
        status: 'A_PAGAR',
        valorTotal,
        observacoes: '[DEMO] Pedido de acessórios — aguardando pagamento',
        usuarioId: operador.id,
        itens: {
          create: itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
            valorTotal: i.quantidade * i.valorUnitario,
          })),
        },
      },
    });

    await tx.despesa.create({
      data: {
        descricao: `Compra #${compra.id} — ${fornecedor.nomeRazaoSocial}`,
        valor: valorTotal,
        status: 'A_PAGAR',
        fornecedorId: fornecedor.id,
        compraId: compra.id,
        categoriaDespesaId: catMateriais.id,
      },
    });
  });

  // Compra cancelada
  await prisma.$transaction(async (tx) => {
    const itens = [
      {
        produtoId: produtos['DEMO-MAN-001'].id,
        quantidade: 2,
        valorUnitario: 400,
      },
    ];
    const valorTotal = itens.reduce(
      (s, i) => s + i.quantidade * i.valorUnitario,
      0,
    );

    const compra = await tx.compra.create({
      data: {
        fornecedorId: fornecedor2.id,
        status: 'CANCELADA',
        valorTotal,
        observacoes: '[DEMO] Pedido cancelado pelo fornecedor',
        usuarioId: gerente.id,
        itens: {
          create: itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
            valorTotal: i.quantidade * i.valorUnitario,
          })),
        },
      },
    });

    await tx.despesa.create({
      data: {
        descricao: `Compra #${compra.id} — ${fornecedor2.nomeRazaoSocial}`,
        valor: valorTotal,
        status: 'CANCELADA',
        fornecedorId: fornecedor2.id,
        compraId: compra.id,
        categoriaDespesaId: catMateriais.id,
      },
    });
  });

  // Saída manual de estoque
  await prisma.$transaction(async (tx) => {
    await registrarMovimentacao(tx, {
      produtoId: produtos['DEMO-ACE-001'].id,
      tipo: 'SAIDA',
      quantidade: 2,
      custoUnitario: produtos['DEMO-ACE-001'].valorUnitario,
      motivo: '[DEMO] Ajuste de inventário',
      usuarioId: operador.id,
    });
  });

  async function criarProjeto(
    input: {
      clienteId: number;
      veiculoId: number;
      status: 'AGUARDANDO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';
      descricao: string;
      valorOrcado: number;
      valorFinal?: number;
      checklistConcluidos?: number;
      usuarioId: number;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const projeto = await tx.projeto.create({
        data: {
          clienteId: input.clienteId,
          veiculoId: input.veiculoId,
          status: input.status,
          descricao: input.descricao,
          valorOrcado: input.valorOrcado,
          valorFinal: input.valorFinal ?? null,
          dataInicio:
            input.status !== 'AGUARDANDO' ? new Date(Date.now() - 15 * 86400000) : null,
          dataConclusao:
            input.status === 'CONCLUIDO' || input.status === 'CANCELADO'
              ? new Date()
              : null,
          usuarioId: input.usuarioId,
          checklist: {
            create: CHECKLIST_PADRAO.map((descricao, ordem) => ({
              descricao,
              ordem,
              concluido: ordem < (input.checklistConcluidos ?? 0),
              concluidoEm:
                ordem < (input.checklistConcluidos ?? 0) ? new Date() : null,
            })),
          },
        },
      });

      await tx.projetoHistorico.create({
        data: {
          projetoId: projeto.id,
          statusNovo: 'AGUARDANDO',
          observacao: '[DEMO] Projeto criado.',
          usuarioId: input.usuarioId,
        },
      });

      if (input.status !== 'AGUARDANDO') {
        await tx.projetoHistorico.create({
          data: {
            projetoId: projeto.id,
            statusAnterior: 'AGUARDANDO',
            statusNovo: input.status,
            observacao: '[DEMO] Atualização de status.',
            usuarioId: input.usuarioId,
          },
        });
      }

      return projeto;
    });
  }

  const projetoAguardando = await criarProjeto({
    clienteId: cliente3.id,
    veiculoId: veiculo3.id,
    status: 'AGUARDANDO',
    descricao: '[DEMO] Blindagem Sprinter corporativa',
    valorOrcado: 185000,
    usuarioId: gerente.id,
  });

  const projetoAndamento = await criarProjeto({
    clienteId: cliente1.id,
    veiculoId: veiculo1.id,
    status: 'EM_ANDAMENTO',
    descricao: '[DEMO] Blindagem SW4 nível III-A',
    valorOrcado: 98000,
    checklistConcluidos: 3,
    usuarioId: operador.id,
  });

  const projetoConcluido = await criarProjeto({
    clienteId: cliente2.id,
    veiculoId: veiculo2.id,
    status: 'CONCLUIDO',
    descricao: '[DEMO] Blindagem BMW X5 concluída',
    valorOrcado: 125000,
    valorFinal: 122500,
    checklistConcluidos: 6,
    usuarioId: gerente.id,
  });

  // Consumo de material no projeto em andamento
  await prisma.$transaction(async (tx) => {
    const qtd = 4;
    const custo = produtos['DEMO-MAN-001'].valorUnitario;
    await registrarMovimentacao(tx, {
      produtoId: produtos['DEMO-MAN-001'].id,
      tipo: 'SAIDA',
      quantidade: qtd,
      custoUnitario: custo,
      motivo: `[DEMO] Consumo projeto #${projetoAndamento.id}`,
      usuarioId: operador.id,
      projetoId: projetoAndamento.id,
    });

    await tx.projetoConsumo.create({
      data: {
        projetoId: projetoAndamento.id,
        tipo: 'PRODUTO',
        produtoId: produtos['DEMO-MAN-001'].id,
        quantidade: qtd,
        valorUnitario: custo,
        valorTotal: qtd * custo,
        usuarioId: operador.id,
      },
    });

    await tx.projetoConsumo.create({
      data: {
        projetoId: projetoAndamento.id,
        tipo: 'SERVICO',
        descricao: 'Instalação elétrica auxiliar',
        quantidade: 1,
        valorUnitario: 850,
        valorTotal: 850,
        usuarioId: operador.id,
      },
    });
  });

  // Financeiro avulso
  await prisma.despesa.create({
    data: {
      descricao: '[DEMO] Energia elétrica — unidade',
      valor: 4200,
      status: 'A_PAGAR',
      dataVencimento: new Date(Date.now() + 5 * 86400000),
      categoriaDespesaId: catOperacional.id,
    },
  });

  await prisma.despesa.create({
    data: {
      descricao: '[DEMO] Manutenção equipamentos',
      valor: 1800,
      status: 'PAGO',
      dataPagamento: new Date(Date.now() - 3 * 86400000),
      categoriaDespesaId: catOperacional.id,
    },
  });

  await prisma.receita.create({
    data: {
      descricao: '[DEMO] Entrada projeto BMW X5',
      valor: 122500,
      status: 'RECEBIDO',
      dataRecebimento: new Date(Date.now() - 2 * 86400000),
      clienteId: cliente2.id,
      projetoId: projetoConcluido.id,
    },
  });

  await prisma.receita.create({
    data: {
      descricao: '[DEMO] Sinal projeto SW4',
      valor: 30000,
      status: 'A_RECEBER',
      dataVencimento: new Date(Date.now() + 10 * 86400000),
      clienteId: cliente1.id,
      projetoId: projetoAndamento.id,
    },
  });

  await prisma.receita.create({
    data: {
      descricao: '[DEMO] Proposta Sprinter — aguardando aprovação',
      valor: 185000,
      status: 'A_RECEBER',
      dataVencimento: new Date(Date.now() + 20 * 86400000),
      clienteId: cliente3.id,
      projetoId: projetoAguardando.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log('\nPopulate concluído com sucesso.\n');
  // eslint-disable-next-line no-console
  console.log(`  Conta demo (OPERADOR): ${demoEmail}`);
  // eslint-disable-next-line no-console
  console.log('\n── Resumo demo ──');
  // eslint-disable-next-line no-console
  console.log(`  ${Object.keys(produtos).length} produtos (códigos DEMO-*)`);
  // eslint-disable-next-line no-console
  console.log('  3 clientes, 3 veículos, 2 fornecedores');
  // eslint-disable-next-line no-console
  console.log('  4 compras (1 confirmada, 1 paga, 1 a pagar, 1 cancelada), 3 projetos, despesas e receitas');
  // eslint-disable-next-line no-console
  console.log('\nPara repopular: POPULATE_RESET=1 npm run db:populate\n');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
