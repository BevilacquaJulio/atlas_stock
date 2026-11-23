# Atlas Stock

Sistema web para gestão operacional e financeira de empresas de blindagem
automotiva. A aplicação centraliza cadastros, compras, estoque, projetos,
consumo de materiais e movimentações financeiras.

## Funcionalidades

- Dashboard com indicadores operacionais e alertas.
- Cadastro de clientes, veículos, fornecedores, categorias e produtos.
- Controle de compras, pagamentos, confirmação de recebimento e estoque.
- Movimentações manuais de entrada e saída de produtos.
- Projetos vinculados a clientes e veículos.
- Checklist, histórico de status e consumo de produtos ou serviços por projeto.
- Controle de receitas e despesas.
- Autenticação com access token, refresh token e controle de acesso por função.
- Paginação, pesquisa, filtros e exclusão lógica de registros.

## Arquitetura

O repositório é organizado como um monorepo:

```text
g5/
├── backend/             API NestJS, Prisma e testes
├── frontend/            Aplicação React
├── sql/                 Scripts SQL para execução manual
├── docker-compose.yml   Orquestração dos serviços de produção
└── .env.example         Exemplo de configuração para Docker
```

O backend segue a separação:

```text
Controller -> Service -> Repository -> Prisma -> MySQL
```

O frontend concentra as chamadas HTTP em um cliente Axios e utiliza TanStack
Query para gerenciar os dados do servidor.

## Tecnologias

### Backend

- Node.js 22
- NestJS 11
- TypeScript
- Prisma 7 com MySQL/MariaDB
- Zod e `nestjs-zod`
- JWT com rotação de refresh token
- Vitest

### Frontend

- React 19
- Vite 6
- TypeScript
- React Router
- TanStack Query
- React Hook Form e Zod
- Tailwind CSS 4
- Vitest e Testing Library

### Infraestrutura

- Docker e Docker Compose
- Nginx para servir o frontend
- Traefik para roteamento e TLS
- MySQL ou MariaDB

## Requisitos para desenvolvimento

- Node.js 22 ou versão compatível
- npm
- MySQL ou MariaDB acessível

## Configuração local

### 1. Backend

Entre no diretório do backend e instale as dependências:

```bash
cd backend
npm install
```

Copie `backend/.env.example` para `backend/.env` e configure as credenciais do
banco, os segredos JWT e a origem permitida pelo CORS.

Crie o banco manualmente usando `sql/create_database.sql` em uma ferramenta
como DBeaver, phpMyAdmin ou MySQL Workbench. Em seguida, gere o Prisma Client e
aplique as migrations:

```bash
npm run prisma:generate
npm run prisma:deploy
```

Crie o usuário administrador inicial:

```bash
npm run db:seed
```

Inicie a API:

```bash
npm run start:dev
```

A API ficará disponível em `http://localhost:3000/api`.

### 2. Frontend

Em outro terminal:

```bash
cd frontend
npm install
```

Copie `frontend/.env.example` para `frontend/.env`. Para o ambiente local, a
configuração padrão é:

```env
VITE_API_URL=/api
```

Inicie o frontend:

```bash
npm run dev
```

A aplicação ficará disponível em `http://localhost:5173`.

## Dados de demonstração

Depois de aplicar as migrations e executar o seed, dados de demonstração podem
ser adicionados com:

```bash
cd backend
npm run db:populate
```

Não utilize a opção de limpeza do populate em produção. Ela pode remover dados
existentes.

## Testes e validação

Execute os comandos nos respectivos diretórios.

Backend:

```bash
npm test
npm run build
```

Frontend:

```bash
npm test
npm run build
```

## Deploy com GitHub Actions

O deploy oficial usa CI em PRs e CD após merge na main, com imagens por SHA no GHCR.
Consulte [o guia de CI/CD](docs/ci-cd.md) para configuração do GitHub, VPS, migrations e rollback.

Domínios: https://atlastock.bevilabs.com.br e https://api.atlastock.bevilabs.com.br.

O docker-compose.yml da raiz é uma alternativa de build local/manual; a produção usa deploy/compose.prod.yml.

## Licença

Uso e distribuição sujeitos à autorização dos responsáveis pelo sistema.
