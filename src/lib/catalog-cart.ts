"use client";
import { useCallback, useSyncExternalStore } from "react";
import { CART_MAX_ITEMS } from "@/lib/catalog-labels";

/**
 * Panier des catalogues, gardé dans le navigateur (localStorage) : il survit à la
 * navigation entre catalogues et ne demande pas de compte. Deux sortes de lignes :
 * un article touché sur une page de catalogue PDF (sans prix, chiffré dans le devis)
 * ou un article à prix affichés (/catalogue/produits).
 */
export type CartPageItem = {
  key: string;
  kind?: undefined;
  catalogId: string;
  catalogTitle: string;
  page: number;
  // Position du toucher sur la page (0 → 1)
  x: number;
  y: number;
  quantity: number;
  note: string;
  // Photo de la zone touchée (data URL JPEG)
  thumb: string;
};

/**
 * Article à prix affichés : seule la référence est gardée, le prix est relu à
 * l'affichage (la page du panier retire une référence qui n'existe plus).
 */
export type CartProductItem = {
  key: string;
  kind: "product";
  ref: string;
  quantity: number;
  note: string;
};

export type CartItem = CartPageItem | CartProductItem;

export const CART_MAX_QUANTITY = 100000;

/** Demande déjà envoyée depuis cet appareil (pour la retrouver sans compte). */
export type SentRequest = { reference: string; url: string; sentAt: string };

const CART_KEY = "afryntix-catalog-cart-v1";
const SENT_KEY = "afryntix-catalog-requests-v1";
const SENT_MAX = 10;

function isCartItem(v: unknown): v is CartItem {
  if (!v || typeof v !== "object") return false;
  const i = v as Record<string, unknown>;
  if (typeof i.key !== "string" || typeof i.quantity !== "number" || typeof i.note !== "string") return false;
  if (i.kind === "product") return typeof i.ref === "string";
  return (
    i.kind === undefined &&
    typeof i.catalogId === "string" &&
    typeof i.catalogTitle === "string" &&
    typeof i.page === "number" &&
    typeof i.x === "number" &&
    typeof i.y === "number" &&
    typeof i.thumb === "string"
  );
}

function createStore<T>(storageKey: string, parse: (raw: unknown) => T[]) {
  const EMPTY: T[] = [];
  let cache: T[] | null = null;
  const listeners = new Set<() => void>();

  const read = (): T[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? parse(JSON.parse(raw)) : EMPTY;
    } catch {
      return EMPTY;
    }
  };

  return {
    getSnapshot: (): T[] => (cache ??= read()),
    getServerSnapshot: (): T[] => EMPTY,
    subscribe(listener: () => void) {
      listeners.add(listener);
      // Autre onglet (ex. catalogue ouvert à côté du panier)
      const onStorage = (e: StorageEvent) => {
        if (e.key !== storageKey) return;
        cache = read();
        listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    /** false si le navigateur refuse l'écriture (stockage plein ou désactivé). */
    write(next: T[]): boolean {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        return false;
      }
      cache = next;
      listeners.forEach((l) => l());
      return true;
    },
  };
}

const cartStore = createStore<CartItem>(CART_KEY, (raw) => (Array.isArray(raw) ? raw.filter(isCartItem) : []));
const sentStore = createStore<SentRequest>(SENT_KEY, (raw) =>
  Array.isArray(raw)
    ? raw.filter(
        (r): r is SentRequest =>
          !!r && typeof r.reference === "string" && typeof r.url === "string" && typeof r.sentAt === "string",
      )
    : [],
);

const newKey = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function useCatalogCart() {
  const items = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);

  /** Ajoute un article touché sur une page ; false si le panier est plein. */
  const add = useCallback((item: Omit<CartPageItem, "key" | "kind">): boolean => {
    const current = cartStore.getSnapshot();
    if (current.length >= CART_MAX_ITEMS) return false;
    return cartStore.write([...current, { ...item, key: newKey() }]);
  }, []);

  /** Ajoute un article à prix affichés (les quantités d'une même référence se cumulent) ; false si le panier est plein. */
  const addProduct = useCallback((ref: string, quantity: number): boolean => {
    const current = cartStore.getSnapshot();
    const existing = current.find((i) => i.kind === "product" && i.ref === ref);
    if (existing) {
      const next = Math.min(CART_MAX_QUANTITY, existing.quantity + quantity);
      return cartStore.write(current.map((i) => (i === existing ? { ...i, quantity: next } : i)));
    }
    if (current.length >= CART_MAX_ITEMS) return false;
    return cartStore.write([...current, { key: newKey(), kind: "product", ref, quantity, note: "" }]);
  }, []);

  const update = useCallback((key: string, patch: Partial<Pick<CartItem, "quantity" | "note">>) => {
    cartStore.write(cartStore.getSnapshot().map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }, []);

  const remove = useCallback((key: string) => {
    cartStore.write(cartStore.getSnapshot().filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => {
    cartStore.write([]);
  }, []);

  return { items, add, addProduct, update, remove, clear };
}

export function useSentRequests() {
  const requests = useSyncExternalStore(sentStore.subscribe, sentStore.getSnapshot, sentStore.getServerSnapshot);
  const remember = useCallback((request: SentRequest) => {
    sentStore.write([request, ...sentStore.getSnapshot()].slice(0, SENT_MAX));
  }, []);
  return { requests, remember };
}
