#!/bin/sh
# Entrypoint Docker : synchronise le schéma Prisma avec la base avant de
# démarrer le serveur Next.js. Indispensable car le projet utilise `db push`
# (pas de migrations versionnées) — sans ça, les nouveaux modèles ajoutés en
# dev ne sont jamais créés en prod et provoquent des erreurs Prisma à
# l'exécution (ex: "table InsuranceSetting does not exist").
#
# Sécurité :
# - PAS de `--accept-data-loss` : si un changement destructif (drop colonne,
#   rename) est détecté, le push échoue et le déploiement aussi. Mieux vaut
#   un downtime contrôlé qu'une perte silencieuse de données prod.
# - DATABASE_URL et DIRECT_URL doivent être fournis par l'environnement
#   (Render envVars). DIRECT_URL bypasse le pgbouncer Supabase pour les
#   commandes DDL.

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL manquant — refus de démarrer."
  exit 1
fi

echo "→ Synchronisation du schéma Prisma avec la base…"
node node_modules/prisma/build/index.js db push --skip-generate --schema=prisma/schema.prisma

echo "→ Démarrage du serveur Next.js…"
exec "$@"
