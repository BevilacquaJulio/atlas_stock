#!/usr/bin/env bash
set -euo pipefail

: "${RESULTS:?Resultados dos jobs obrigatórios ausentes}"
echo "Resultados: $RESULTS"
for result in $RESULTS; do
  case "$result" in
    success|skipped) ;;
    *) echo "::error::Pelo menos um job obrigatório terminou como '$result'."; exit 1 ;;
  esac
done
