#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
temp_parent="$(cd -- "${TMPDIR:-/tmp}" && pwd -P)"
test_root="$(mktemp -d "$temp_parent/atlas-pipeline.XXXXXX")"
[[ "$test_root" == "$temp_parent"/atlas-pipeline.* ]] || exit 1
trap 'rm -rf -- "$test_root"' EXIT
export TEST_ROOT="$test_root"
mkdir -p "$test_root/bin" "$test_root/repo"
export PATH="$test_root/bin:$PATH"

# Toda chamada externa que pode mudar GitHub, chaves ou rede fica dentro destes doubles.
cat > "$test_root/bin/gh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$TEST_ROOT/gh.log"
if [[ "$1" == secret ]]; then
  if [[ "$3" == VPS_SSH_KEY || "$3" == VPS_KNOWN_HOSTS ]]; then cat > /dev/null; fi
  exit 0
fi
[[ "$1" != variable ]] || exit 0
endpoint=""; method=GET; input=""
shift
while (( $# )); do
  case "$1" in
    -X) method=$2; shift 2 ;;
    --input) input=$2; shift 2 ;;
    --jq|-f|-F) shift 2 ;;
    --silent|--paginate) shift ;;
    *) endpoint=$1; shift ;;
  esac
done
if [[ "$input" == - ]]; then cat > "$TEST_ROOT/body.$(basename "$endpoint")"; fi
case "$method:$endpoint" in
  GET:*/deployments\?*)
    [[ "${FAIL_API:-0}" != 1 ]] || exit 1
    cat "$TEST_ROOT/deployments"
    ;;
  GET:*/deployments/*/statuses\?*) cat "$TEST_ROOT/status.$(basename "$(dirname "$endpoint")")" ;;
  GET:*/commits/main)
    [[ "${FAIL_API:-0}" != 1 ]] || exit 1
    printf '%s\n' "$MAIN_SHA"
    ;;
  POST:*/deployments) echo 99 ;;
  GET:*/deployment-branch-policies\?*)
    if [[ "$endpoint" == */production/* ]]; then
      printf '1\tmain\tbranch\n2\t*\tbranch\n3\tmain\ttag\n'
    else
      printf '4\t*\ttag\n'
    fi
    ;;
  GET:*/rulesets) echo 42 ;;
  GET:apps/github-actions) echo 15368 ;;
  GET:user) echo 1 ;;
  GET:repos/test/atlas) echo public ;;
  GET:*/environments/production-db) echo "${REVIEWERS:-0}" ;;
  GET:*/environments/*) ;;
  PATCH:*|PUT:*|POST:*|DELETE:*) ;;
  *) echo "Chamada inesperada: $method:$endpoint" >&2; exit 1 ;;
esac
MOCK

cat > "$test_root/bin/ssh-keygen" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" != -lf ]] || { echo 'fingerprint fictício'; exit 0; }
while (( $# )); do
  if [[ "$1" == -f ]]; then
    printf 'chave privada fictícia\n' > "$2"
    printf 'ssh-ed25519 AAAA fixture\n' > "$2.pub"
    exit 0
  fi
  shift
done
exit 1
MOCK
cat > "$test_root/bin/ssh-keyscan" <<'MOCK'
#!/usr/bin/env bash
echo 'fixture.test ssh-ed25519 AAAA'
MOCK
cat > "$test_root/bin/curl" <<'MOCK'
#!/usr/bin/env bash
echo "$*" >> "$TEST_ROOT/curl.log"
printf '%s' "${HTTP_STATUS:-200}"
MOCK
cat > "$test_root/bin/sleep" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
chmod +x "$test_root/bin/"*

passed=0
pass() { passed=$((passed + 1)); printf 'OK %s: %s\n' "$passed" "$*"; }
fails() { if "$@" > "$test_root/failure.log" 2>&1; then echo "Esperava falha: $*" >&2; exit 1; fi; }
expect() { grep -qxF "$1" "$2"; }

fails env RESULTS='success failure success success' bash "$root/scripts/check-ci-results.sh"
pass 'falha em job obrigatório bloqueia ci-ok'
fails env RESULTS='success cancelled success success' bash "$root/scripts/check-ci-results.sh"
pass 'cancelamento de job obrigatório bloqueia ci-ok'
RESULTS='success success success success' bash "$root/scripts/check-ci-results.sh"
pass 'todos os jobs aprovados liberam ci-ok'

cd "$test_root/repo"
git init -q
git config user.email fixture@example.test
git config user.name Fixture
git config core.autocrlf false
mkdir -p backend/prisma/migrations/initial
printf 'CREATE TABLE fixture (id INT);\n' > backend/prisma/migrations/initial/migration.sql
echo 'const fixture = true;' > app.js
git add .
git commit -qm initial
initial="$(git rev-parse HEAD)"
echo 'const fixture = false;' > app.js
git commit -qam application
latest="$(git rev-parse HEAD)"
export GITHUB_REPOSITORY=test/atlas GITHUB_SHA="$latest" BEFORE="$initial"
export GITHUB_OUTPUT="$test_root/output"
: > "$test_root/deployments"

bash "$root/scripts/deploy-changes.sh"
expect 'migrations=true' "$GITHUB_OUTPUT"
expect 'base=' "$GITHUB_OUTPUT"
pass 'primeiro deploy exige gate para migration histórica mesmo quando BEFORE existe'

printf '12 %s\n11 %s\n' "$latest" "$initial" > "$test_root/deployments"
echo failure > "$test_root/status.12"
echo success > "$test_root/status.11"
: > "$GITHUB_OUTPUT"
bash "$root/scripts/deploy-changes.sh"
expect 'migrations=false' "$GITHUB_OUTPUT"
expect "base=$initial" "$GITHUB_OUTPUT"
pass 'deploy que falhou é ignorado; código sem migration usa o último sucesso'

mkdir -p backend/prisma/migrations/pending
echo 'ALTER TABLE fixture ADD name TEXT;' > backend/prisma/migrations/pending/migration.sql
git add .
git commit -qm pending-migration
echo update > app.js
git commit -qam after-migration
GITHUB_SHA="$(git rev-parse HEAD)"
: > "$GITHUB_OUTPUT"
bash "$root/scripts/deploy-changes.sh"
expect 'migrations=true' "$GITHUB_OUTPUT"
pass 'merge posterior não contorna gate de migration ainda não publicada'

: > "$GITHUB_OUTPUT"
fails env FAIL_API=1 bash "$root/scripts/deploy-changes.sh"
[[ ! -s "$GITHUB_OUTPUT" ]]
pass 'erro da API bloqueia o cálculo de migrations'

export MAIN_SHA="$latest"
fails bash "$root/scripts/check-deploy-target.sh"
pass 'execução antiga não pode publicar depois de uma nova'
export MAIN_SHA="$GITHUB_SHA"
bash "$root/scripts/check-deploy-target.sh"
pass 'execução da main atual pode publicar'
fails env FAIL_API=1 bash "$root/scripts/check-deploy-target.sh"
pass 'erro consultando main também bloqueia deploy'

fails env EVENT=push REVIEWERS=0 APPROVED=false bash "$root/scripts/migration-gate.sh"
pass 'migration sem aprovação bloqueia antes do SSH'
EVENT=push REVIEWERS=1 bash "$root/scripts/migration-gate.sh"
pass 'migration aprovada no environment pode seguir'
EVENT=workflow_dispatch REVIEWERS=0 APPROVED=true bash "$root/scripts/migration-gate.sh"
pass 'aprovação manual explícita permite migration sem revisor configurado'
fails env EVENT=push REVIEWERS=0 APPROVED=true bash "$root/scripts/migration-gate.sh"
pass 'input de aprovação não permite bypass em push automático'

export APP_URL=https://atlas.example.test GITHUB_RUN_ID=123
export SHA="$initial" ENV_NAME=production
bash "$root/scripts/record-deployment.sh"
node <<'JS'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const body = JSON.parse(fs.readFileSync(process.env.TEST_ROOT + '/body.deployments'));
assert.equal(body.ref, process.env.SHA);
assert.notEqual(body.ref, process.env.GITHUB_SHA);
assert.equal(body.production_environment, true);
assert.equal(body.auto_merge, false);
assert.deepEqual(body.required_contexts, []);
const status = JSON.parse(fs.readFileSync(process.env.TEST_ROOT + '/body.statuses'));
assert.equal(status.state, 'success');
assert.equal(status.auto_inactive, false);
JS
pass 'rollback registra a imagem escolhida e preserva o histórico de sucesso'

export RULESET_FILE="$root/.github/rulesets/main.json"
: > "$test_root/gh.log"
bash "$root/scripts/apply-repo-settings.sh" test/atlas > "$test_root/settings.log"
for id in 2 3; do grep -q "DELETE repos/test/atlas/environments/production/deployment-branch-policies/$id " "$test_root/gh.log"; done
grep -q 'DELETE repos/test/atlas/environments/production-db/deployment-branch-policies/4 ' "$test_root/gh.log"
if grep -q 'DELETE repos/test/atlas/environments/production/deployment-branch-policies/1 ' "$test_root/gh.log"; then exit 1; fi
grep -q 'POST repos/test/atlas/environments/production-db/deployment-branch-policies .*name=main.*type=branch' "$test_root/gh.log"
pass 'settings removem branches extras e tags, preservando somente branch main'

: > "$test_root/gh.log"
fails env APP_URL= bash "$root/scripts/apply-repo-settings.sh" test/atlas
[[ ! -s "$test_root/gh.log" ]]
pass 'APP_URL ausente bloqueia settings antes de qualquer alteração'

grep -q '/home/%s/bin/deploy-atlas-stock.sh %s' "$root/scripts/setup-deploy-secrets.sh"
pass 'configuração da chave aponta para o executor exclusivo do Atlas Stock'

: > "$test_root/curl.log"
bash "$root/scripts/public-health.sh"
[[ "$(wc -l < "$test_root/curl.log")" == 3 ]]
pass 'health público exige resposta 2xx'
fails env HTTP_STATUS=302 bash "$root/scripts/public-health.sh"
pass 'redirect não é aceito como health saudável'
fails env HTTP_STATUS=503 bash "$root/scripts/public-health.sh"
pass 'health indisponível falha após as tentativas'
: > "$test_root/curl.log"
fails env APP_URL= bash "$root/scripts/public-health.sh"
[[ ! -s "$test_root/curl.log" ]]
pass 'sem URL não há smoke check falso positivo'

printf '%s testes de integração passaram, com GitHub/SSH/HTTP simulados.\n' "$passed"
