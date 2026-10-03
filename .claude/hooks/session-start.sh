#!/bin/bash
# Prépare une session Claude Code sur le web : les dépendances du monorepo,
# pour que lint, typecheck, tests et tests de bout en bout tournent tout de
# suite. Sur une machine locale, rien : chacun gère son installation.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# pnpm à la version du dépôt (packageManager), par corepack s'il manque.
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || npm install -g pnpm@10.33.0 >/dev/null
fi

# Le navigateur des tests de bout en bout est déjà dans l'image
# (PLAYWRIGHT_BROWSERS_PATH) : ne pas le retélécharger à chaque installation.
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# `pnpm install` plutôt qu'une installation figée : l'état du conteneur est
# gardé après le hook, et une réinstallation sans changement prend une seconde.
pnpm install --prefer-offline

# Les variables utiles au reste de la session.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1' >> "$CLAUDE_ENV_FILE"
fi
