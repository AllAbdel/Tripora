#!/usr/bin/env bash
# Rejoue le schéma complet sur un Postgres et vérifie les politiques RLS.
# Ni compte Supabase, ni réseau, ni quota consommé.
#
#   ./supabase/tests/run.sh
#
# Deux façons de se connecter :
#   - PGHOST défini (intégration continue, conteneur) : connexion directe ;
#   - sinon : cluster local, via l'utilisateur système postgres.
set -euo pipefail

DB="${TRIPORA_TEST_DB:-tripora_test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ -n "${PGHOST:-}" ]]; then
  psql_run() { psql -v ON_ERROR_STOP=1 -U "${PGUSER:-postgres}" "$@"; }
else
  psql_run() {
    local args=()
    for arg in "$@"; do args+=("$(printf '%q' "$arg")"); done
    su "${TRIPORA_TEST_USER:-postgres}" -c "psql -v ON_ERROR_STOP=1 ${args[*]}"
  }
fi

echo "→ Base de test : $DB"
psql_run -q -d postgres -c "drop database if exists $DB"
psql_run -q -d postgres -c "create database $DB"

echo "→ Doublure de la plateforme Supabase"
psql_run -q -d "$DB" -c 'create extension if not exists pgcrypto'
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/shim_auth.sql"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/shim_storage.sql"

echo "→ Migrations"
for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$file")"
  psql_run -q -d "$DB" -f "$file"
done

echo "→ Tests RLS"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/rls_test.sql"

echo "→ Tests des sondages"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/sondages_test.sql"

echo "→ Tests de « Qui fait quoi »"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/taches_test.sql"

echo "→ Tests des moyens de paiement"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/paiement_test.sql"

echo "→ Tests des envies anonymes"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/envies_test.sql"

echo "→ Tests du coffre"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/coffre_test.sql"

echo "→ Tests des documents du coffre"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/documents_test.sql"

echo "→ Tests des trips ouverts"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/trips_ouverts_test.sql"

echo "→ Tests de protection des trips ouverts"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/trips_ouverts_proteger_test.sql"

echo "→ Tests de la récolte des lieux OpenStreetMap"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/lieux_osm_test.sql"

echo "→ Tests du compte invité devenu compte"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/compte_invite_test.sql"

# En dernier : la purge efface le voyage dont tous les tests précédents se
# servent.
echo "→ Tests de la purge des voyages supprimés"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/purge_test.sql"

# Tout à la fin : ce test supprime les comptes des tests précédents.
echo "→ Tests de la suppression de compte"
psql_run -q -d "$DB" -f "$ROOT/supabase/tests/compte_test.sql"
