"use client";
import { useCallback, useSyncExternalStore } from "react";
import { CART_MAX_ITEMS } from "@/lib/catalog-labels";

/**
 * Panier des catalogues : articles choisis en touchant une page dans la
 * visionneuse. Gardé dans le navigateur (localStorage) — il survit à la
 * navigation entre catalogues et ne demande pas de compte.
 */
export type CartItem = {
  key: string;
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

/** Demande déjà envoyée depuis cet appareil (pour la retrouver sans compte). */
export type SentRequest = { reference: string; url: string; sentAt: string };

const CART_KEY = "afryntix-catalog-cart-v1";
const SENT_KEY = "afryntix-catalog-requests-v1";
const SENT_MAX = 10;

function isCartItem(v: unknown): v is CartItem {
  if (!v || typeof v !== "object") return false;
  const i = v as Record<string, unknown>;
  return (
    typeof i.key === "string" &&
    typeof i.catalogId === "string" &&
    typeof i.catalogTitle === "string" &&
    typeof i.page === "number" &&
    typeof i.x === "number" &&
    typeof i.y === "number" &&
    typeof i.quantity === "number" &&
    typeof i.note === "string" &&
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

export function useCatalogCart() {
  const items = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);

  /** Ajoute un article ; false si le panier est plein. */
  const add = useCallback((item: Omit<CartItem, "key">): boolean => {
    const current = cartStore.getSnapshot();
    if (current.length >= CART_MAX_ITEMS) return false;
    const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return cartStore.write([...current, { ...item, key }]);
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

  return { items, add, update, remove, clear };
}

export function useSentRequests() {
  const requests = useSyncExternalStore(sentStore.subscribe, sentStore.getSnapshot, sentStore.getServerSnapshot);
  const remember = useCallback((request: SentRequest) => {
    sentStore.write([request, ...sentStore.getSnapshot()].slice(0, SENT_MAX));
  }, []);
  return { requests, remember };
}
