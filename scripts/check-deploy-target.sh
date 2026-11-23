#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?}" "${GITHUB_SHA:?}"
head="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
if [[ "$head" != "$GITHUB_SHA" ]]; then
  echo "::error::Execução antiga: a main avançou para $head. Publique a execução desse commit."
  exit 1
fi
