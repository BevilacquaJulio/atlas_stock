#!/usr/bin/env bash
set -euo pipefail
: "${GITHUB_REPOSITORY:?}" "${EVENT:?}"
reviewers="$(gh api "repos/$GITHUB_REPOSITORY/environments/production-db" \
  --jq '[.protection_rules[]? | select(.type == "required_reviewers") | .reviewers[]?] | length' 2>/dev/null)" || reviewers=0
if [[ "$reviewers" =~ ^[1-9][0-9]*$ ]]; then
  echo 'Migration aprovada no environment production-db.'
elif [[ "$EVENT" == workflow_dispatch && "${APPROVED:-false}" == true ]]; then
  echo 'Migration aprovada explicitamente no disparo manual.'
else
  echo '::error::Migration bloqueada: configure o revisor em production-db ou aprove no disparo manual da main.'
  exit 1
fi
