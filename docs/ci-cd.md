# GitHub Actions e deploy do Atlas Stock

## Fluxo diário

Crie uma branch por implementação, faça commit e push e abra um PR para main.
A CI e o check de título rodam na abertura e em cada novo push. O merge usa squash
com título Conventional Commits, por exemplo feat(produtos): adiciona filtro.
A main exige ci-ok, pr-title, branch atualizada e conversas resolvidas.
Não há aprovação obrigatória de outro revisor neste projeto individual.

Após o merge, CD valida a main novamente, constrói as imagens no runner e
publica ghcr.io/bevilacquajulio/atlas_stock/{api,migrate,web}:<SHA completo>.
A VPS baixa as imagens; não executa git pull nem compila o projeto.
Mudanças só de documentação não publicam se não houver código pendente desde
um deploy anterior confiável. Run workflow republica mesmo sem mudanças.

## Mapa do sistema

| Item | Valor | Fonte |
|---|---|---|
| Repositório | BevilacquaJulio/atlas_stock, público | GitHub e decisão do responsável |
| Código adotado | atlas_stock_novo; histórico anterior preservado | Decisão do responsável |
| Aplicativos | NestJS 11/Prisma 7 e React 19/Vite | package.json de cada aplicação |
| Pacotes | npm, lockfile separado por aplicação | backend/ e frontend/ |
| Node | 24 na CI e nos Dockerfiles | .nvmrc e Dockerfiles |
| Banco | MySQL 8.4 compartilhado; testes isolados | Configuração existente e CI |
| Configuração do banco | MYSQL_*; TLS com CA em produção | prisma.config.ts e database-url.ts |
| Migrations | backend/prisma/migrations/ | Schema e migrations existentes |
| Frontend | https://atlastock.bevilabs.com.br | Destino confirmado |
| API | https://api.atlastock.bevilabs.com.br | Destino confirmado |
| Health | /api/health/ready, HTTP 503 sem banco | HealthController |
| VPS | /home/juliobevi/htdocs/bevilabs/bl_atlas_stock | Destino confirmado |
| SSH | deploy, chave exclusiva e executor exclusivo | Contrato do pipeline |

O frontend usa /api. Traefik encaminha esse prefixo no domínio principal e
preserva o subdomínio da API. Nginx serve a SPA como usuário sem root na 8080.
O login demo fica desativado por padrão e não recebe credenciais no build.

## Validações e migrations

A CI roda lint sem --fix, typecheck, testes e build de ambas as aplicações.
A API aplica as cinco migrations num MySQL descartável atlas_stock_ci e compara
o resultado com o schema. O e2e recusa banco diferente e verifica API compilada,
login, proteção de rotas e persistência de categoria. Também são construídas as
três imagens e verificados YAML, pinning, Bash e proteções do deploy.
A auditoria npm bloqueia vulnerabilidades críticas de produção; os demais alertas
continuam visíveis. Não se usa continue-on-error para esconder falhas.

Migrations não são editadas depois de publicadas. Mudanças de schema exigem uma
migration no mesmo PR. Alterações destrutivas exigem expand/contract, pois a
migration roda enquanto o código anterior ainda atende. Rollback não desfaz DDL.

O CD compara com o último deploy bem-sucedido da task atlas-stock, incluindo
rollbacks. Sem histórico confiável, todas as migrations entram no gate do primeiro
deploy. production-db exige aprovação; sem revisor configurado, o deploy fica
bloqueado até Run workflow na main com approve_migrations explicitamente marcado.
O backup é obrigatório nesse caminho. Erro consultando o histórico impede o CD.

CD e rollback compartilham a fila e o executor usa flock. Uma execução automática
antiga não publica se a main avançou. Após pull e migration, o Compose aguarda
saúde por 180 segundos. Falha tenta restaurar a imagem anterior; no primeiro
deploy não existe versão anterior. Falha no pull, backup ou migration aborta.
A limpeza se restringe às imagens do Atlas Stock, sem prune global.

O CD verifica frontend, prontidão no domínio principal e prontidão no subdomínio
API antes de registrar sucesso. Falha de DNS/TLS não causa rollback automático:
a versão pode estar saudável internamente; o workflow falha para investigação.

## Configurar o GitHub

No Git Bash, com GitHub CLI autenticado, após revisar os arquivos:

```bash
APP_URL=https://atlastock.bevilabs.com.br HEALTH_PATH=/api/health/ready \
  bash scripts/apply-repo-settings.sh BevilacquaJulio/atlas_stock
```

O script configura squash, ruleset, Dependabot, permissões e environments
production e production-db, restritos à branch main. APP_URL é obrigatória.
Secrets SSH existem nos dois environments, nunca em nível de repo:
VPS_SSH_KEY, VPS_KNOWN_HOSTS, VPS_HOST, VPS_USER e VPS_PORT.

Execute você mesmo, substituindo o argumento pelo host que já utiliza:

```bash
bash scripts/setup-deploy-secrets.sh bl_atlas_stock <host-da-vps> 22 deploy
```

Compare o fingerprint com ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
executado na VPS. O script gera a chave, cadastra os secrets e imprime:

```text
command="/home/deploy/bin/deploy-atlas-stock.sh bl_atlas_stock",restrict ssh-ed25519 ...
```

Acrescente essa linha em /home/deploy/.ssh/authorized_keys. Preserve as linhas
e o executor do toolbox. A chave do CI aceita apenas deploy/status deste projeto.

Pacotes GHCR precisam estar acessíveis ao usuário deploy. Pacotes públicos podem
ser baixados sem login; pacotes privados exigem docker login ghcr.io na VPS com
credencial de leitura. A criação de pacotes não garante visibilidade pública.

## Preparar a VPS antes do merge

MySQL e Traefik já existem e os containers da aplicação foram removidos. Não
recrie ou apague a infraestrutura nem os volumes do banco. Confirme as redes
mysql_shared e traefik, o banco existente e o DNS dos dois domínios.

Copie manualmente os arquivos deste PR, usando seu acesso administrativo:

| Repositório | Destino |
|---|---|
| deploy/deploy.sh | /home/deploy/bin/deploy-atlas-stock.sh, root:root, modo 755 |
| deploy/compose.prod.yml | pasta do projeto/compose.yml |
| deploy/hooks/pre-migrate.sh | pasta do projeto/hooks/pre-migrate.sh, executável |
| deploy/.env.example | referência para pasta do projeto/.env |
| backend/.env.example | referência para pasta do projeto/.env.production |
| deploy/.env.migrate.example | referência para pasta do projeto/.env.migrate |
| deploy/.env.backup.example | referência para pasta do projeto/.env.backup |

A pasta do projeto é /home/juliobevi/htdocs/bevilabs/bl_atlas_stock.
O usuário deploy precisa atravessar os diretórios pais e ler esses arquivos.
Crie também secrets/ e backups/. Configure o dono deploy e modo 600 nos ambientes.
Preserve valores existentes; exemplos não são segredos válidos. Nunca envie
arquivos de ambiente reais ao GitHub.

.env.production contém MYSQL_*, JWT_* e CORS_ORIGIN=https://atlastock.bevilabs.com.br.
.env.migrate contém somente MYSQL_*, preferencialmente com usuário próprio para DDL.
.env.backup contém DB_NAME, DB_USER e DB_PASSWORD do database realmente existente.
A CA do mysql_shared fica em secrets/mysql-ca.pem, montada em API e migrator.
O usuário de backup precisa das permissões de mysqldump para rotinas e triggers.
O backup fica na própria VPS; mantenha cópia externa para recuperar perda do servidor.

A chave CI não envia Compose, scripts ou ambientes. Alterações futuras nesses
arquivos são sincronizadas manualmente antes do merge, com compatibilidade com
a versão em execução. Este pipeline não modifica o toolbox.

## Primeiro deploy e operação

1. Preparar VPS, environments, secrets, GHCR e DNS antes de mergear.
2. Conferir CI e pr-title verdes no PR.
3. Fazer squash merge manualmente.
4. Aprovar o primeiro deploy em production-db. O migrator aplica apenas pendências.
5. Conferir frontend e API; conferir .deploy-history e Deployments/task atlas-stock.

O pipeline não executa seed ou populate automaticamente. Se ainda não existir
administrador, configure SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD e
SEED_FINANCEIRO_SENHA na VPS (senhas distintas com pelo menos 12 caracteres) e
execute separadamente, usando a imagem runtime da versão publicada:

```bash
docker compose run --rm -T --no-deps api node dist/prisma/seed.js
```

Esse seed também atualiza a senha financeira; não execute em todo deploy.

Para consultar a versão pelo executor: deploy-atlas-stock.sh bl_atlas_stock status.
Para rollback: Actions → Rollback, branch main, informe SHA de uma versão já
publicada. Migrations posteriores exigem confirm_schema_compat. A imagem escolhida
é registrada como base dos próximos deploys, não o commit que executou o workflow.
Sem uma versão anterior publicada, não há rollback disponível.

Uma migration MySQL que falha pode deixar DDL parcial. Não tente reset em produção:
inspecione o estado e recupere manualmente antes de liberar outro deploy.
O up recria containers e pode gerar alguns segundos de indisponibilidade.

Correções funcionais de estoque, financeiro e sessões permanecem para outros PRs.
