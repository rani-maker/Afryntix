"use client";

import { Bell, Check, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string | null;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  template: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: NotificationItem[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await fetchData();
  }

  async function markOne(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // tant pis
    }
  }

  async function markAll() {
    if (unread === 0) return;
    setLoading(true);
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    setUnread(0);
    try {
      await fetch("/api/notifications/read", { method: "POST" });
    } catch {
      // tant pis
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-label="Notifications"
        title="Notifications"
        onClick={handleOpen}
        className={cn(
          "relative grid h-10 w-10 place-items-center rounded-full border transition-colors",
          open
            ? "border-[hsl(var(--dash-accent-border))] bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]"
            : "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text)] hover:border-[var(--dash-border-strong)] hover:bg-[var(--dash-surface-2)]",
        )}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-[hsl(var(--dash-accent))] px-1 text-[10px] font-bold text-white shadow-sm">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[92vw] rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-2xl shadow-black/40 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--dash-border)]">
            <div>
              <div className="text-[13px] font-semibold text-[var(--dash-text)]">Notifications</div>
              <div className="text-[11px] text-[var(--dash-text-muted)] mt-0.5">
                {unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est à jour"}
              </div>
            </div>
            <button
              type="button"
              onClick={markAll}
              disabled={unread === 0 || loading}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Tout marquer
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12px] text-[var(--dash-text-muted)]">
                Aucune notification pour l'instant.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--dash-border)]">
                {items.map((n) => {
                  const unreadDot = !n.readAt;
                  const Body = (
                    <div className="flex gap-3 px-4 py-3 hover:bg-[var(--dash-hover)] transition-colors">
                      <div className="pt-1.5">
                        <span
                          className={cn(
                            "block h-2 w-2 rounded-full",
                            unreadDot
                              ? "bg-[hsl(var(--dash-accent))]"
                              : "bg-transparent border border-[var(--dash-border)]",
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[13px] font-medium text-[var(--dash-text)] truncate">
                            {n.title || "Notification"}
                          </div>
                          <div className="text-[10px] text-[var(--dash-text-muted)] whitespace-nowrap pt-0.5">
                            {timeAgo(n.createdAt)}
                          </div>
                        </div>
                        <div className="text-[12px] text-[var(--dash-text-muted)] mt-0.5 line-clamp-2">
                          {n.body}
                        </div>
                      </div>
                      {unreadDot && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markOne(n.id);
                          }}
                          className="self-start mt-1 grid h-6 w-6 place-items-center rounded-md text-[var(--dash-text-muted)] hover:bg-[var(--dash-surface-2)] hover:text-[var(--dash-text)]"
                          title="Marquer comme lue"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => {
                            if (unreadDot) markOne(n.id);
                            setOpen(false);
                          }}
                          className="block"
                        >
                          {Body}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => unreadDot && markOne(n.id)}
                          className="w-full text-left"
                        >
                          {Body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
