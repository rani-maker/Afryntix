// Lecture d'un PDF de catalogue par la visionneuse (/catalogue/[id]) : code partagé
// par la page serveur (qui lance les premiers téléchargements dès l'arrivée du HTML)
// et par la visionneuse.
//
// Constat mesuré sur le site : un aller-retour vers le serveur coûte environ une
// demi-seconde, pour 128 Ko comme pour 1 Mo. On fait donc peu de requêtes, lancées
// tôt, et on les lit au fil de l'eau : chaque bloc sert dès qu'il est arrivé, ce
// qui ne pénalise pas non plus les connexions à faible débit.

/** Taille des blocs lus par PDF.js — celle pour laquelle `web_layout.py` range les fichiers. */
export const CATALOG_CHUNK = 128 * 1024;

/** Avance de lecture, en blocs (≈ 1 Mo) : la suite du fichier, donc les pages suivantes. */
export const CATALOG_READ_AHEAD = 8;

/**
 * Plages `[début, fin[` à lancer en parallèle à l'ouverture d'un fichier de `size`
 * octets : le début (objets d'ouverture, puis première page) et le dernier bloc
 * (table xref). Avec `lean` (économiseur de données), pas d'avance de lecture.
 */
export function catalogBootRanges(size: number | null | undefined, lean = false): Array<[number, number]> {
  if (!size || !Number.isInteger(size) || size <= CATALOG_CHUNK) return [[0, CATALOG_CHUNK]];
  const tail = Math.floor((size - 1) / CATALOG_CHUNK) * CATALOG_CHUNK;
  const headEnd = lean ? CATALOG_CHUNK : Math.min(tail, CATALOG_CHUNK * (1 + CATALOG_READ_AHEAD));
  return [
    [0, headEnd],
    [tail, size],
  ];
}

/**
 * Un téléchargement en cours, lu au fil de l'eau. Même forme pour ceux que lance
 * le script en ligne de la page et pour ceux que lance la visionneuse.
 */
export type CatalogPart = {
  begin: number;
  end: number;
  /** Taille totale du fichier, connue dès les en-têtes de la réponse. */
  total: number;
  pieces: Uint8Array[];
  done: boolean;
  error: unknown;
  wake: (() => void) | null;
};
export type CatalogBoot = { id: string; parts: CatalogPart[] };

/** Lance le téléchargement en flux de la plage `[begin, end[`. */
export function openCatalogPart(url: string, begin: number, end: number, signal?: AbortSignal): CatalogPart {
  const part: CatalogPart = { begin, end, total: NaN, pieces: [], done: false, error: null, wake: null };
  const wake = () => part.wake?.();
  fetch(url, { headers: { Range: `bytes=${begin}-${end - 1}` }, signal })
    .then(async (res) => {
      if (res.status !== 206 || !res.body) throw new Error(`Réponse ${res.status} pour les octets ${begin}-${end - 1}`);
      part.total = Number(/\/(\d+)$/.exec(res.headers.get("Content-Range") ?? "")?.[1]);
      wake();
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        part.pieces.push(value);
        wake();
      }
      part.done = true;
      wake();
    })
    .catch((e) => {
      part.error = e ?? new Error("réseau");
      wake();
    });
  return part;
}

const partChange = (part: CatalogPart) =>
  new Promise<void>((resolve) => {
    part.wake = resolve;
  });

/** Taille totale du fichier annoncée par la réponse (attend ses en-têtes). */
export async function catalogPartTotal(part: CatalogPart): Promise<number> {
  while (!Number.isFinite(part.total)) {
    if (part.error) throw part.error;
    if (part.done) throw new Error("taille du fichier inconnue");
    await partChange(part);
  }
  return part.total;
}

/** Octets d'un téléchargement, remis dans l'ordre à mesure qu'ils arrivent. */
export type ByteFeed = (onBytes: (bytes: Uint8Array) => void) => Promise<void>;

export const catalogPartFeed =
  (part: CatalogPart): ByteFeed =>
  async (onBytes) => {
    for (;;) {
      while (part.pieces.length > 0) onBytes(part.pieces.shift()!);
      if (part.error) throw part.error;
      if (part.done) return;
      await partChange(part);
    }
  };

/**
 * Blocs du PDF, téléchargés en avance sur PDF.js. Les blocs contigus partent dans
 * une seule requête lue au fil de l'eau : ceux que PDF.js attend arrivent en
 * premier, la suite du fichier (les pages suivantes) continue derrière, et le
 * lecteur la trouve déjà là en faisant défiler.
 *
 * `open` lance un téléchargement en flux ; `fetchRange` est le repli (plage exacte,
 * avec nouvelles tentatives) quand un flux a échoué.
 */
export function createChunkLoader(
  open: (begin: number, end: number) => ByteFeed,
  fetchRange: (begin: number, end: number) => Promise<Uint8Array>,
  total: number,
  readAhead: number,
  isAborted: () => boolean = () => false,
) {
  const lastChunk = Math.floor((total - 1) / CATALOG_CHUNK);
  const ready = new Map<number, Promise<Uint8Array>>(); // en cours ou reçus, pas encore remis à PDF.js
  const given = new Set<number>(); // déjà remis : inutile de les précharger

  /** Répartit un flux `[begin, end[` (aligné sur les blocs) : chaque bloc est prêt dès qu'il est complet. */
  const adopt = (begin: number, end: number, feed: ByteFeed) => {
    const first = begin / CATALOG_CHUNK;
    const slots = Array.from({ length: Math.ceil((end - begin) / CATALOG_CHUNK) }, (_, k) => {
      let resolve!: (data: Uint8Array) => void;
      let reject!: (e: unknown) => void;
      const promise = new Promise<Uint8Array>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // Flux interrompu : le bloc sera redemandé quand PDF.js en aura besoin
      promise.catch(() => {
        if (ready.get(first + k) === promise) ready.delete(first + k);
      });
      ready.set(first + k, promise);
      return { size: Math.min(CATALOG_CHUNK, end - begin - k * CATALOG_CHUNK), buf: null as Uint8Array | null, filled: 0, resolve, reject };
    });
    let k = 0;
    const fail = (e: unknown) => {
      for (; k < slots.length; k++) slots[k].reject(e);
    };
    feed((bytes) => {
      let offset = 0;
      while (offset < bytes.length && k < slots.length) {
        const slot = slots[k];
        slot.buf ??= new Uint8Array(slot.size);
        const n = Math.min(bytes.length - offset, slot.size - slot.filled);
        slot.buf.set(bytes.subarray(offset, offset + n), slot.filled);
        slot.filled += n;
        offset += n;
        if (slot.filled === slot.size) {
          slot.resolve(slot.buf);
          k++;
        }
      }
    }).then(() => fail(new Error("flux incomplet")), fail);
  };

  /** Ouvre un flux par suite contiguë de blocs manquants dans [first, last]. */
  const load = (first: number, last: number, neededLast: number) => {
    let start = -1;
    for (let i = first; i <= last + 1; i++) {
      const missing = i <= last && !ready.has(i) && !(i > neededLast && given.has(i));
      if (missing && start < 0) start = i;
      if (!missing && start >= 0) {
        const begin = start * CATALOG_CHUNK;
        const end = Math.min(i * CATALOG_CHUNK, total);
        adopt(begin, end, open(begin, end));
        start = -1;
      }
    }
  };

  const aligned = (begin: number, end: number) =>
    begin >= 0 && begin < end && end <= total && begin % CATALOG_CHUNK === 0 && (end % CATALOG_CHUNK === 0 || end === total);

  const release = (indices: number[]) => {
    for (const i of indices) {
      given.add(i);
      ready.delete(i);
    }
  };

  return {
    /** Flux déjà lancé (ignoré s'il ne correspond pas au fichier réel). */
    adopt(begin: number, end: number, feed: ByteFeed) {
      if (aligned(begin, end)) adopt(begin, end, feed);
    },
    /** Précharge des plages sans attendre que PDF.js les demande. */
    prefetch(ranges: Array<[number, number]>) {
      for (const [begin, end] of ranges) {
        if (aligned(begin, end)) load(begin / CATALOG_CHUNK, Math.floor((end - 1) / CATALOG_CHUNK), -1);
      }
    },
    /** Premier bloc d'un flux adopté (donnée initiale de PDF.js). */
    async take(index: number): Promise<Uint8Array> {
      const piece = ready.get(index);
      if (!piece) throw new Error("bloc absent");
      const data = await piece;
      release([index]);
      return data;
    },
    /** Octets [begin, end[ réclamés par PDF.js (toujours alignés sur les blocs). */
    async read(begin: number, end: number): Promise<Uint8Array> {
      const first = Math.floor(begin / CATALOG_CHUNK);
      const last = Math.floor((end - 1) / CATALOG_CHUNK);
      const indices = Array.from({ length: last - first + 1 }, (_, k) => first + k);
      // Avance de lecture : jamais plus de `readAhead` blocs d'avance en attente, tous
      // flux confondus (PDF.js demande souvent plusieurs zones du fichier à la fois).
      const room = () => {
        let waiting = 0;
        for (const i of ready.keys()) if (i < first || i > last) waiting++;
        return Math.max(0, readAhead - waiting);
      };
      // Blocs demandés manquants : un seul flux, prolongé par l'avance de lecture
      if (indices.some((i) => !ready.has(i))) load(first, Math.min(lastChunk, last + room()), last);
      let out: Uint8Array = new Uint8Array(end - begin);
      try {
        const pieces = await Promise.all(indices.map((i) => ready.get(i) ?? Promise.reject(new Error("bloc absent"))));
        let filled = 0;
        for (const piece of pieces) {
          out.set(piece.subarray(0, Math.min(piece.length, out.length - filled)), filled);
          filled += piece.length;
        }
        if (filled !== out.length) throw new Error("plage incomplète");
      } catch (e) {
        if (isAborted()) throw e;
        // Un flux a échoué : on redemande exactement la plage voulue
        out = await fetchRange(begin, end);
      }
      release(indices);
      // Les blocs attendus sont arrivés : on refait de l'avance dès qu'elle est à moitié consommée
      const free = room();
      if (free > 0 && free >= readAhead / 2) {
        let covered = last;
        while (covered < lastChunk && (ready.has(covered + 1) || given.has(covered + 1))) covered++;
        if (covered < lastChunk) load(covered + 1, Math.min(lastChunk, covered + free), -1);
      }
      return out;
    },
  };
}

/**
 * Script exécuté dès l'analyse du HTML, donc avant le chargement du code de la
 * visionneuse : il lance les premières plages du PDF (même forme que
 * `openCatalogPart`) et met le worker PDF.js dans le cache du navigateur. La
 * visionneuse reprend le tout dans `window.__afxCatalogBoot`.
 */
export function catalogBootScript(id: string, size: number | null, pdfAssets: string): string {
  const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
  return (
    `(function(){try{var u=${json(`/api/catalogue/${id}/file`)};` +
    `var lean=!!(navigator.connection&&navigator.connection.saveData);` +
    `function g(b,e){var p={begin:b,end:e,total:NaN,pieces:[],done:false,error:null,wake:null};` +
    `function w(){if(p.wake)p.wake()}` +
    `fetch(u,{headers:{Range:"bytes="+b+"-"+(e-1)}}).then(function(r){` +
    `if(r.status!==206||!r.body)throw new Error("HTTP "+r.status);` +
    `p.total=Number((/\\/(\\d+)$/.exec(r.headers.get("Content-Range")||"")||[])[1]);w();` +
    `var d=r.body.getReader();return(function n(){return d.read().then(function(x){` +
    `if(x.done){p.done=true;w();return}p.pieces.push(x.value);w();return n()})})()` +
    `}).catch(function(err){p.error=err||new Error("reseau");w()});return p}` +
    `window.__afxCatalogBoot={id:${json(id)},parts:(lean?${json(catalogBootRanges(size, true))}:${json(catalogBootRanges(size))})` +
    `.map(function(r){return g(r[0],r[1])})};` +
    `fetch(${json(`${pdfAssets}/pdf.worker.min.mjs`)}).catch(function(){})}catch(e){}})();`
  );
}
