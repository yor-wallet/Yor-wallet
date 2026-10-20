#!/usr/bin/env bash
# Local SQL tests: fresh PostgreSQL 16 cluster, Supabase stub, migration applied TWICE (idempotence), then every test file.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; MIG="$HERE/../migrations"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
DATA="${SULFA_PGDATA:-$(mktemp -d)}"; PORT="${SULFA_PGPORT:-54329}"
"$BIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"$BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA" -l "$DATA/log" start >/dev/null
trap '"$BIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null; rm -rf "$DATA"' EXIT
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$HERE/00_supabase_stub.sql"
for f in "$MIG"/*.sql; do "${PSQL[@]}" -f "$f"; "${PSQL[@]}" -f "$f"; done
echo "migration applied twice: OK"
pass=0; fail=0
for t in "$HERE"/[1-9]*.sql; do
  if out=$("${PSQL[@]}" -f "$t" 2>&1); then pass=$((pass+1)); echo "ok   $(basename "$t")"; echo "$out" | grep -oE 'PASS .*' | sed 's/^/     /' || true
  else fail=$((fail+1)); echo "FAIL $(basename "$t")"; echo "$out" | tail -15 | sed 's/^/     /'; fi
done
echo "SQL test files: $pass passed, $fail failed"; [ "$fail" -eq 0 ]
