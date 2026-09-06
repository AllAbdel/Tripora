#!/usr/bin/env bash
# Rejoue le schéma complet sur un Postgres local et vérifie les politiques RLS.
# Ne nécessite ni compte Supabase, ni réseau, ni quota.
#
#   ./supabase/tests/run.sh
#
set -euo pipefail

DB="${TRIPORA_TEST_DB:-tripora_test}"
PSQL_USER="${TRIPORA_TEST_USER:-postgres}"
run_psql() { su "$PSQL_USER" -c "psql -v ON_ERROR_STOP=1 $*"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "→ Base de test : $DB"
run_psql "-q -c 'drop database if exists $DB'"
run_psql "-q -c 'create database $DB'"

echo "→ Doublure de la plateforme Supabase"
run_psql "-q -d $DB -c 'create extension if not exists pgcrypto'"
run_psql "-q -d $DB -f $ROOT/supabase/tests/shim_auth.sql"

echo "→ Migrations"
for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$file")"
  run_psql "-q -d $DB -f $file"
done

echo "→ Droits de table (équivalents Supabase)"
run_psql "-q -d $DB -f $ROOT/supabase/tests/grants.sql"

echo "→ Tests RLS"
run_psql "-q -d $DB -f $ROOT/supabase/tests/rls_test.sql"
