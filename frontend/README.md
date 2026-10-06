# Atlas Stock — Frontend (React)

Interface do ERP de blindagem de veículos. Migração do frontend PHP/vanilla para
**React + Vite + TypeScript**, consumindo a API NestJS.

## Stack

- **React 19 + Vite 6 + TypeScript** (strict)
- **TanStack Query** para todo estado de servidor (loading/error/empty tratados)
- **React Router 7** com rotas lazy-loaded
- **React Hook Form + Zod** em todos os formulários
- **Tailwind CSS v4** (via `@tailwindcss/vite`) — tema monocromático do Design System
- **axios** — cliente central em `src/lib/api.ts` com refresh automático de token
- **Vitest + Testing Library**

## Como rodar

1. **Instalar**
   ```bash
   npm install
   ```
2. **Configurar** — copie `.env.example` para `.env`:
   ```bash
   cp .env.example .env   # VITE_API_URL=/api
   ```
3. **Subir** (com o backend já rodando):
   ```bash
   npm run dev            # http://localhost:5173
   ```
4. **Login**: use o e-mail admin configurado no seed (ex.: `admin@atlas.com`).

## Arquitetura

```
src/
  app/         # roteamento, layout, providers (QueryClient, Router)
  components/  # UI reutilizável (Button, campos de form, Modal, tabela…)
  features/
    <recurso>/
      <recurso>.types.ts   # tipos
      <recurso>.api.ts     # chamadas à API (via cliente central)
      <recurso>.hooks.ts   # useXxxQuery / useXxxMutation (React Query)
      <Recurso>Page.tsx    # página (lista + estados)
      <Recurso>Form.tsx    # formulário (RHF + Zod)
  lib/         # cliente axios, tokens, formatação, tipos compartilhados
  hooks/       # hooks genéricos
```

### Autenticação
- Access token vive **em memória**; refresh token em `localStorage`.
- O interceptor do axios anexa o Bearer token e, em 401, tenta **refresh
  automático** uma vez antes de deslogar.
- `AuthProvider` + `useAuth` expõem `user`, `status`, `login`, `logout`.
- `ProtectedRoute` bloqueia rotas autenticadas.

## Módulos (Fase 1 — Cadastros)

Clientes, Veículos, Produtos, Fornecedores, Categorias e Movimentações de
estoque — cada um com listagem paginada + busca e formulário de criação/edição.
Dashboard em `/`, Financeiro em `/financeiro` (senha de desbloqueio para não-admin).

## Testes

```bash
npm test
```

## Padrões

- Sem emojis na UI — ícones em SVG inline com `aria-hidden`.
- Todo `label` associado ao input; feedback em toda ação (botão desabilita ao
  enviar).
- Layout responsivo (mobile-first): header preto, menu lateral vira drawer.
