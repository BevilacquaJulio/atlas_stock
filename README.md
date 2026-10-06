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

Copie `frontend/.env.example` para `frontend/.env`. O front chama a API por
caminho relativo (`/api`) e, no ambiente local, o Vite faz proxy de `/api` para
`http://localhost:3000`; `VITE_API_URL` só é necessário para apontar outra API.

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

## Deploy com Docker

O `docker-compose.yml` pressupõe que o servidor já possui:

- Traefik configurado e conectado à rede externa `traefik`.
- MySQL ou MariaDB conectado à rede externa `mysql_shared`.
- DNS do domínio principal e do subdomínio `api` apontando para o servidor.
- Banco e usuário da aplicação previamente criados.

### 1. Preparar o ambiente

Copie `.env.example` para `.env` na raiz e substitua todos os valores de
exemplo:

```bash
cp .env.example .env
```

Configurações essenciais:

```env
DOMAIN=g5.seudominio.com.br
MYSQL_HOST=nome-do-container-mysql
MYSQL_PORT=3306
MYSQL_USER=g5_user
MYSQL_PASSWORD=senha-forte
MYSQL_DATABASE=g5
MYSQL_SSL=true
MYSQL_SSL_REJECT_UNAUTHORIZED=false
MYSQL_SSL_CA_PATH=/run/secrets/mysql-ca.pem
JWT_ACCESS_SECRET=segredo-forte-e-exclusivo
JWT_REFRESH_SECRET=outro-segredo-forte-e-exclusivo
CORS_ORIGIN=https://g5.seudominio.com.br
SEED_ADMIN_EMAIL=admin@atlas.com
SEED_ADMIN_PASSWORD=senha-forte-do-administrador
SEED_FINANCEIRO_SENHA=senha-forte-do-financeiro
```

`MYSQL_HOST` deve ser o nome resolvível do container MySQL dentro da rede
`mysql_shared`. Não use `localhost`. Com MySQL 8.4, `MYSQL_SSL=true` força uma
conexão TLS. O valor `MYSQL_SSL_REJECT_UNAUTHORIZED=false` mantém a conexão
criptografada, mas aceita o certificado autoassinado usado na rede Docker
privada; prefira `true` quando instalar um certificado confiável no MySQL.
Antes do build, copie a CA pública do container MySQL para o caminho montado
pelos serviços:

```bash
mkdir -p secrets
docker cp mysql_shared:/var/lib/mysql/ca.pem secrets/mysql-ca.pem
chmod 644 secrets/mysql-ca.pem
```

### 2. Confirmar as redes externas

As redes `traefik` e `mysql_shared` devem existir antes da inicialização dos
serviços:

```bash
docker network ls
```

### 3. Aplicar migrations

O serviço `migrate` utiliza o profile `tools` e não inicia junto com a
aplicação. Execute-o manualmente antes do primeiro deploy e sempre que houver
novas migrations:

```bash
docker compose run --rm migrate
```

As migrations Prisma já incluem as alterações de status de compras. Não
execute `sql/compra_status.sql` se a migration correspondente já tiver sido
aplicada.

### 4. Criar o administrador inicial

No primeiro deploy:

```bash
docker compose run --rm migrate npx ts-node prisma/seed.ts
```

O seed exige `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` e
`SEED_FINANCEIRO_SENHA` definidos no `.env`. As duas senhas devem ter pelo
menos 12 caracteres e não são exibidas nos logs.

### 5. Construir e iniciar a aplicação

```bash
docker compose up -d --build
```

Esse comando constrói e inicia `api` e `web`. O serviço `migrate` permanece
fora da inicialização automática.

### 6. Verificar o deploy

Consulte os serviços e os logs:

```bash
docker compose ps
docker compose logs --tail=100 api web
```

Endpoints esperados:

- Frontend: `https://g5.seudominio.com.br`
- API: `https://g5.seudominio.com.br/api` (também em `https://api.g5.seudominio.com.br/api`)
- Health check: `https://g5.seudominio.com.br/api/health`
- Banco de dados: `https://g5.seudominio.com.br/api/health/ready`
- Swagger: `https://g5.seudominio.com.br/api/docs`

O endpoint `/api/health/ready` deve responder com `database: "up"`.

## Atualização em produção

A produção é atualizada pelo pipeline do GitHub Actions: todo merge na `main`
passa pela CI, publica imagens no GHCR (tag = SHA) e faz o deploy na VPS por
SSH, com gate de aprovação e backup quando há migration nova. Detalhes,
rollback e configuração da VPS em [docs/ci-cd.md](./docs/ci-cd.md).

Os passos acima (`docker-compose.yml` na raiz, com build local) continuam
válidos para uma instalação manual fora do pipeline.

## Variáveis de ambiente

Nunca versionar arquivos `.env`. Variáveis prefixadas com `VITE_` são públicas
e ficam incorporadas ao bundle do frontend; não armazene segredos nelas.

Os segredos de access token e refresh token devem ser longos, distintos e
exclusivos por ambiente.

## Documentação adicional

- [Backend](./backend/README.md)
- [Frontend](./frontend/README.md)
- [Exemplo de ambiente Docker](./.env.example)

## Licença

Projeto privado. Uso e distribuição restritos aos responsáveis pelo sistema.
