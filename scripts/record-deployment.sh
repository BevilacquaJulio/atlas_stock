#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?}" "${SHA:?}" "${ENV_NAME:?}" "${APP_URL:?}" "${GITHUB_RUN_ID:?}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "SHA inválido para registro de deploy." >&2; exit 1; }
case "$ENV_NAME" in production|production-db) ;; *) exit 1 ;; esac

# O deployment automático do workflow Rollback aponta para o commit do workflow, não para inputs.sha.
body="$(node <<'JS'
console.log(JSON.stringify({
  ref: process.env.SHA,
  task: 'atlas-stock',
  environment: process.env.ENV_NAME,
  production_environment: true,
  auto_merge: false,
  required_contexts: [],
  description: 'Atlas Stock: versão publicada e verificada',
}));
JS
)"
id="$(gh api -X POST "repos/$GITHUB_REPOSITORY/deployments" --input - --jq .id <<< "$body")"
[[ "$id" =~ ^[0-9]+$ ]] || { echo "GitHub não retornou um deployment válido." >&2; exit 1; }
body="$(node <<'JS'
const env = process.env;
console.log(JSON.stringify({
  state: 'success',
  auto_inactive: false,
  environment_url: env.APP_URL,
  log_url: (env.GITHUB_SERVER_URL || 'https://github.com') + '/' + env.GITHUB_REPOSITORY + '/actions/runs/' + env.GITHUB_RUN_ID,
}));
JS
)"
gh api -X POST "repos/$GITHUB_REPOSITORY/deployments/$id/statuses" --silent --input - <<< "$body"
