#!/usr/bin/env bash
# pre-migrate.sh — backup do database do projeto antes de aplicar migrations.
# Chamado pelo deploy.sh com: <diretório do projeto> <sha>
#
# Instalação, na VPS:
#   install -m 750 pre-migrate.sh /home/deploy/apps/atlas_stock/hooks/pre-migrate.sh
#
# Credenciais em <projeto>/.env.backup (chmod 600), formato CHAVE=valor, sem aspas:
#   DB_NAME=g5
#   DB_USER=g5_user
#   DB_PASSWORD=...
#   MYSQL_CONTAINER=mysql_shared   (opcional, padrão mysql_shared)
#   KEEP=10                        (opcional, quantos backups manter)
#
# Este backup fica na própria VPS: serve para desfazer uma migration ruim, NÃO protege contra perder a VPS.
# Para isso, copie periodicamente a pasta backups/ para fora (outro servidor, storage de objetos).

set -Eeuo pipefail
umask 077

project_dir="${1:?uso: pre-migrate.sh <diretório do projeto> <sha>}"
sha="${2:?uso: pre-migrate.sh <diretório do projeto> <sha>}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "pre-migrate: SHA inválido" >&2; exit 1; }

env_file="$project_dir/.env.backup"
[[ -r "$env_file" ]] || { echo "pre-migrate: $env_file não encontrado" >&2; exit 1; }

DB_NAME="" DB_USER="" DB_PASSWORD="" MYSQL_CONTAINER="mysql_shared" KEEP="10"
# Lê CHAVE=valor sem executar o arquivo (nada de "source").
while IFS='=' read -r key value || [[ -n "$key" ]]; do
  value="${value%$'\r'}"
  case "$key" in
    DB_NAME|DB_USER|DB_PASSWORD|MYSQL_CONTAINER|KEEP) printf -v "$key" '%s' "$value" ;;
  esac
done < "$env_file"

[[ -n "$DB_NAME" && -n "$DB_USER" && -n "$DB_PASSWORD" ]] || { echo "pre-migrate: DB_NAME, DB_USER e DB_PASSWORD são obrigatórios" >&2; exit 1; }
[[ "$KEEP" =~ ^[0-9]+$ && "$KEEP" -ge 1 ]] || KEEP=10

backup_dir="$project_dir/backups"
install -d -m 700 "$backup_dir"
out="$backup_dir/$(date -u +%Y%m%dT%H%M%SZ)-${sha:0:12}.sql.gz"

# A senha vai por stdin como arquivo de opções do cliente: não aparece em "ps" nem em variável de ambiente.
escaped_password="${DB_PASSWORD//\\/\\\\}"
escaped_password="${escaped_password//\"/\\\"}"

trap 'rm -f "$out.partial"' ERR

printf '[client]\npassword="%s"\n' "$escaped_password" \
  | docker exec -i "$MYSQL_CONTAINER" mysqldump --defaults-extra-file=/dev/stdin \
      --user="$DB_USER" --single-transaction --routines --triggers --no-tablespaces \
      --set-gtid-purged=OFF "$DB_NAME" \
  | gzip -9 > "$out.partial"

# mysqldump só escreve "Dump completed" no fim quando termina sem erro.
gzip -t "$out.partial"
if ! gzip -dc "$out.partial" | tail -n 1 | grep -q 'Dump completed'; then
  echo "pre-migrate: dump incompleto" >&2
  rm -f "$out.partial"
  exit 1
fi
mv -f "$out.partial" "$out"
trap - ERR
echo "pre-migrate: backup salvo em $out"

# Retenção: mantém os $KEEP mais recentes.
find "$backup_dir" -maxdepth 1 -type f -name '*.sql.gz' -printf '%T@ %p\n' \
  | sort -rn | tail -n +"$((KEEP + 1))" | cut -d' ' -f2- \
  | xargs -r rm -f --
