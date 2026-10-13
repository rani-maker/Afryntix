# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is AFRYNTIX

A full-stack logistics platform for shipping between China and West Africa. Features include shipment management, real-time tracking, role-based portals (admin/staff/client), and WhatsApp notifications.

## Commands

```bash
# Development
npm run dev          # Start dev server on port 3000
npm run build        # prisma generate + next build
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
npm run db:push      # Push schema changes to DB (no migration history)
npm run db:migrate   # Create and apply a named migration
npm run db:seed      # Seed initial data (admin user, defaults)
npm run db:studio    # Open Prisma Studio GUI
```

There are no automated tests configured.

## Environment Setup

Copy `.env.example` to `.env.local`. Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `AUTH_URL` — set to `http://localhost:3000` for dev
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` — WhatsApp notifications
- `DEFAULT_ADMIN_*` — used by the seed script to create the initial admin account

## Architecture

**Stack:** Next.js 15 (App Router) + React 19 RC, TypeScript strict mode, PostgreSQL + Prisma ORM, NextAuth.js v5 beta, Tailwind CSS + shadcn/ui, React Hook Form + Zod.

### Route Layout (`src/app/`)

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page |
| `/tracking`, `/services`, `/addresses` | Public | Public-facing pages |
| `/login`, `/register`, `/staff-invite` | Public | Auth flows |
| `/dashboard` | CLIENT role | Client portal |
| `/staff` | STAFF or ADMIN | Staff management portal |
| `/admin` | ADMIN only | Full system administration |

Route protection is enforced in `src/middleware.ts` — it guards all non-public routes and redirects based on role.

### Server Actions (`src/server/actions/`)

All mutations go through Next.js Server Actions (files tagged `"use server"`). This is the primary backend layer — there are no separate API routes for business logic, only `/api/auth` for NextAuth callbacks.

Key action files: `shipments`, `payments`, `auth`, and supporting modules for reservations, staff, and admin operations.

### Auth (`src/auth.ts`)

NextAuth v5 with a Credentials provider (email + bcrypt password). The session JWT carries `id`, `role`, and `name`. Three roles: `ADMIN`, `STAFF`, `CLIENT`. Use the `auth()` helper from `src/auth.ts` in Server Components and actions; use the `useSession()` hook in Client Components.

### Data Layer (`src/lib/prisma.ts`)

Prisma client singleton. Schema is in `prisma/schema.prisma`. Run `db:push` for quick dev iterations; use `db:migrate` when creating a migration record.

### UI Components

`src/components/ui/` — shadcn/ui primitives (Button, Card, Input, Dialog, etc.). These are copied-in source files, not an imported package — edit them directly when needed.

`src/components/dashboard/` — Sidebar and Topbar shared across the dashboard, staff, and admin portals.

### Pricing & Business Logic

`src/lib/pricing.ts` — calculates shipping costs based on transport mode (air express/normal, sea LCL/FCL, vehicle, BTP equipment, storage), cargo category, and weight/dimensions.

`src/lib/whatsapp.ts` — Twilio WhatsApp integration for shipment status notifications.

## Language Note

UI strings and most code comments are in French.

---

## 🚧 Plan d'amélioration en cours (suivi multi-session)

Audit logistique réalisé le 2026-05-13. Liste ordonnée des chantiers issus de l'analyse senior, à traiter dans l'ordre. Mettre à jour cette section après chaque tâche terminée pour permettre la reprise après compaction / nouvelle session.

### Légende
- ✅ Terminé
- 🔄 En cours
- ⏳ À faire

### P1 — Critique (priorité absolue)

1. ✅ **Gestion documentaire** — Modèle `Document` polymorphe (Shipment OU Envoi) + enum `DocumentType` (B/L, AWB, MAWB, packing list, facture commerciale, CO, déclaration douanière, certificat d'assurance, POD, manifeste, photo). Lib `src/lib/storage.ts` (upload base64, validation MIME, max 15 Mo). Actions `src/server/actions/documents.ts` (upload/delete, role STAFF+ADMIN). Composant client `src/components/documents/documents-section.tsx`. Intégré dans page détail Shipment et Envoi (staff/admin).
2. ✅ **Poids déclaré vs poids vérifié** — Champs `declaredWeightKg`, `verifiedWeightKg`, `weightVerifiedAt`, `weightVerifiedById` ajoutés au modèle `Shipment`. `weightKg` reste le poids effectif utilisé pour la facturation (= verifié s'il existe, sinon déclaré). À la création, `declaredWeightKg` = valeur saisie. Action `recordVerifiedWeight` recalcule unitPrice / total / acompte / solde, met à jour facture liée si présente, statue le paiement (UNPAID/DEPOSIT_PAID/FULLY_PAID), et logue l'écart dans l'historique. Formulaire `VerifyWeightForm` sur page détail Shipment (staff/admin) avec affichage de l'écart en temps réel et nouveau total après pesée.
3. ✅ **Facturation entreposage automatisée** — Modèle `StorageSetting` (singleton, `freeDays` + `dailyRateXOF`). Sur `Shipment` : `availableSinceAt`, `storageDaysCharged`, `storageFeeAmount`, `storageChargedAt`. `availableSinceAt` est posé automatiquement par `updateShipmentStatus` au passage en AVAILABLE_FOR_DELIVERY. Lib `src/lib/storage-fees.ts` (`computeStorageFee`). Actions : `getActiveStorageSetting`, `updateStorageSetting` (ADMIN), `chargeStorageFees` (STAFF+ADMIN) qui ajoute le montant au total du colis, met à jour la facture liée, et journalise. Nouvelle page `/admin/storage` avec config + dashboard des colis en attente (jours dépassés, frais à facturer). Sur la page détail Shipment : carte « Entreposage » avec quote en temps réel et bouton facturer.

### P2 — Opérationnel sérieux

4. ✅ **Last-mile + POD (Proof of Delivery)** — Champs ajoutés sur `Shipment` : `pickupCode` (OTP 6 chiffres unique), `pickupCodeIssuedAt`, `deliveredAt`, `deliveredToName`, `deliveredToPhone`, `deliveredToIdNumber`, `deliveredById`. Actions `generatePickupCode` (envoi WhatsApp + in-app) et `markDelivered` (validation du code, capture identité du présent, transition vers DELIVERED). UI : carte « Code de retrait & Preuve de livraison » sur page détail Shipment (toggle entre génération de code / formulaire de remise / affichage post-livraison). La preuve signée peut être attachée via la section Documents existante (type PROOF_OF_DELIVERY).
5. ✅ **Workflow de litiges / réclamations** — Modèle `Claim` avec `reference` AFR-CLM-YYYY-XXXXXX, enums `ClaimType` (LOSS, DAMAGE, DELAY, MISSING_ITEM, WRONG_ITEM, OTHER) et `ClaimStatus` (OPEN, UNDER_REVIEW, RESOLVED, REJECTED, CANCELLED), `amountClaimed` (client) + `amountGranted` (AFRYNTIX), `resolution`, `openedBy` / `resolvedBy`. Actions `createClaim` (client OU staff, contrôle d'ownership) et `updateClaim` (staff/admin uniquement). Composant `ClaimsSection` intégré dans page détail Shipment. Pages liste `/staff/claims` et `/admin/claims` (alias) avec filtres par statut. Menu sidebar mis à jour. Les photos s'attachent via la section Documents existante (type PHOTO).
6. ✅ **Manifeste container / Colist export** — Lib `src/lib/manifest.ts` (`buildManifestCsv`) avec en-têtes méta, totaux automatiques, BOM UTF-8 pour Excel. Route `/api/manifest/envoi/[id]?containerId=...` qui retourne un CSV téléchargeable (auth STAFF/ADMIN). Page imprimable `/print/manifest/envoi/[id]` au format A4 paysage avec signatures (transitaire / transporteur / destination). Boutons d'export ajoutés sur l'en-tête de la page envoi (CSV + imprimable). Filtre par container via query string.
7. ✅ **Relevé de compte client** — Page `/dashboard/account` (« Mon relevé ») avec 3 KPI (total facturé, encaissé, solde restant), tableau des factures + tableau des colis. Version imprimable `/print/statement` A4 avec en-tête client, synthèse, factures et colis. Menu sidebar client mis à jour avec lien « Mon relevé ».
8. ✅ **Opérations en masse (bulk)** — Actions `bulkUpdateShipmentStatus` (transaction, historique par colis, gestion `availableSinceAt`) et `bulkAttachShipmentsToEnvoi` (vérification du mode compatible). Nouveau composant `ShipmentsBulkTable` avec multi-sélection, toolbar amber sticky, 3 actions (changement de statut, rattachement à un envoi, détachement). Intégré dans `/staff/shipments` et `/admin/shipments`. La génération de manifeste reste accessible depuis l'envoi.
9. ✅ **Notifications Email** — Lib `src/lib/email.ts` avec `sendEmail` via API Resend (fetch direct, pas de lib). ENV : `RESEND_API_KEY` + `EMAIL_FROM`. En l'absence de clé, l'email est journalisé en QUEUED (utile en dev). Templates : `emailShipmentAvailable` et `emailPickupCode` (HTML inline avec escape). Branchés en parallèle de WhatsApp dans `handleAvailableForDelivery` (shipments.ts) et `generatePickupCode` (delivery.ts). Le canal EMAIL du schéma `Notification` est désormais utilisé.

### P3 — Croissance / différenciation

10. ✅ **Assurance cargo** — Modèle `InsuranceSetting` (singleton : `ratePercent`, `minPremiumXOF`, `maxCoverageXOF`). Champs sur `Shipment` : `insuranceOptedIn`, `declaredValue`, `insurancePremium`, `insuranceMaxCoverage`. Lib `src/lib/insurance.ts` (`computeInsurance` = max(plancher, valeur × taux%)). Actions : `getActiveInsuranceSetting`, `updateInsuranceSetting` (ADMIN), `applyInsurance` (souscription/résiliation, ajoute/retire la prime du total + recalcule facture). Page `/admin/insurance` + formulaire `InsuranceForm` sur page détail Shipment avec aperçu prime/couverture en temps réel. Menu admin mis à jour.
11. ✅ **Tarification contractuelle par client** — Modèle `ClientPricingRule` (clientId + mode + category + unit unique, `pricePerUnit`, `validFrom`/`validUntil`, `active`). Helper `getClientContractPrice` retourne le prix actif. Intégré dans `createShipment` : si aucun `overrideUnitPrice` du staff, le tarif contractuel client (s'il existe) est utilisé comme override. Actions `upsertClientPricing` + `deleteClientPricing` (ADMIN). Page `/admin/contract-pricing` avec formulaire + tableau de tous les tarifs actifs. Menu admin mis à jour.
12. ✅ **Codes HS / conformité douanière** — Champs sur `Shipment` : `hsCode`, `incoterm`, `countryOfOrigin` (ISO2), `declaredCustomsValue`. Action `updateCustomsInfo` (STAFF+ADMIN). Composant `CustomsInfoForm` sur page détail Shipment avec liste déroulante des 11 incoterms (EXW, FCA, FAS, FOB, CFR, CIF, CPT, CIP, DPU, DAP, DDP). Le manifeste CSV et HTML expose désormais ces 4 colonnes pour faciliter le dédouanement destination.
13. ✅ **Analytics avancé** — Page `/admin/analytics` (complément de `/admin/statistics`). KPI 30j : CA, colis créés, poids/volume transportés, CBM maritime, nb réclamations, taux de réclamation. Top 10 clients par CA. Répartition CA par mode (colis, poids, volume, CA, part %). Délai moyen porte-à-porte par mode sur 90j (createdAt → deliveredAt). Données purement issues du schéma, pas d'instrumentation externe.
14. ✅ **Gestion fournisseurs Chine** — Modèle `Supplier` lié à User (1:N, owner = client). Champs : name, contactPerson, phone, whatsapp, wechat, email, city, address, alibabaUrl, category, notes. Actions `upsertSupplier` + `deleteSupplier` avec contrôle d'ownership. Page `/dashboard/suppliers` avec CRUD complet (composant `SuppliersList` + `SupplierForm`). Menu client sidebar mis à jour. L'intégration aux achats/QC se fera via le module ServiceRequest existant lorsque pertinent.
15. ✅ **PWA mobile** — `public/manifest.json` (start_url `/staff/warehouse`, standalone, theme color), service worker `public/sw.js` (cache-first statiques, network-first pages). Enregistrement SW + `<link rel="manifest">` + `theme-color` ajoutés dans `src/app/layout.tsx`. Page `/staff/warehouse` optimisée mobile (max-w-md, gros boutons h-12, inputs `inputMode="decimal"`) avec recherche par tracking et formulaire de pesée vérifiée intégré (réutilise `recordVerifiedWeight`). Action `lookupShipmentForWarehouse` (STAFF+ADMIN). Menu staff mis à jour avec « Mode entrepôt 📱 ». Sync hors-ligne complète (queue IndexedDB) reste à faire en V2.

### Tâche en cours
🎉 **Toutes les tâches P1, P2, P3 sont terminées (15/15).**

### Notes de reprise (post-compaction)

- Le schéma Prisma a été modifié : il faut exécuter `npm run db:push` (ou `db:migrate`) sur la base avant de redémarrer le serveur.
- Stockage fichiers actuel : disque local sous `public/uploads/` (var `UPLOAD_DIR` en option). Migration vers un stockage objet (S3/Supabase) reste à prévoir avant prod cloud.
- Convention : les fichiers d'upload de documents vont dans `public/uploads/documents/` (sous-dossier géré par `saveBase64File`).
- Les types `DOCUMENT_TYPES_FOR_SHIPMENT` et `DOCUMENT_TYPES_FOR_ENVOI` filtrent ce qui s'affiche dans le `<select>` selon le contexte.
- **Factures par voyage** (2026-10-08) : une facture = les colis d'un shipping mark sur un envoi. Section « Factures par client » dans `/staff/envois/[id]` (`invoices-section.tsx`) → `ensureFactureForEnvoiMark` (`src/lib/facture-ensure.ts`, transactionnel). Document A4 : `src/components/factures/invoice-document.tsx`, données via `getInvoiceDoc` (les montants viennent des colis, pas de `Facture.totalAmount`). Pages : `/print/facture/[id]` (staff ou client propriétaire) et `/facture/[id]?k=…` (publique, lien signé HMAC avec `AUTH_SECRET`, voir `src/lib/facture-link.ts`). Identité légale dans `src/lib/company.ts`. Pas de librairie PDF : le téléchargement passe par l'impression du navigateur.

- **Articles à prix affichés** (2026-10-12) : page publique `/catalogue/produits` (`products-client.tsx`, 4 langues, clés `pshop.*`) — 363 articles Sanitaire et Déco & Luminaires avec photo, prix de l'article et fret + dédouanement par pièce ; filtres par famille / catégorie, recherche, tri, fiche article (`?ref=AFR-WC-001`). Entrée en tête de `/catalogue` et bouton dans `/dashboard/catalogue`. **Données** : `src/data/shop-products.json`, généré par `node scripts/build-shop-catalog.mjs` à partir des classeurs de prix gardés hors git dans `catalogues/boutique/src/` (`products.json` avec les prix d'usine, `params.json` : taux RMB→FCFA, marge et tarif par CBM de chaque famille). Le fichier généré ne contient ni prix d'usine ni référence fournisseur ; pour changer un prix, modifier les sources puis relancer le script. Lecture par `src/lib/shop-products.ts` (`getShopProduct`, `shopProductName`, `shopTotals`). **Photos** : `public/produits/v1/<ref>.webp` (fiche) et `t/<ref>.webp` (vignette), servies avec un cache d'un an ; si elles sont régénérées, changer le numéro du dossier (`SHOP_IMAGE_BASE`). Elles sortent de `catalogues/_outils/boutique_photos.py` (agrandissement ×4 par Real-ESRGAN, retouches de `catalogues/boutique/masques.json` : filigranes de marque, étiquettes de prix et numéros de modèle du fournisseur effacés). **Panier** : le même que celui des catalogues PDF (`src/lib/catalog-cart.ts`, lignes `kind: "product"` qui ne gardent que la référence) ; `/catalogue/panier` affiche les prix et le total. **Commande sans devis** (2026-10-12) : les prix étant affichés, le panier se termine par « Confirmer ma commande ». `createCartOrder` relit les prix côté serveur et crée une commande **déjà confirmée** : lignes sans `catalogId` (`catalogTitle` = « Articles à prix affichés », référence AFRYNTIX, `unitPrice` / `lineTotal` au prix affiché), `feesAmount` = fret + dédouanement, `totalAmount`, statut CONFIRMED et `acceptedAt` **sans** `quotedAt`. C'est ce couple qui marque une commande « directe » : `isDirectOrder`, `orderAmountsVisible` (le client voit ses montants tout de suite) et `catalogOrderStatusLabel` (« Commande confirmée » au lieu de « Devis accepté ») dans `src/lib/catalog-labels.ts`. Un panier mixte (articles à prix affichés + articles touchés dans un catalogue PDF) donne **deux commandes** créées ensemble : une confirmée, une demande de devis. L'équipe reçoit « Nouvelle commande confirmée » (cloche + email), le client un email `emailCatalogOrderConfirmed` si son adresse est connue ; le paiement reste hors ligne. Pour modifier une commande confirmée (rupture, prix qui a changé) : bouton « Corriger la commande » sur `/staff/orders/[id]` (`reopenCatalogOrder`, tant qu'aucun colis n'existe) → elle repasse en devis à établir et le client doit valider le nouveau devis ; elle n'est alors plus « directe ». Les statistiques de devis (`quotedAt`) n'incluent pas les commandes directes. Les photos des lignes viennent de `shopOrderItemImage` (pas de `CatalogOrderItemImage`). Aucun changement de schéma.

- **Suppression d'une commande catalogue** (2026-10-14) : réservée au rôle ADMIN (`deleteCatalogOrder` dans `src/server/actions/catalogues.ts`, `requireRole("ADMIN")`), quel que soit le statut. Bouton `DeleteOrderButton` (`src/components/catalogues/delete-order-button.tsx`) : colonne « Supprimer » dans la liste `/staff/orders` (alias `/admin/orders`) et zone en bas de `/staff/orders/[id]`, affichées seulement à l'admin, avec confirmation. La suppression est définitive : lignes et photos d'articles partent en cascade, les rappels de la cloche de l'équipe qui pointaient vers la commande sont retirés, le lien de suivi du client ne répond plus. Les colis déjà créés sont conservés, détachés de la commande (`Shipment.catalogOrder` en `onDelete: SetNull`).

- **Vitesse de la visionneuse de catalogues** (2026-10-12) : mesuré sur le site, un aller-retour vers le serveur coûte ~0,5 s, pour 128 Ko comme pour 1 Mo (rien n'est mis en cache par Cloudflare). La visionneuse fait donc peu de requêtes, lancées tôt et lues au fil de l'eau (`src/lib/catalog-pdf.ts`) : un script en ligne rendu par `/catalogue/[id]/page.tsx` (`catalogBootScript`) lance dès l'arrivée du HTML le début du fichier (≈ 1 Mo : objets d'ouverture + première page) et son dernier bloc (table xref, calculé avec `Catalog.fileSize`), et met le worker PDF.js en cache ; `createChunkLoader` sert ensuite PDF.js depuis ces blocs et garde de l'avance sur la lecture, selon le débit qu'il mesure sur les octets reçus (`catalogReadAhead` : `CATALOG_READ_AHEAD` = 8 blocs, soit 1 Mo, à partir de ~700 Ko/s ou tant que le débit n'est pas mesuré ; 4 blocs entre 450 et 700 Ko/s ; 1 bloc en dessous, pour que la suite préchargée ne prenne pas la place de ce que PDF.js attend). Sans avance si le navigateur demande l'économie de données. Les fichiers PDF.js sont copiés dans `public/pdfjs/v<version>/` et servis avec un cache d'un an (`next.config.ts`). Outils de mesure sur réseau simulé, dans `catalogues/_outils/` (non suivi par git) : `mesure_visionneuse.ts` (temps réel, décodage compris : à lancer seul, le résultat dépend du processeur) et `simule_visionneuse.ts` (temps virtuel, pour balayer des débits — c'est lui qui a donné les paliers).

- **Commandes : tableau de bord et statistiques** (2026-10-12) : `/dashboard` affiche une carte « Mes commandes en cours » (commandes ni livrées ni annulées, `CATALOG_ORDER_ACTIVE_STATUSES` dans `src/lib/catalog-labels.ts` ; le montant n'apparaît qu'après envoi du devis ; bouton « Répondre au devis » pour QUOTED ; clés `dash.home.orders.*` dans les 4 langues). `/admin/statistics` se termine par une section « Commandes catalogue » (`order-stats.tsx` + `order-charts.tsx`, calculs dans `src/lib/catalog-order-stats.ts`) : une commande « validée » est CONFIRMED → DELIVERED (`CATALOG_ORDER_VALIDATED_STATUSES`), le taux d'acceptation porte sur les devis réellement envoyés (`quotedAt`).

- **Variables des modèles WhatsApp — erreur Twilio 21656** (2026-10-12) : Twilio refuse l'envoi si une variable est vide ou contient un retour à la ligne, une tabulation ou plus de 4 espaces de suite (cas réel : description de colis reprise d'une commande, complétée sur une nouvelle ligne). `src/lib/whatsapp-templates.ts` ramène chaque variable sur une ligne et la limite à 240 caractères (`receptionNoticeDetails`, `trackingListVariable` : au-delà, « + N autres colis »). `sendWhatsApp` renvoie la notification avec son statut final (SENT / FAILED) ; `sendReceptionNotice` ne marque plus les colis « notifiés » quand l'envoi échoue et affiche l'erreur à l'équipe.

- **Panier dans le catalogue** (2026-10-11) : dans la visionneuse `/catalogue/[id]`, le client **touche un article** sur la page → fiche (photo de la zone touchée, quantité, précision facultative) → « Ajouter au panier ». Plus aucune référence à recopier. Panier dans le navigateur (`src/lib/catalog-cart.ts`, localStorage, max `CART_MAX_ITEMS` = 40), page publique `/catalogue/panier` (4 langues). Envoi par `createCartOrder` (`src/server/actions/catalog-cart.ts`) **avec ou sans compte** : connecté → commande dans « Mes commandes » ; sans compte → nom + numéro WhatsApp (`CatalogOrder.clientId` est désormais optionnel, `guestName` / `guestEmail`), limite de débit par IP + champ piège. Chaque ligne garde `posX` / `posY` (position du toucher, 0–1), `note`, et une photo JPEG dans la table à part `CatalogOrderItemImage` (servie par `/api/catalogue/order-item/[id]/image` : équipe, client propriétaire ou lien signé). La référence est vide à la création (`designation` = « Article page N ») : **l'équipe la précise dans le devis** (`saveCatalogQuote` accepte `reference` / `designation` par ligne ; lien « voir l'article » = `/catalogue/[id]?page=N&x=…&y=…` qui ouvre la page avec un repère). Sans compte, le client suit sa demande et **accepte / refuse le devis** sur `/commande/[id]?k=…` (lien signé HMAC, `src/lib/catalog-order-link.ts` ; actions `acceptCatalogQuoteByLink` / `cancelCatalogOrderByLink`) ; `/staff/orders/[id]` affiche le bloc « Lien du client » (bouton WhatsApp pré-rempli + copier le lien) — l'email de devis ne part que si une adresse est connue. Helpers partagés dans `src/lib/catalog-orders.ts` (`orderParty` = client ou demandeur sans compte, `notifyOrderTeam`, `emailOrderTeam`). Expédition d'une demande sans compte : `/staff/shipments/new?orderId=…` s'ouvre en « Sans compte » pré-rempli ; si un client enregistré est choisi, la commande lui est rattachée. L'ancien formulaire par références reste à `/dashboard/catalogue/order`.

- **Catalogues & commandes sur devis** (2026-10-10) : 4 catégories (`CatalogCategory` : SANITAIRE, CARREAUX, DECO_LUMINAIRE, MEUBLE — CARREAUX ajoutée le 2026-10-11 ; l'ordre d'affichage est celui de `CATALOG_CATEGORIES` dans `src/lib/catalog-labels.ts`, pas celui de l'enum). Modèles `Catalog` (PDF + couverture optionnelle), `CatalogOrder` (réf. AFR-CMD-YYYY-XXXXXX) et `CatalogOrderItem`. **Les catalogues n'ont pas de prix** : le client envoie un bon de commande (catalogue, référence, désignation, quantité), AFRYNTIX établit le devis. Statuts : PENDING (devis à établir) → QUOTED (devis envoyé) → CONFIRMED (accepté par le client ou par le staff) → IN_PREPARATION → SHIPPED → DELIVERED, ou CANCELLED. Actions (`src/server/actions/catalogues.ts`) : `createCatalogOrder`, `acceptCatalogQuote`, `cancelCatalogOrder` (CLIENT) ; `saveCatalogQuote` (brouillon ou envoi : prix unitaires + frais annexes + remarque, notif in-app + email `emailCatalogQuote`) et `updateCatalogOrderStatus` (STAFF+ADMIN). L'équipe est notifiée in-app à chaque bon de commande / acceptation / annulation. Le client ne voit les prix qu'après envoi du devis. Fichiers dans le bucket Supabase privé `catalogues` (`src/lib/supabase-storage.ts`) : upload direct navigateur → Supabase par lien signé (`requestCatalogUpload`, d'où l'origine Supabase dans `connect-src` de la CSP), lecture via `/api/catalogue/[id]/file` (proxy en flux continu avec requêtes partielles `Range`, cache navigateur 24 h, `?download=1` pour forcer le téléchargement — l'adresse Supabase n'est jamais montrée au visiteur) et `/api/catalogue/[id]/cover` (proxy). **Visionneuse** `/catalogue/[id]` (`catalog-viewer.tsx`, PDF.js `pdfjs-dist` version figée) : tous les liens « Consulter » y mènent ; le PDF est lu par blocs de 128 Ko à la demande (seules les pages proches de l'écran sont téléchargées et dessinées, reprise automatique si le réseau décroche). Le worker, les cMaps et les polices PDF.js sont copiés dans `public/pdfjs/` (ignoré par git) par `scripts/copy-pdfjs-assets.mjs`, lancé par `predev` / `prebuild`. Un PDF enregistré avec flux d'objets (object streams) s'ouvre en ~4 requêtes contre ~17 avec une table xref classique : à privilégier à la génération des catalogues. Pages : `/catalogue` (publique), `/catalogue/[id]` (visionneuse, publique pour les catalogues actifs), `/dashboard/catalogue` + `/dashboard/catalogue/order` + `/dashboard/orders` (client), `/admin/catalogues` (ADMIN), `/staff/orders` + `/staff/orders/[id]` (alias `/admin/orders`), `/print/devis/[id]` (bon de commande ou devis A4). Pas de paiement en ligne. Emails équipe : chaque bon de commande, copie de devis envoyé, acceptation et annulation part aussi vers `TEAM_EMAIL` (`ORDERS_NOTIFY_EMAIL`, défaut `infos@afryntix.com`) via `emailCatalogOrderTeam` ; l'email de devis au client a ce même reply-to. Envoi (`src/lib/email.ts`) : SMTP de la boîte Namecheap Private Email via nodemailer si `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` sont définis (`mail.privateemail.com:465`, offre Render payante requise car l'offre gratuite bloque SMTP), sinon API Resend (`RESEND_API_KEY`), sinon QUEUED. Expédition d'une commande : sur `/staff/orders/[id]`, bouton « Créer l'expédition » (statuts CONFIRMED / IN_PREPARATION / SHIPPED) → `/staff/shipments/new?orderId=…` pré-rempli (client, destinataire, ville, description). `Shipment.catalogOrderId` lie le colis à la commande (1 commande → N colis) ; `createShipment` passe la commande en SHIPPED et notifie le client avec le lien de suivi ; `syncCatalogOrderDelivered` (`src/lib/catalog-orders.ts`) passe la commande en DELIVERED quand tous ses colis sont livrés. Le client voit le n° de suivi dans `/dashboard/orders`.
