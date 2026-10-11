"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Download, FileText, Loader2, Minus, Plus, RotateCw, ShoppingBag, X } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { Logo } from "@/components/brand/logo";
import { useLang } from "@/components/public/public-language-provider";
import { useCatalogCart } from "@/lib/catalog-cart";
import {
  CATALOG_CHUNK,
  CATALOG_READ_AHEAD,
  catalogBootRanges,
  catalogPartFeed,
  catalogPartTotal,
  createChunkLoader,
  openCatalogPart,
  type CatalogBoot,
} from "@/lib/catalog-pdf";

declare global {
  interface Window {
    __afxCatalogBoot?: CatalogBoot;
  }
}

// PDF.js est demandé dès que ce module s'exécute dans le navigateur, sans attendre l'hydratation
type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsModule: Promise<PdfJs> | null = null;
const loadPdfjs = () => (pdfjsModule ??= import("pdfjs-dist/legacy/build/pdf.mjs"));
if (typeof window !== "undefined") {
  loadPdfjs().catch(() => {
    pdfjsModule = null;
  });
}

const ZOOM_LEVELS = [1, 1.5, 2, 3];
// Largeur d'affichage maximale à 100 % (pages portrait / pages paysage)
const MAX_FIT_PORTRAIT = 900;
const MAX_FIT_LANDSCAPE = 1280;
// Plafond de pixels par page : au-delà, les mobiles (iOS surtout) saturent en mémoire
const MAX_CANVAS_PIXELS = 8_000_000;
// Taille des blocs téléchargés à la demande
const RANGE_CHUNK_SIZE = CATALOG_CHUNK;
const RANGE_MAX_RETRIES = 5;
// Photo de la zone touchée, jointe à la demande de devis
const THUMB_SIZE = 360;
const HINT_KEY = "afryntix-catalog-hint-v1";

type Mark = { x: number; y: number; kind: "cart" | "pick" | "focus" };
type Pick = { page: number; x: number; y: number; thumb: string };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Découpe dans la page dessinée un carré centré sur le point touché, avec un
 * repère à l'endroit exact : c'est ce que l'équipe voit pour identifier l'article.
 */
function captureThumb(canvas: HTMLCanvasElement, x: number, y: number): string | null {
  const { width, height } = canvas;
  if (!width || !height) return null;
  const side = Math.round(Math.min(width * 0.45, width, height));
  const sx = Math.round(Math.min(Math.max(x * width - side / 2, 0), width - side));
  const sy = Math.round(Math.min(Math.max(y * height - side / 2, 0), height - side));
  const size = Math.min(THUMB_SIZE, side);
  const thumb = document.createElement("canvas");
  thumb.width = size;
  thumb.height = size;
  const context = thumb.getContext("2d");
  if (!context) return null;
  context.drawImage(canvas, sx, sy, side, side, 0, 0, size, size);
  const px = ((x * width - sx) / side) * size;
  const py = ((y * height - sy) / side) * size;
  const radius = size * 0.07;
  context.lineWidth = Math.max(3, size / 60);
  context.strokeStyle = "#ffffff";
  context.beginPath();
  context.arc(px, py, radius + context.lineWidth, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = "#00c79a";
  context.beginPath();
  context.arc(px, py, radius, 0, Math.PI * 2);
  context.stroke();
  try {
    return thumb.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

/**
 * Télécharge les octets [begin, end[ du PDF. Les coupures réseau sont fréquentes
 * sur mobile : on réessaie plusieurs fois avant d'abandonner.
 */
async function fetchRange(
  url: string,
  begin: number,
  end: number,
  signal: AbortSignal,
): Promise<{ data: Uint8Array; total: number }> {
  let pause = 400;
  for (let attempt = 0; ; attempt++) {
    let fatal = false;
    try {
      const res = await fetch(url, { headers: { Range: `bytes=${begin}-${end - 1}` }, signal });
      if (res.status === 206) {
        const total = Number(/\/(\d+)$/.exec(res.headers.get("Content-Range") ?? "")?.[1]);
        const data = new Uint8Array(await res.arrayBuffer());
        if (Number.isFinite(total) && data.length > 0) return { data, total };
      }
      // Catalogue retiré / accès refusé : inutile d'insister
      fatal = res.status === 401 || res.status === 403 || res.status === 404;
      throw new Error(`Réponse ${res.status} pour les octets ${begin}-${end - 1}`);
    } catch (e) {
      if (fatal || signal.aborted || attempt >= RANGE_MAX_RETRIES) throw e;
      await new Promise((resolve) => setTimeout(resolve, pause));
      pause = Math.min(pause * 2, 5000);
    }
  }
}

/**
 * Visionneuse de catalogue : le PDF est lu par plages d'octets (PDF.js) et seules
 * les pages proches de l'écran sont téléchargées puis dessinées. La première page
 * s'affiche donc sans attendre le téléchargement complet du fichier.
 *
 * Commande (`canOrder`) : le client touche un article sur la page, choisit la
 * quantité et l'ajoute au panier — sans recopier de référence.
 * `focus` : ouvre le catalogue sur une page, avec un repère à l'endroit touché
 * (lien utilisé par l'équipe depuis une ligne de commande).
 */
export function CatalogViewer({
  catalogId,
  title,
  fileSize,
  pdfAssets,
  canOrder,
  focus,
}: {
  catalogId: string;
  title: string;
  /** Taille du PDF connue de la base : permet de lancer d'emblée la fin du fichier. */
  fileSize: number | null;
  /** Dossier des fichiers statiques de PDF.js (worker, cMaps, polices), versionné. */
  pdfAssets: string;
  canOrder: boolean;
  focus?: { page: number; x: number | null; y: number | null };
}) {
  const { t } = useLang();
  const fileUrl = `/api/catalogue/${catalogId}/file`;
  const cart = useCatalogCart();

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [firstRatio, setFirstRatio] = useState(1.414); // hauteur / largeur de la 1re page
  const [failed, setFailed] = useState(false);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [current, setCurrent] = useState(1);
  const zoomAnchor = useRef<number | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [cartFull, setCartFull] = useState(false);
  const [hintSeen, setHintSeen] = useState(true);
  const focusDone = useRef(false);

  useEffect(() => {
    try {
      setHintSeen(localStorage.getItem(HINT_KEY) === "1");
    } catch {
      setHintSeen(false);
    }
  }, []);

  function dismissHint() {
    setHintSeen(true);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {}
  }

  useEffect(() => {
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | null = null;
    const fail = (e: unknown) => {
      if (controller.signal.aborted) return;
      console.error("[catalogue] affichage impossible :", e);
      setFailed(true);
    };
    (async () => {
      try {
        // Début (objets d'ouverture + première page) et fin du fichier partent ensemble,
        // en même temps que PDF.js. Arrivée directe sur la page : le script en ligne
        // les a déjà lancés avant même le chargement de ce code.
        const signal = controller.signal;
        const lean = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
        const boot = window.__afxCatalogBoot?.id === catalogId ? window.__afxCatalogBoot : null;
        delete window.__afxCatalogBoot;
        const parts =
          boot?.parts ??
          catalogBootRanges(fileSize, lean).map(([begin, end]) => openCatalogPart(fileUrl, begin, end, signal));
        const exact = (begin: number, end: number) => fetchRange(fileUrl, begin, end, signal).then((r) => r.data);
        const makeLoader = (total: number) =>
          createChunkLoader(
            (begin, end) => catalogPartFeed(openCatalogPart(fileUrl, begin, end, signal)),
            exact,
            total,
            lean ? 0 : CATALOG_READ_AHEAD,
            () => signal.aborted,
          );

        const opening = (async () => {
          try {
            // Les en-têtes de la première réponse donnent la taille réelle du fichier
            const total = await catalogPartTotal(parts[0]);
            const loader = makeLoader(total);
            for (const part of parts) loader.adopt(part.begin, part.end, catalogPartFeed(part));
            return { total, loader, head: await loader.take(0) };
          } catch (e) {
            if (signal.aborted) throw e;
            // Premier flux en échec : premier bloc redemandé seul, avec nouvelles tentatives
            const first = await fetchRange(fileUrl, 0, RANGE_CHUNK_SIZE, signal);
            const loader = makeLoader(first.total);
            loader.prefetch(catalogBootRanges(first.total, lean));
            return { total: first.total, loader, head: first.data };
          }
        })();
        const [pdfjs, { total, loader, head }] = await Promise.all([loadPdfjs(), opening]);
        if (signal.aborted) return;
        pdfjs.GlobalWorkerOptions.workerSrc = `${pdfAssets}/pdf.worker.min.mjs`;

        // Lecture à la demande : PDF.js réclame les blocs dont il a besoin ; ils sont
        // le plus souvent déjà là (avec reprise automatique si le réseau décroche).
        const transport = new pdfjs.PDFDataRangeTransport(total, head, head.length >= total);
        transport.requestDataRange = (begin, end) => {
          loader.read(begin, end).then((data) => {
            // Catalogue refermé entre-temps : PDF.js n'attend plus cette plage
            if (!signal.aborted) transport.onDataRange(begin, data);
          }, fail);
        };
        task = pdfjs.getDocument({
          range: transport,
          disableAutoFetch: true,
          disableStream: true,
          rangeChunkSize: RANGE_CHUNK_SIZE,
          cMapUrl: `${pdfAssets}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${pdfAssets}/standard_fonts/`,
        });
        const loaded = await task.promise;
        const first = await loaded.getPage(1);
        if (controller.signal.aborted) return;
        const viewport = first.getViewport({ scale: 1 });
        setFirstRatio(viewport.height / viewport.width);
        setDoc(loaded);
      } catch (e) {
        fail(e);
      }
    })();
    return () => {
      controller.abort();
      void task?.destroy();
    };
  }, [fileUrl, catalogId, fileSize, pdfAssets]);

  // Largeur disponible dans la zone de lecture
  useEffect(() => {
    if (!scroller) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => setAvailable(scroller.clientWidth);
    measure();
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    });
    observer.observe(scroller);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [scroller]);

  const gutter = available < 640 ? 8 : 24;
  const fitWidth = Math.max(
    0,
    Math.min(available - gutter * 2, firstRatio < 1 ? MAX_FIT_LANDSCAPE : MAX_FIT_PORTRAIT),
  );
  const zoom = ZOOM_LEVELS[zoomIdx];
  const pageWidth = Math.round(fitWidth * zoom);

  function changeZoom(step: number) {
    const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, zoomIdx + step));
    if (next === zoomIdx) return;
    if (scroller && scroller.scrollHeight > 0) zoomAnchor.current = scroller.scrollTop / scroller.scrollHeight;
    setZoomIdx(next);
  }

  // Après un zoom : on reste sur la même zone du catalogue, centrée horizontalement
  useLayoutEffect(() => {
    if (!scroller || zoomAnchor.current === null) return;
    scroller.scrollTop = zoomAnchor.current * scroller.scrollHeight;
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
    zoomAnchor.current = null;
  }, [zoomIdx, scroller]);

  const handleCenter = useCallback((page: number) => setCurrent(page), []);

  // Lien « voir dans le catalogue » : on se place sur la page, repère centré à l'écran
  useEffect(() => {
    if (!focus || !doc || !scroller || pageWidth <= 0 || focusDone.current) return;
    const holder = document.getElementById(`afx-page-${focus.page}`);
    if (!holder) return;
    focusDone.current = true;
    const offset = focus.y != null ? focus.y * holder.offsetHeight - scroller.clientHeight / 2 : -12;
    scroller.scrollTop = Math.max(0, holder.offsetTop + offset);
  }, [focus, doc, scroller, pageWidth]);

  const handlePick = useCallback((page: number, x: number, y: number, canvas: HTMLCanvasElement) => {
    const thumb = captureThumb(canvas, x, y);
    if (!thumb) return;
    setPick({ page, x, y, thumb });
    setQuantity("1");
    setNote("");
    setCartFull(false);
  }, []);

  function addPickToCart() {
    if (!pick) return;
    const added = cart.add({
      catalogId,
      catalogTitle: title,
      page: pick.page,
      x: pick.x,
      y: pick.y,
      quantity: Math.max(1, Math.min(100000, Math.round(Number(quantity)) || 1)),
      note: note.trim().slice(0, 200),
      thumb: pick.thumb,
    });
    if (!added) {
      setCartFull(true);
      return;
    }
    setPick(null);
    dismissHint();
  }

  const cartCount = cart.items.length;
  // Repères affichés sur les pages : articles déjà au panier, sélection en cours, lien équipe
  const marksByPage = useMemo(() => {
    const map = new Map<number, Mark[]>();
    const push = (page: number, mark: Mark) => map.set(page, [...(map.get(page) ?? []), mark]);
    for (const item of cart.items) {
      if (item.catalogId === catalogId) push(item.page, { x: item.x, y: item.y, kind: "cart" });
    }
    if (pick) push(pick.page, { x: pick.x, y: pick.y, kind: "pick" });
    if (focus && focus.x != null && focus.y != null) push(focus.page, { x: focus.x, y: focus.y, kind: "focus" });
    return map;
  }, [cart.items, catalogId, pick, focus]);

  const iconButton =
    "inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0b1513] text-white">
      <header className="shrink-0 border-b border-white/10 bg-night">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-4 sm:px-5">
          <Link
            href="/catalogue"
            aria-label={t("pcat.viewer.back")}
            title={t("pcat.viewer.back")}
            className="inline-flex shrink-0 items-center gap-2 rounded-full pr-2 text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            <Logo variant="xs" tone="dark" priority className="hidden h-7 w-auto sm:block" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">{title}</h1>
          <a
            href={`${fileUrl}?download=1`}
            aria-label={t("pcat.viewer.download")}
            title={t("pcat.viewer.download")}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/15 px-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            <span className="hidden md:inline">{t("pcat.viewer.download")}</span>
          </a>
          {canOrder && (
            <Link
              href="/catalogue/panier"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-mint px-4 text-sm font-semibold text-[#0a0e0d] transition-colors hover:bg-mint-2"
            >
              <ShoppingBag className="h-4 w-4" />
              {t("pcat.viewer.cart")}
              {cartCount > 0 && (
                <span className="afx-num -mr-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0a0e0d] px-1.5 text-xs text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          )}
        </div>
        {canOrder && doc && !failed && !hintSeen && cartCount === 0 && !pick && (
          <div className="flex items-center gap-2 border-t border-white/10 bg-mint px-3 py-2 text-sm font-medium text-[#0a0e0d] sm:px-5">
            <span className="flex-1">{t("pcat.viewer.hint")}</span>
            <button
              type="button"
              onClick={dismissHint}
              aria-label={t("pcat.viewer.close")}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-black/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      <div ref={setScroller} tabIndex={0} className="relative flex-1 overflow-auto outline-none">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <FileText className="h-10 w-10 text-white/40" />
            <p className="max-w-sm text-sm text-white/70">{t("pcat.viewer.error")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-mint px-5 text-sm font-semibold text-[#0a0e0d] transition-colors hover:bg-mint-2"
              >
                <RotateCw className="h-4 w-4" />
                {t("pcat.viewer.retry")}
              </button>
              <a
                href={fileUrl}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                {t("pcat.viewer.open")}
              </a>
            </div>
          </div>
        ) : !doc ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-white/70">
            <Loader2 className="h-7 w-7 animate-spin text-mint" />
            {t("pcat.viewer.loading")}
          </div>
        ) : (
          <div className="w-max min-w-full pb-40 pt-3 sm:pt-5" style={{ paddingInline: gutter }}>
            <div className="mx-auto flex flex-col gap-2 sm:gap-4" style={{ width: pageWidth }}>
              {Array.from({ length: doc.numPages }, (_, i) => (
                <CatalogPage
                  key={i + 1}
                  doc={doc}
                  pageNumber={i + 1}
                  width={pageWidth}
                  fallbackRatio={firstRatio}
                  root={scroller}
                  onCenter={handleCenter}
                  onPick={canOrder ? handlePick : undefined}
                  marks={marksByPage.get(i + 1)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {doc && !failed && !pick && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex flex-col items-center gap-2 px-3">
          {canOrder && cartCount > 0 && (
            <Link
              href="/catalogue/panier"
              className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-mint px-6 text-[15px] font-semibold text-[#0a0e0d] shadow-brand-lg transition-colors hover:bg-mint-2"
            >
              <ShoppingBag className="h-5 w-5" />
              {t("pcat.viewer.viewCart")}
              <span className="afx-num inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#0a0e0d] px-1.5 text-xs text-white">
                {cartCount}
              </span>
            </Link>
          )}
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-night/95 px-2 py-1 shadow-brand-lg backdrop-blur">
            <button
              type="button"
              className={iconButton}
              onClick={() => changeZoom(-1)}
              disabled={zoomIdx === 0}
              aria-label={t("pcat.viewer.zoomOut")}
              title={t("pcat.viewer.zoomOut")}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="afx-num w-12 text-center text-xs text-white/80">{Math.round(zoom * 100)} %</span>
            <button
              type="button"
              className={iconButton}
              onClick={() => changeZoom(1)}
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              aria-label={t("pcat.viewer.zoomIn")}
              title={t("pcat.viewer.zoomIn")}
            >
              <Plus className="h-4 w-4" />
            </button>
            <span className="mx-1 h-5 w-px bg-white/15" />
            <span className="afx-num px-2 text-xs text-white/90" aria-live="polite">
              {t("pcat.viewer.page")} {current} / {doc.numPages}
            </span>
          </div>
        </div>
      )}

      {pick && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addPickToCart();
            }}
            className="w-full max-w-md space-y-3 rounded-t-2xl border border-b-0 border-white/10 bg-night p-4 shadow-brand-lg"
          >
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pick.thumb} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-white/10 object-cover" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t("pcat.viewer.pickTitle")}</div>
                <div className="text-xs text-white/60">
                  {t("pcat.viewer.page")} {pick.page}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(String(Math.max(1, (Math.round(Number(quantity)) || 1) - 1)))}
                    aria-label={t("pcat.viewer.less")}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 hover:bg-white/10"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100000}
                    step={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    aria-label={t("pcat.viewer.quantity")}
                    className="afx-num h-11 w-20 rounded-xl border border-white/20 bg-transparent text-center text-lg text-white outline-none focus:border-mint"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(String(Math.min(100000, (Math.round(Number(quantity)) || 0) + 1)))}
                    aria-label={t("pcat.viewer.more")}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 hover:bg-white/10"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <input
              type="text"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("pcat.viewer.note")}
              aria-label={t("pcat.viewer.note")}
              className="h-11 w-full rounded-xl border border-white/20 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-mint"
            />
            {cartFull && <p className="text-sm text-amber-300">{t("pcat.viewer.cartFull")}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPick(null)}
                className="h-12 rounded-full border border-white/20 px-5 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                {t("pcat.viewer.cancel")}
              </button>
              <button
                type="submit"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-mint px-5 text-[15px] font-semibold text-[#0a0e0d] transition-colors hover:bg-mint-2"
              >
                <ShoppingBag className="h-5 w-5" />
                {t("pcat.viewer.add")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function CatalogPage({
  doc,
  pageNumber,
  width,
  fallbackRatio,
  root,
  onCenter,
  onPick,
  marks,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  fallbackRatio: number;
  root: HTMLDivElement | null;
  onCenter: (page: number) => void;
  onPick?: (page: number, x: number, y: number, canvas: HTMLCanvasElement) => void;
  marks?: Mark[];
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const [near, setNear] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || !root) return;
    // « near » : la page est à moins d'un écran de la zone visible
    const nearObserver = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root,
      rootMargin: "100% 0px",
    });
    // Page qui traverse le milieu de l'écran = page courante
    const centerObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onCenter(pageNumber);
      },
      { root, rootMargin: "-50% 0px -50% 0px" },
    );
    nearObserver.observe(holder);
    centerObserver.observe(holder);
    return () => {
      nearObserver.disconnect();
      centerObserver.disconnect();
    };
  }, [root, pageNumber, onCenter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!near) {
      // Page éloignée : on libère sa mémoire
      canvas.width = 0;
      canvas.height = 0;
      setPainted(false);
      pageRef.current?.cleanup();
      return;
    }
    if (width <= 0) return;

    let cancelled = false;
    let task: RenderTask | null = null;
    let buffer: HTMLCanvasElement | null = null;
    // Petit délai : un défilement rapide ne déclenche pas le chargement des pages survolées
    const timer = setTimeout(async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        pageRef.current = page;
        const base = page.getViewport({ scale: 1 });
        setRatio(base.height / base.width);

        const cssScale = width / base.width;
        let density = Math.min(window.devicePixelRatio || 1, 3);
        const pixels = base.width * base.height * (cssScale * density) ** 2;
        if (pixels > MAX_CANVAS_PIXELS) density *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
        const viewport = page.getViewport({ scale: cssScale * density });

        // Dessin hors écran puis recopie : lors d'un zoom, l'ancienne image reste
        // affichée jusqu'à ce que la nouvelle soit prête.
        buffer = document.createElement("canvas");
        buffer.width = Math.floor(viewport.width);
        buffer.height = Math.floor(viewport.height);
        const context = buffer.getContext("2d", { alpha: false });
        if (!context) return;
        task = page.render({ canvasContext: context, viewport });
        await task.promise;
        if (cancelled) return;
        canvas.width = buffer.width;
        canvas.height = buffer.height;
        canvas.getContext("2d", { alpha: false })?.drawImage(buffer, 0, 0);
        setPainted(true);
      } catch (e) {
        if (!cancelled) console.error(`[catalogue] page ${pageNumber} :`, e);
      } finally {
        releaseBuffer();
      }
    }, 80);

    function releaseBuffer() {
      if (!buffer) return;
      buffer.width = 0;
      buffer.height = 0;
      buffer = null;
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
      releaseBuffer();
    };
  }, [doc, near, pageNumber, width]);

  // Toucher un article : position relative dans la page (un défilement ne déclenche pas de clic)
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const canvas = canvasRef.current;
    if (!onPick || !painted || !canvas) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    onPick(
      pageNumber,
      clamp01((e.clientX - rect.left) / rect.width),
      clamp01((e.clientY - rect.top) / rect.height),
      canvas,
    );
  }

  return (
    <div
      ref={holderRef}
      id={`afx-page-${pageNumber}`}
      onClick={handleClick}
      className={`relative overflow-hidden bg-white shadow-brand-lg ${onPick && painted ? "cursor-pointer" : ""}`}
      style={{ width, height: Math.round(width * (ratio ?? fallbackRatio)) }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {!painted && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <span className="afx-num text-sm text-black/30">{pageNumber}</span>
        </div>
      )}
      {marks?.map((mark, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }}
        >
          {mark.kind === "cart" ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-mint-3 text-white shadow-brand-md">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          ) : (
            <span className="relative flex h-10 w-10 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-mint/50" />
              <span className="h-10 w-10 rounded-full border-[3px] border-mint bg-mint/15 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]" />
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
