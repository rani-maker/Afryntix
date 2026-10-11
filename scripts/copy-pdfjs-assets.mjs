// Copie les fichiers statiques de PDF.js (worker, cMaps, polices standard)
// vers public/pdfjs/ pour la visionneuse de catalogues (/catalogue/[id]).
// Lancé automatiquement avant `npm run dev` et `npm run build` : les fichiers
// restent ainsi alignés sur la version installée de pdfjs-dist (le worker doit
// avoir exactement la même version que la librairie).
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pdfjs-dist");
// Dossier au nom de la version (public/pdfjs/v4.10.38/) : le navigateur peut le
// garder en cache « pour toujours », un changement de version change l'adresse.
const { version } = JSON.parse(readFileSync(join(src, "package.json"), "utf8"));
const dest = join(root, "public", "pdfjs", `v${version}`);

rmSync(join(root, "public", "pdfjs"), { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

cpSync(join(src, "legacy", "build", "pdf.worker.min.mjs"), join(dest, "pdf.worker.min.mjs"));
cpSync(join(src, "cmaps"), join(dest, "cmaps"), { recursive: true });
cpSync(join(src, "standard_fonts"), join(dest, "standard_fonts"), { recursive: true });

console.log(`→ PDF.js : worker, cMaps et polices copiés dans public/pdfjs/v${version}/`);
