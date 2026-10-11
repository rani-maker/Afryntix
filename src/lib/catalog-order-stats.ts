import { prisma } from "@/lib/prisma";
import {
  CATALOG_CATEGORIES,
  CATALOG_ORDER_ACTIVE_STATUSES,
  CATALOG_ORDER_STATUSES,
  CATALOG_ORDER_VALIDATED_STATUSES,
  type CatalogCategoryKey,
  type CatalogOrderStatusKey,
} from "@/lib/catalog-labels";

const MONTHS = 6;

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * Statistiques des commandes catalogue (page /admin/statistics).
 * - « validée » = devis accepté et commande lancée (CONFIRMED → DELIVERED), hors annulations ;
 * - le taux d'acceptation porte sur les devis réellement envoyés au client (quotedAt).
 */
export async function getCatalogOrderStats(now = new Date()) {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1));
  const validated = [...CATALOG_ORDER_VALIDATED_STATUSES];
  const notCancelled = { order: { status: { not: "CANCELLED" as const } } };

  const [byStatus, guests, quotesSent, quotesAccepted, validatedAgg, recent, quoteDelays, lines, linesByCatalog] =
    await Promise.all([
      prisma.catalogOrder.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.catalogOrder.count({ where: { clientId: null } }),
      prisma.catalogOrder.count({ where: { quotedAt: { not: null } } }),
      prisma.catalogOrder.count({
        where: { quotedAt: { not: null }, OR: [{ acceptedAt: { not: null } }, { status: { in: validated } }] },
      }),
      prisma.catalogOrder.aggregate({
        where: { status: { in: validated }, totalAmount: { not: null } },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.catalogOrder.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, status: true, totalAmount: true },
      }),
      prisma.catalogOrder.findMany({
        where: { quotedAt: { not: null } },
        select: { createdAt: true, quotedAt: true },
        orderBy: { quotedAt: "desc" },
        take: 200,
      }),
      prisma.catalogOrderItem.findMany({
        where: notCancelled,
        select: { orderId: true, category: true, quantity: true },
      }),
      prisma.catalogOrderItem.groupBy({
        by: ["catalogTitle"],
        where: notCancelled,
        _count: { _all: true },
        _sum: { quantity: true },
        orderBy: { _count: { catalogTitle: "desc" } },
        take: 5,
      }),
    ]);

  const count = (s: CatalogOrderStatusKey) => byStatus.find((g) => g.status === s)?._count._all ?? 0;
  const total = byStatus.reduce((n, g) => n + g._count._all, 0);
  const inProgress = CATALOG_ORDER_ACTIVE_STATUSES.reduce((n, s) => n + count(s), 0);
  const validatedAmount = validatedAgg._sum.totalAmount ?? 0;
  const validatedCount = validatedAgg._count._all;

  // Délai d'établissement du devis, sur les 200 derniers devis envoyés
  const delays = quoteDelays.map((o) => (o.quotedAt!.getTime() - o.createdAt.getTime()) / 36e5).filter((h) => h >= 0);
  const avgQuoteHours = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null;

  // 6 derniers mois : commandes reçues, dont validées, et montant validé
  const months = new Map<string, { received: number; validated: number; amount: number }>();
  for (let i = 0; i < MONTHS; i++) {
    months.set(monthKey(new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1))), {
      received: 0,
      validated: 0,
      amount: 0,
    });
  }
  for (const o of recent) {
    const m = months.get(monthKey(o.createdAt));
    if (!m) continue;
    m.received += 1;
    if ((validated as string[]).includes(o.status)) {
      m.validated += 1;
      m.amount += o.totalAmount ?? 0;
    }
  }

  // Par catégorie : commandes distinctes, lignes et quantités demandées
  const categories = new Map<CatalogCategoryKey, { orders: Set<string>; lines: number; quantity: number }>();
  for (const l of lines) {
    const c = categories.get(l.category) ?? { orders: new Set<string>(), lines: 0, quantity: 0 };
    c.orders.add(l.orderId);
    c.lines += 1;
    c.quantity += l.quantity;
    categories.set(l.category, c);
  }

  return {
    total,
    inProgress,
    guests,
    toQuote: count("PENDING"),
    awaitingAnswer: count("QUOTED"),
    quotesSent,
    quotesAccepted,
    acceptanceRate: quotesSent > 0 ? (quotesAccepted / quotesSent) * 100 : null,
    validatedCount,
    validatedAmount,
    averageBasket: validatedCount > 0 ? validatedAmount / validatedCount : null,
    avgQuoteHours,
    byStatus: CATALOG_ORDER_STATUSES.map((status) => ({ status, count: count(status) })),
    monthly: [...months.entries()].map(([key, v]) => {
      const [y, m] = key.split("-");
      return {
        month: new Date(Number(y), Number(m) - 1, 1).toLocaleString("fr-FR", { month: "short", year: "2-digit" }),
        ...v,
      };
    }),
    byCategory: CATALOG_CATEGORIES.map((category) => {
      const c = categories.get(category);
      return { category, orders: c?.orders.size ?? 0, lines: c?.lines ?? 0, quantity: c?.quantity ?? 0 };
    }),
    topCatalogs: linesByCatalog.map((g) => ({
      title: g.catalogTitle,
      lines: g._count._all,
      quantity: g._sum.quantity ?? 0,
    })),
  };
}

export type CatalogOrderStats = Awaited<ReturnType<typeof getCatalogOrderStats>>;
