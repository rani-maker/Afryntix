// Génère src/data/shop-products.json (catalogue d'articles à prix affichés, /catalogue/produits)
// à partir des sources de prix : products.json + params.json.
//
//   node scripts/build-shop-catalog.mjs [dossier des sources]
//
// Le dossier des sources (par défaut catalogues/boutique/src, non suivi par git) contient
// les prix d'usine : ils ne sortent jamais d'ici. Le fichier généré ne garde que ce que le
// client peut voir (référence AFRYNTIX, prix de vente, fret + dédouanement).
//
//   prix de l'article   = arrondi supérieur( prix usine RMB × taux × (1 + marge) )
//   fret + dédouanement = arrondi supérieur( volume m³ × tarif par CBM )
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.resolve(root, process.argv[2] ?? "catalogues/boutique/src");
const outFile = path.join(root, "src/data/shop-products.json");

const params = JSON.parse(readFileSync(path.join(srcDir, "params.json"), "utf8"));
const source = JSON.parse(readFileSync(path.join(srcDir, "products.json"), "utf8"));

// Famille du classeur de prix → catégorie de catalogue du site (enum CatalogCategory)
const FAMILIES = { Sanitaire: "SANITAIRE", "Déco & Luminaires": "DECO_LUMINAIRE" };
const ECO_SUFFIX = " (gamme éco)";

const step = params.arrondi_fcfa;
const ceilTo = (x) => Math.ceil(Number((x / step).toFixed(6))) * step;

const seen = new Set();
const categories = [];
const products = source.map((p) => {
  const family = FAMILIES[p.famille];
  const rates = params.familles[p.famille];
  if (!family || !rates) throw new Error(`${p.ref} : famille inconnue « ${p.famille} »`);

  const ref = /^AFR-([A-Z]+)-(\d{3})$/.exec(p.ref);
  if (!ref) throw new Error(`Référence inattendue : ${p.ref}`);
  if (seen.has(p.ref)) throw new Error(`Référence en double : ${p.ref}`);
  seen.add(p.ref);
  const [, cat, num] = ref;

  // « <catégorie> – modèle <n>[ · caractéristiques][ (gamme éco)] »
  const eco = p.gamme === "éco";
  const base = eco && p.nom.endsWith(ECO_SUFFIX) ? p.nom.slice(0, -ECO_SUFFIX.length) : p.nom;
  const prefix = `${p.categorie} – modèle ${Number(num)}`;
  if (base !== prefix && !base.startsWith(`${prefix} · `)) {
    throw new Error(`${p.ref} : nom inattendu « ${p.nom} »`);
  }
  const spec = base.slice(prefix.length + 3);

  if (!(p.prix_usine_rmb > 0) || !(p.volume_m3 > 0)) throw new Error(`${p.ref} : prix ou volume manquant`);
  const expectedImage = `img/${p.ref.toLowerCase()}.jpg`;
  if (p.image !== expectedImage) throw new Error(`${p.ref} : photo inattendue « ${p.image} »`);

  let entry = categories.find((c) => c.code === cat);
  if (!entry) categories.push((entry = { code: cat, family, label: p.categorie, count: 0 }));
  if (entry.label !== p.categorie || entry.family !== family) {
    throw new Error(`${p.ref} : le code ${cat} désigne déjà « ${entry.label} »`);
  }
  entry.count++;

  return {
    ref: p.ref,
    family,
    cat,
    n: Number(num),
    ...(spec ? { spec } : {}),
    ...(eco ? { eco: true } : {}),
    price: ceilTo(p.prix_usine_rmb * params.taux_rmb_fcfa * (1 + rates.marge)),
    freight: ceilTo(p.volume_m3 * rates.fret_par_cbm),
  };
});

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify({ categories, products }, null, 1)}\n`);
console.log(`${products.length} articles, ${categories.length} catégories → ${path.relative(root, outFile)}`);
