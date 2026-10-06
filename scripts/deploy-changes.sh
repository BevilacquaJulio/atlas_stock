#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?}" "${GITHUB_SHA:?}" "${GITHUB_OUTPUT:?}"
migrations_path="${MIGRATIONS_PATH:-backend/prisma/migrations/}"

# Só registros explícitos guardam o SHA realmente publicado, inclusive em rollbacks.
deployments="$(gh api --paginate "repos/$GITHUB_REPOSITORY/deployments?per_page=100" \
  --jq '.[] | select(.task == "atlas-stock" and (.environment == "production" or .environment == "production-db")) | "\(.id) \(.sha)"')"
base=""
while read -r id sha; do
  [[ -n "${id:-}" ]] || continue
  state="$(gh api "repos/$GITHUB_REPOSITORY/deployments/$id/statuses?per_page=1" --jq '.[0].state // ""')"
  if [[ "$state" == "success" ]]; then base="$sha"; break; fi
done <<< "$deployments"

if [[ -n "$base" ]] && git cat-file -e "${base}^{commit}" 2>/dev/null; then
  files="$(git diff --name-only "$base" "$GITHUB_SHA")"
else
  # O migrator aplica todo o histórico no primeiro deploy; o gate precisa cobrir esse mesmo histórico.
  echo "Sem deploy anterior confiável: tratando o repositório inteiro como alterado."
  base=""
  files="$(git ls-tree -r --name-only "$GITHUB_SHA")"
fi

not_deployable='^(CHANGELOG\.md|version\.txt|\.release-please-manifest\.json|LICENSE|docs/.*|\.github/ISSUE_TEMPLATE/.*|\.github/dependabot\.yml|.*\.md)$'
deployable=false; migrations=false; infra=false
if [[ -n "$files" ]] && grep -qvE "$not_deployable" <<< "$files"; then deployable=true; fi
while read -r file; do
  [[ "$file" != "$migrations_path"* ]] || migrations=true
  [[ "$file" != deploy/* ]] || infra=true
done <<< "$files"

printf 'deployable=%s\nmigrations=%s\ninfra=%s\nbase=%s\n' \
  "$deployable" "$migrations" "$infra" "$base" >> "$GITHUB_OUTPUT"
echo "deployable=$deployable migrations=$migrations infra=$infra base=${base:-nenhum}"
