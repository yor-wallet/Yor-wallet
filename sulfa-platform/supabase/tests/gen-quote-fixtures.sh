#!/usr/bin/env bash
# Asks the REAL SQL function public.sulfa_quote for a grid of settings / amounts / terms and writes the answers as JSON.
# The browser preview (web/src/lib/quote.ts) is tested against this file: tests/unit/quote.test.ts
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; MIG="$HERE/../migrations"; OUT="${1:?usage: gen-quote-fixtures.sh OUT.json}"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
DATA="$(mktemp -d)"; PORT="${SULFA_PGPORT:-54331}"
"$BIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"$BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA" -l "$DATA/log" start >/dev/null
trap '"$BIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null; rm -rf "$DATA"' EXIT
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -A -t)
"${PSQL[@]}" -f "$HERE/00_supabase_stub.sql" >/dev/null
for f in "$MIG"/*.sql; do "${PSQL[@]}" -f "$f" >/dev/null; done
"${PSQL[@]}" > "$OUT" <<'SQL'
create temp table fx (s jsonb, amount numeric, term int, q jsonb);
do $$
declare s jsonb; a numeric; n int;
begin
  for s in select * from jsonb_array_elements('[
    {"fee_fixed":0,"fee_percent":0,"monthly_rate_percent":0},
    {"fee_fixed":0,"fee_percent":2,"monthly_rate_percent":1},
    {"fee_fixed":5,"fee_percent":1.5,"monthly_rate_percent":0.75},
    {"fee_fixed":2.5,"fee_percent":0.3333,"monthly_rate_percent":1.2345},
    {"fee_fixed":0.001,"fee_percent":3.0005,"monthly_rate_percent":2.9999}]'::jsonb) loop
    perform set_config('sulfa.rpc', 'on', true);
    update public.sulfa_settings set fee_fixed = (s->>'fee_fixed')::numeric, fee_percent = (s->>'fee_percent')::numeric,
      monthly_rate_percent = (s->>'monthly_rate_percent')::numeric where id;
    foreach a in array array[500, 777.777, 1000, 1234.5, 2000, 3333.333, 5000.005, 9999.999, 10000] loop
      for n in 3..9 loop
        insert into fx values (s, a, n, public.sulfa_quote(a, n));
      end loop;
    end loop;
  end loop;
end $$;
select jsonb_pretty(jsonb_agg(jsonb_build_object('settings', s, 'amount', amount, 'term', term, 'quote', q))) from fx;
SQL
echo "wrote $(grep -c '"quote"' "$OUT") cases to $OUT"
