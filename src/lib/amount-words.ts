// Montant en toutes lettres (français) pour la mention « Arrêtée la présente facture à la somme de… ».

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

// `plural` : « quatre-vingts » et « cents » ne prennent le s que s'ils terminent le nombre
// ou précèdent million/milliard — jamais devant « mille ».
function below100(n: number, plural: boolean): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7 || t === 9) {
    if (t === 7 && u === 1) return "soixante et onze";
    return `${TENS[t]}-${UNITS[10 + u]}`;
  }
  if (u === 0) return t === 8 && plural ? "quatre-vingts" : TENS[t];
  if (u === 1 && t !== 8) return `${TENS[t]} et un`;
  return `${TENS[t]}-${UNITS[u]}`;
}

function below1000(n: number, plural: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h === 1) parts.push("cent");
  else if (h > 1) parts.push(`${UNITS[h]} cent${r === 0 && plural ? "s" : ""}`);
  if (r > 0) parts.push(below100(r, plural));
  return parts.join(" ");
}

export function numberToFrenchWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return "zéro";
  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1e3);
  const reste = n % 1000;
  const parts: string[] = [];
  if (milliards) parts.push(`${below1000(milliards, true)} milliard${milliards > 1 ? "s" : ""}`);
  if (millions) parts.push(`${below1000(millions, true)} million${millions > 1 ? "s" : ""}`);
  if (milliers) parts.push(milliers === 1 ? "mille" : `${below1000(milliers, false)} mille`);
  if (reste) parts.push(below1000(reste, true));
  return parts.join(" ");
}

export function amountInWordsXOF(value: number): string {
  const n = Math.round(Math.abs(value));
  const words = numberToFrenchWords(n);
  // « deux millions de francs » : million/milliard sont des noms, ils appellent « de ».
  const needsDe = n >= 1e6 && n % 1e6 === 0;
  const text = `${words} ${needsDe ? "de " : ""}franc${n > 1 ? "s" : ""} CFA`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
