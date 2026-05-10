# AFRYNTIX — Guide de déploiement

**Pipeline :**  
`Code local → GitHub → Docker Hub → Render`  
`Base de données → Supabase (PostgreSQL)`

---

## Prérequis — Comptes à créer

| Service | URL | Gratuit |
|---|---|---|
| GitHub | https://github.com | ✅ |
| Docker Hub | https://hub.docker.com | ✅ |
| Supabase | https://supabase.com | ✅ (500 MB) |
| Render | https://render.com | ✅ (cold start) |

---

## ÉTAPE 1 — Base de données Supabase

### 1.1 Créer le projet Supabase

1. Connecte-toi sur [supabase.com](https://supabase.com)
2. **New Project** → choisir une organisation → donner un nom (ex: `afryntix`)
3. Choisir une région proche de tes utilisateurs (ex: **West EU – Ireland**)
4. Définir un mot de passe fort pour la base → **Create Project**
5. Attendre ~2 min que le projet soit prêt

### 1.2 Récupérer les chaînes de connexion

Dans le dashboard Supabase :  
**Settings → Database → Connection string**

Copier les deux URLs :

```
# Onglet "Transaction" (port 6543) → DATABASE_URL
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# Onglet "Session" (port 5432) → DIRECT_URL  
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

### 1.3 Initialiser le schéma

Dans ton terminal local, avec les vraies URLs dans `.env.local` :

```bash
# Mettre à jour .env.local avec les vraies URLs Supabase
# DATABASE_URL = connection poolée (port 6543)
# DIRECT_URL   = connexion directe (port 5432)

# Pousser le schéma Prisma vers Supabase
npm run db:push

# Créer l'admin par défaut
npm run db:seed
```

> ⚠️ `db:push` utilise `DIRECT_URL` pour se connecter directement (sans PgBouncer).  
> Le schéma complet (tables, enums, indexes) sera créé automatiquement.

### 1.4 Récupérer les clés API Supabase (optionnel - pour usage futur)

**Settings → API** :
- `SUPABASE_URL` = Project URL
- `SUPABASE_ANON_KEY` = `anon` `public` key
- `SUPABASE_SERVICE_KEY` = `service_role` key (⚠️ ne jamais exposer côté client)

> Ces clés ne sont pas utilisées actuellement (Prisma accède directement à PostgreSQL).  
> Elles seront utiles si tu ajoutes Storage, Realtime, ou Auth Supabase.

---

## ÉTAPE 2 — Docker Hub

### 2.1 Créer le compte et le repository

1. Créer un compte sur [hub.docker.com](https://hub.docker.com)
2. **Create Repository** → nom : `afryntix` → visibilité : **Public**
3. Note ton `DOCKERHUB_USERNAME`

### 2.2 Créer un Access Token Docker Hub

1. **Account Settings → Security → New Access Token**
2. Nom : `github-actions-afryntix`
3. Permissions : **Read & Write**
4. Copier le token (visible une seule fois)

### 2.3 Tester le build Docker en local (optionnel)

```bash
# Dans le répertoire AFRYNTIX
docker build -t afryntix .

# Vérifier que le container démarre
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e AUTH_SECRET="..." \
  -e AUTH_URL="http://localhost:3001" \
  afryntix

# Tester le health check
curl http://localhost:3000/api/health
# → {"status":"ok","timestamp":"..."}
```

---

## ÉTAPE 3 — GitHub

### 3.1 Créer le repository GitHub

```bash
# Dans le répertoire AFRYNTIX
git init
git add .
git commit -m "feat: initial commit"

# Sur GitHub : New repository → afryntix → Public ou Private
git remote add origin https://github.com/TON_USERNAME/afryntix.git
git branch -M main
git push -u origin main
```

### 3.2 Ajouter les secrets GitHub Actions

**Repository → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valeur |
|---|---|
| `DOCKERHUB_USERNAME` | Ton username Docker Hub |
| `DOCKERHUB_TOKEN` | Le token créé à l'étape 2.2 |
| `RENDER_DEPLOY_HOOK_URL` | URL du deploy hook Render (étape 4.4) |

### 3.3 Vérifier le workflow

Après le premier push sur `main`, aller dans **Actions** sur GitHub.  
Le workflow `Docker Build & Push → Render Deploy` doit se lancer automatiquement.

---

## ÉTAPE 4 — Render

### 4.1 Créer le service

1. Connecte-toi sur [render.com](https://render.com)
2. **New → Web Service**
3. Choisir **Deploy an existing image from a registry**
4. **Image URL** : `docker.io/TON_DOCKERHUB_USERNAME/afryntix:latest`
5. **Name** : `afryntix`
6. **Region** : Frankfurt (ou la plus proche de tes clients)
7. **Plan** : Free

### 4.2 Modifier render.yaml avant de pousser

Dans `render.yaml`, remplace `YOUR_DOCKERHUB_USERNAME` par ton vrai username :

```yaml
image:
  url: docker.io/TON_VRAI_USERNAME/afryntix:latest
```

### 4.3 Ajouter les variables d'environnement dans Render

**Environment → Add Environment Variable** pour chaque variable marquée `sync: false` dans `render.yaml` :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | Connection poolée Supabase (port 6543) |
| `DIRECT_URL` | Connexion directe Supabase (port 5432) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://afryntix.onrender.com` |
| `TWILIO_ACCOUNT_SID` | Depuis Twilio Console |
| `TWILIO_AUTH_TOKEN` | Depuis Twilio Console |
| `DEFAULT_ADMIN_EMAIL` | Email admin |
| `DEFAULT_ADMIN_PASSWORD` | Mot de passe admin fort |
| `DEFAULT_ADMIN_NAME` | Nom admin |
| `DEFAULT_ADMIN_PHONE` | Téléphone admin |

### 4.4 Récupérer le Deploy Hook URL

**Settings → Deploy Hook → Copy URL**

Coller cette URL dans le secret GitHub `RENDER_DEPLOY_HOOK_URL`.  
À partir de là, chaque push sur `main` → Docker Hub → Render redéploie automatiquement.

### 4.5 URL définitive

Après le premier déploiement réussi, Render donne l'URL :  
`https://afryntix.onrender.com`

Mettre à jour ces variables dans Render :
- `AUTH_URL` → `https://afryntix.onrender.com`
- `NEXT_PUBLIC_APP_URL` → `https://afryntix.onrender.com`

---

## ÉTAPE 5 — Premier déploiement complet

Ordre des opérations :

```
1. Supabase créé + schéma initialisé (db:push + seed)
2. Docker Hub : repo créé + token généré
3. GitHub : secrets ajoutés (DOCKERHUB_USERNAME, DOCKERHUB_TOKEN)
4. Render : service créé + variables d'environnement saisies
5. GitHub : secrets ajoutés (RENDER_DEPLOY_HOOK_URL)
6. git push origin main  →  workflow déclenché automatiquement
7. Vérifier sur Render : Logs → "✓ Listening on port 3000"
8. Tester : https://afryntix.onrender.com/api/health
```

---

## Mise à jour du code (workflow quotidien)

```bash
# Modifier le code
git add .
git commit -m "feat: ..."
git push origin main

# GitHub Actions → build Docker → push Docker Hub → Render redéploie
# Délai total : ~3-5 min
```

---

## ⚠️ Avertissements importants

### Cold start — Plan Render gratuit
Le service gratuit Render **s'endort après 15 min d'inactivité**.  
La première requête après une période d'inactivité prend **30-60 secondes**.  
→ Pour éviter : passer au plan "Starter" ($7/mois) ou utiliser un cron externe (UptimeRobot, Better Uptime) pour pinger `/api/health` toutes les 10 min.

### Migrations de base de données
Pour modifier le schéma en production :

```bash
# Option A : db:push (simple, pas d'historique)
npm run db:push

# Option B : migration nommée (recommandé pour la prod)
npm run db:migrate
# Prisma crée un fichier dans prisma/migrations/
# Committer ce fichier et déployer → Prisma l'appliquera automatiquement
```

### Secrets — règles absolues
- Ne jamais committer `.env.local`
- Ne jamais écrire de valeur sensible en dur dans `render.yaml`
- Régénérer `AUTH_SECRET` si compromis : toutes les sessions actives seront invalidées

### Images Docker Hub publiques
Si ton repository Docker Hub est **public**, l'image est accessible par tous.  
Elle ne contient pas de secrets (les secrets sont injectés à l'exécution par Render).  
→ ✅ Sécurisé

---

## Troubleshooting

| Problème | Cause probable | Solution |
|---|---|---|
| Build Docker échoue sur `prisma generate` | `openssl` manquant | Déjà inclus dans le Dockerfile |
| `AUTH_SECRET` error au démarrage | Variable manquante dans Render | Ajouter `AUTH_SECRET` dans Render env |
| DB connection refused | Mauvaise URL Supabase | Vérifier `DATABASE_URL` (port 6543 pour runtime) |
| 404 sur `/api/health` | Service pas encore déployé | Attendre la fin du déploiement Render |
| Cold start lent | Plan gratuit Render | Normal — voir section "Cold start" ci-dessus |
