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

