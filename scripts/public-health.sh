#!/usr/bin/env bash
set -euo pipefail

if [[ "${OSTYPE:-}" == msys* ]]; then
  export MSYS2_ENV_CONV_EXCL="${MSYS2_ENV_CONV_EXCL:+$MSYS2_ENV_CONV_EXCL;}HEALTH_PATH"
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
urls="$(node "$script_dir/deploy-url.mjs" --all)"
while IFS= read -r url; do
  healthy=false
  for attempt in $(seq 1 10); do
    if status="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$url")" && [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
      echo "OK: $url (tentativa $attempt)"
      healthy=true
      break
    fi
    if (( attempt < 10 )); then sleep 6; fi
  done
  if [[ "$healthy" != true ]]; then
    echo "::error::Health check público falhou: $url. Confira Traefik/DNS/TLS e use Rollback se necessário."
    exit 1
  fi
done <<< "$urls"
