#!/usr/bin/env bash
# setup-deploy-secrets.sh — cria a chave SSH exclusiva do CI deste projeto e cadastra os secrets.
#
# RODE VOCÊ MESMO, na sua máquina. Não peça a um agente de IA: a chave privada passa por este processo.
#
# Uso (na raiz do repositório, depois de rodar apply-repo-settings.sh):
#   bash <skill>/scripts/setup-deploy-secrets.sh <projeto> <host-ou-ip> [porta=22] [usuario=deploy]
#
# O que faz:
#   1. gera uma chave ed25519 nova numa pasta temporária (apagada no fim);
#   2. captura a chave pública da VPS e pede para você conferir o fingerprint;
#   3. cadastra VPS_SSH_KEY, VPS_KNOWN_HOSTS, VPS_HOST, VPS_USER (e VPS_PORT se != 22)
#      nos environments production e production-db;
#   4. imprime a linha para o authorized_keys da VPS, já restrita ao deploy.sh deste projeto.
#
# Requer: ssh-keygen, ssh-keyscan e gh autenticado com permissão de admin no repositório.

set -euo pipefail

project="${1:-}"
host="${2:-}"
port="${3:-22}"
user="${4:-deploy}"

if [[ -z "$project" || -z "$host" ]]; then
  sed -n '2,17p' "$0"
  exit 1
fi
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]{0,63}$ ]] || { echo "Projeto inválido: use minúsculas, números, - e _." >&2; exit 1; }
[[ "$port" =~ ^[0-9]+$ ]] || { echo "Porta inválida." >&2; exit 1; }

repo="${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
environments=(production production-db)

for env in "${environments[@]}"; do
  gh api "repos/$repo/environments/$env" --silent 2>/dev/null \
    || { echo "Environment '$env' não existe em $repo. Rode apply-repo-settings.sh antes." >&2; exit 1; }
done

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "==> Gerando chave exclusiva do CI para '$project'"
ssh-keygen -q -t ed25519 -N "" -C "gha-deploy-$project" -f "$tmp/key"

echo "==> Capturando a chave pública do servidor $host:$port"
ssh-keyscan -T 10 -p "$port" -t ed25519 "$host" > "$tmp/known_hosts" 2>/dev/null || true
[[ -s "$tmp/known_hosts" ]] || { echo "Não consegui ler a chave do servidor (host/porta corretos? SSH acessível?)." >&2; exit 1; }

echo
echo "Fingerprint recebido pela rede:"
ssh-keygen -lf "$tmp/known_hosts"
echo
echo "Na VPS, rode e compare:  ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub"
read -r -p "Os fingerprints são idênticos? [s/N] " answer
[[ "$answer" =~ ^[sS]$ ]] || { echo "Abortado. Nada foi cadastrado." >&2; exit 1; }

echo "==> Cadastrando secrets em $repo"
for env in "${environments[@]}"; do
  gh secret set VPS_SSH_KEY     --repo "$repo" --env "$env" < "$tmp/key"
  gh secret set VPS_KNOWN_HOSTS --repo "$repo" --env "$env" < "$tmp/known_hosts"
  gh secret set VPS_HOST        --repo "$repo" --env "$env" --body "$host"
  gh secret set VPS_USER        --repo "$repo" --env "$env" --body "$user"
  if [[ "$port" != "22" ]]; then
    gh secret set VPS_PORT      --repo "$repo" --env "$env" --body "$port"
  fi
  echo "    $env: ok"
done

echo
echo "==> Adicione esta linha em ~$user/.ssh/authorized_keys na VPS (uma linha só):"
echo
printf 'command="/home/%s/bin/deploy.sh %s",restrict %s\n' "$user" "$project" "$(cat "$tmp/key.pub")"
echo
echo "A chave privada existe agora só nos secrets do GitHub; a cópia local será apagada."
echo "Para trocar a chave no futuro: rode este script de novo e substitua a linha no authorized_keys."
