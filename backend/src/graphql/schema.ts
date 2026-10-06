/**
 * Contrato GraphQL (schema-first). Somente leitura: as escritas continuam no
 * REST, que concentra validação e regras de negócio. Os argumentos das
 * consultas são validados pelos MESMOS schemas Zod do REST, por isso não há
 * defaults aqui — os limites de paginação têm uma única fonte de verdade.
 */
export const typeDefs = /* GraphQL */ `
  scalar DateTime
  scalar Decimal

  enum Cargo {
    ADMINISTRADOR
    GERENTE
    OPERADOR
  }

  enum CompraStatus {
    A_PAGAR
    CONFIRMADA
    PAGO
    CANCELADA
  }

  type Query {
    me: Usuario!

    categorias(page: Int, limit: Int, search: String): CategoriaPage!

    produtos(page: Int, limit: Int, search: String, ativo: Boolean): ProdutoPage!
    produto(id: Int!): Produto!

    compras(
      page: Int
      limit: Int
      search: String
      status: CompraStatus
      fornecedorId: Int
    ): CompraPage!
    compra(id: Int!): Compra!
  }

  type Usuario {
    id: Int!
    nome: String!
    email: String!
    cargo: Cargo!
  }

  type Categoria {
    id: Int!
    nome: String!
    descricao: String
    ativo: Boolean!
    totalProdutos: Int!
  }

  type CategoriaPage {
    data: [Categoria!]!
    total: Int!
    page: Int!
    limit: Int!
  }

  type Produto {
    id: Int!
    codigo: String!
    nome: String!
    descricao: String
    unidadeMedida: String!
    valorUnitario: Decimal!
    quantidadeEstoque: Decimal!
    custoMedio: Decimal!
    ativo: Boolean!
    categoria: Categoria
  }

  type ProdutoPage {
    data: [Produto!]!
    total: Int!
    page: Int!
    limit: Int!
  }

  type Fornecedor {
    id: Int!
    nomeRazaoSocial: String!
  }

  type CompraItem {
    id: Int!
    quantidade: Decimal!
    valorUnitario: Decimal!
    valorTotal: Decimal!
    produto: Produto!
  }

  type Compra {
    id: Int!
    status: CompraStatus!
    dataCompra: DateTime!
    dataPagamento: DateTime
    valorTotal: Decimal!
    observacoes: String
    fornecedor: Fornecedor!
    itens: [CompraItem!]!
  }

  type CompraPage {
    data: [Compra!]!
    total: Int!
    page: Int!
    limit: Int!
  }
`;
