# Atlas Stock — Backend (NestJS)

API do ERP de gestão de blindagem de veículos. Migração do sistema PHP legado
para uma arquitetura **NestJS + Prisma 7 + MySQL**, tipada e testada.

## Stack

- **NestJS 11** (arquitetura modular: controller → service → repository)
- **Prisma 7** com driver adapter `@prisma/adapter-mariadb` + **MySQL**
- **Zod** via `nestjs-zod` (validação global de toda entrada)
- **JWT** access + refresh (rotação e revogação) + `bcryptjs`
- **helmet**, CORS travado por env, rate limiting (`@nestjs/throttler`)
- **pino** (logs estruturados), **Swagger** em `/api/docs`
- **Vitest** para testes

## Arquitetura em camadas

```
Controller (HTTP)  →  Service (regra de negócio)  →  Repository (Prisma)
```

O controller nunca acessa o Prisma direto. Toda resposta de erro sai no
formato padrão `{ error: { code, message } }` (filtro global de exceções).

## Como rodar

1. **Instalar dependências**
   ```bash
   npm install
   ```
2. **Configurar ambiente** — copie `.env.example` para `.env` e ajuste as
   variáveis `MYSQL_*`, `JWT_*` e `CORS_ORIGIN`:
   ```bash
   cp .env.example .env
   ```
3. **Gerar o Prisma Client**
   ```bash
   npm run prisma:generate
   ```
4. **Aplicar as migrations** (cria as tabelas no seu MySQL):
   ```bash
   npm run prisma:deploy
   ```
5. **Popular dados iniciais** (usuário admin + categorias):
   ```bash
   npm run db:seed
   ```
6. **Popular dados de demonstração** (opcional — cadastros, compras, projetos, financeiro):
   ```bash
   npm run db:populate
   ```
   Para repopular do zero: `POPULATE_RESET=1 npm run db:populate`
7. **Subir a API**
   ```bash
   npm run start:dev
   ```
   - API: `http://localhost:3000/api`
   - Docs (Swagger): `http://localhost:3000/api/docs`
   - Health: `GET /api/health` e `GET /api/health/ready`

> Login inicial (definido no seed): `admin@atlas.com`
> (altere via `SEED_ADMIN_*` no `.env`).

## Migrations (fluxo Prisma-owned)

O schema evolui em `prisma/schema.prisma`. A cada fase, o agente edita o schema
e **gera** os arquivos de migration; **você** aplica com `prisma migrate deploy`
— o agente nunca conecta no seu banco.

A migration inicial (`20260717120000_init`) cobre a **Fase 1**: autenticação +
cadastros (usuários, categorias, produtos, fornecedores, clientes, veículos,
movimentações de estoque).

## Escopo por fase

| Fase | Módulos | Status |
|------|---------|--------|
| 1 | Auth (JWT) + Cadastros + Estoque | ✅ implementado |
| 2 | Compras (+ despesa vinculada) | ✅ implementado |
| 3 | Projetos + Checklist + Consumo | ✅ implementado |
| 4 | Financeiro + Dashboard | ✅ implementado |

## Testes

```bash
npm test          # unit (Vitest)
npm run test:cov  # cobertura
```

## Decisões

- **Segredos só em env** — nada de credencial no código (o legado tinha a senha
  do banco hardcoded em `config/database.php`; aqui vai para `.env`).
- **Exclusão lógica** (`ativo = false`) como padrão nos cadastros; exclusão
  física apenas quando não há vínculos e restrita a Administrador.
- **Estoque transacional** — criar produto com estoque inicial e registrar
  movimentações ajustam saldo e custo médio dentro de uma transação Prisma.
- **RBAC em guard** (`@Roles`), nunca no controller.

## GraphQL (somente leitura)

Endpoint: `POST /api/graphql` (mesma autenticação Bearer do REST). Escritas continuam apenas no REST.

- Consultas: `me`, `categorias`, `produtos`, `produto(id)`, `compras`, `compra(id)`.
- Sem regra própria: os resolvers delegam aos mesmos services do REST e validam argumentos com os mesmos schemas Zod (ex.: `limit <= 100`).
- Campos aninhados usam DataLoader (1 consulta por tipo, sem N+1).
- Limites: profundidade máxima 6; introspecção e landing page desativadas em `NODE_ENV=production`; erros internos mascarados.
- Contrato: `src/graphql/schema.ts`. Em desenvolvimento, use introspecção para explorar.
