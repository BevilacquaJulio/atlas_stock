#!/usr/bin/env bash
# apply-repo-settings.sh — aplica no GitHub as configurações que não vivem em arquivo:
#   merge (só squash, título do PR como commit), branches apagadas após merge,
#   permissões padrão do Actions, segurança (alertas, secret scanning),
#   environments production / production-db, ruleset da main e variáveis APP_URL/HEALTH_PATH.
#
# Uso (na raiz do repositório, com o gh autenticado como dono/admin do repo):
#   APP_URL=https://venari.bevilabs.com.br bash <skill>/scripts/apply-repo-settings.sh [owner/repo]
# Opcionais: HEALTH_PATH=/api/health   RULESET_FILE=.github/rulesets/main.json   WITH_RELEASE=1 (cria o environment release)
#
# Idempotente: pode rodar de novo sem duplicar nada.
# Altera configurações do repositório — um agente só deve rodar com autorização explícita do usuário.

set -euo pipefail

repo="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
ruleset_file="${RULESET_FILE:-.github/rulesets/main.json}"
health_path="${HEALTH_PATH:-/api/health}"

step() { printf '\n==> %s\n' "$*"; }
warn() { printf 'AVISO: %s\n' "$*" >&2; }

[[ -f "$ruleset_file" ]] || { echo "Ruleset não encontrado em $ruleset_file" >&2; exit 1; }

visibility="$(gh api "repos/$repo" --jq .visibility)"
echo "Repositório: $repo ($visibility)"
if [[ "$visibility" != "public" ]]; then
  warn "repositório não é público. No plano Free, rulesets e environments não funcionam em repo privado;"
  warn "no Pro/Team, environments funcionam mas aprovação obrigatória (production-db) só existe no Enterprise."
fi

plan_hint() {
  echo "Repositório $visibility: no plano Free, repo privado não tem environments nem rulesets." >&2
  echo "Sem environment, os secrets de deploy ficariam legíveis por qualquer branch — por isso o script para aqui." >&2
  echo "Opções: tornar o repositório público, usar um plano pago, ou manter só a CI (sem cd.yml) por enquanto." >&2
}

step "Merge: só squash, título do PR vira o commit, branch apagada após merge"
gh api -X PATCH "repos/$repo" --silent \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=BLANK \
  -F delete_branch_on_merge=true \
  -F allow_update_branch=true \
  -F allow_auto_merge=true

step "Actions: GITHUB_TOKEN somente leitura por padrão; Actions não aprova PR"
gh api -X PUT "repos/$repo/actions/permissions/workflow" --silent \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false

step "Segurança: alertas e correções automáticas do Dependabot, secret scanning com push protection"
gh api -X PUT "repos/$repo/vulnerability-alerts" --silent || warn "não foi possível ativar os alertas do Dependabot"
gh api -X PUT "repos/$repo/automated-security-fixes" --silent || warn "não foi possível ativar as correções automáticas"
if [[ "$visibility" == "public" ]]; then
  gh api -X PATCH "repos/$repo" --silent --input - <<'JSON' || warn "não foi possível ativar o secret scanning"
{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}
JSON
fi

ensure_main_policy() {
  local env=$1
  if ! gh api "repos/$repo/environments/$env/deployment-branch-policies" --jq '.branch_policies[].name' | grep -qx main; then
    gh api -X POST "repos/$repo/environments/$env/deployment-branch-policies" --silent -f name=main -f type=branch
  fi
}

step "Environment production (automático, só a main publica)"
gh api -X PUT "repos/$repo/environments/production" --silent --input - <<'JSON' || { plan_hint; exit 1; }
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
ensure_main_policy production

step "Environment production-db (aprovação manual, usado quando há migration nova)"
user_id="$(gh api user --jq .id)"
if ! gh api -X PUT "repos/$repo/environments/production-db" --silent --input - <<JSON
{"reviewers":[{"type":"User","id":$user_id}],"prevent_self_review":false,"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
then
  warn "aprovação obrigatória indisponível neste plano/visibilidade; criando production-db sem revisor."
  warn "O CD vai BLOQUEAR deploys com migration nova: para publicá-los, rode Actions → CD → Run workflow marcando approve_migrations."
  gh api -X PUT "repos/$repo/environments/production-db" --silent --input - <<'JSON'
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
fi
ensure_main_policy production-db

if [[ "${WITH_RELEASE:-0}" == "1" ]]; then
  step "Environment release (secret do release-please, só a main)"
  gh api -X PUT "repos/$repo/environments/release" --silent --input - <<'JSON'
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
  ensure_main_policy release
  echo "Cadastre o token: gh secret set RELEASE_PLEASE_TOKEN --repo $repo --env release"
fi

step "Ruleset da main ($ruleset_file)"
actions_app_id="$(gh api /apps/github-actions --jq .id 2>/dev/null || true)"
if [[ -n "$actions_app_id" && "$actions_app_id" != "15368" ]]; then
  warn "o ID do app GitHub Actions é $actions_app_id, mas o ruleset usa 15368 — ajuste integration_id em $ruleset_file"
fi
ruleset_name="$(sed -n 's/^ *"name": *"\([^"]*\)".*/\1/p' "$ruleset_file" | head -n 1)"
[[ -n "$ruleset_name" ]] || { echo "Não encontrei o campo \"name\" em $ruleset_file" >&2; exit 1; }
ruleset_id="$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name == \"$ruleset_name\") | .id")"
if [[ -n "$ruleset_id" ]]; then
  gh api -X PUT "repos/$repo/rulesets/$ruleset_id" --silent --input "$ruleset_file" || { plan_hint; exit 1; }
  echo "Ruleset \"$ruleset_name\" atualizado (id $ruleset_id)."
else
  gh api -X POST "repos/$repo/rulesets" --silent --input "$ruleset_file" || { plan_hint; exit 1; }
  echo "Ruleset \"$ruleset_name\" criado."
fi

step "Variáveis do repositório"
if [[ -n "${APP_URL:-}" ]]; then
  gh variable set APP_URL --repo "$repo" --body "$APP_URL"
  gh variable set HEALTH_PATH --repo "$repo" --body "$health_path"
else
  warn "APP_URL não informada — defina depois: gh variable set APP_URL --repo $repo --body https://..."
fi

step "Pronto"
cat <<EOF
Próximos passos (você, não o agente):
  1. Rode scripts/setup-deploy-secrets.sh para criar a chave do CI e cadastrar os secrets nos dois environments.
  2. Prepare a VPS conforme references/vps-setup.md (deploy.sh, authorized_keys, compose, .env.production, hook de backup).
  3. Abra um PR de teste e confira se os checks ci-ok e pr-title aparecem e bloqueiam o merge até ficarem verdes.
EOF
