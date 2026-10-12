"use server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyInApp } from "@/lib/notifications";
import { ipFromHeaders, rateLimit } from "@/lib/rate-limit";
import { formatXOF } from "@/lib/utils";
import { CART_MAX_ITEMS } from "@/lib/catalog-labels";
import { SHOP_CATALOG_TITLE, getShopProduct, shopProductName, shopTotals, type ShopProduct } from "@/lib/shop-products";
import { emailOrderTeam, notifyOrderTeam, orderParty, uniqueOrderReference } from "@/lib/catalog-orders";
import {
  buildCompanyWhatsAppUrl,
  getCatalogOrderPublicPath,
  verifyCatalogOrderSignature,
} from "@/lib/catalog-order-link";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const zodError = (e: z.ZodError) => e.issues.map((i) => i.message).join(", ");

// Photo de la zone touchée : petit JPEG produit par la visionneuse
const THUMB_MAX_BYTES = 150 * 1024;
const THUMB_PREFIX = "data:image/jpeg;base64,";

const quantity = z.coerce.number().int().min(1, "Quantité minimale : 1").max(100000);
const note = z.string().trim().max(200).optional();

// Article touché sur une page de catalogue PDF
const PageItemSchema = z.object({
  kind: z.literal("page"),
  catalogId: z.string().min(1).max(40),
  page: z.coerce.number().int().min(1).max(5000),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  quantity,
  note,
  thumb: z
    .string()
    .max(THUMB_PREFIX.length + Math.ceil((THUMB_MAX_BYTES * 4) / 3) + 4)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/, "Photo d'article invalide"),
});

// Article à prix affichés : le prix n'est jamais lu depuis le navigateur
const ProductItemSchema = z.object({
  kind: z.literal("product"),
  ref: z.string().min(1).max(20),
  quantity,
  note,
});

const CartItemSchema = z.discriminatedUnion("kind", [PageItemSchema, ProductItemSchema]);

const CartOrderSchema = z.object({
  items: z.array(CartItemSchema).min(1, "Votre panier est vide").max(CART_MAX_ITEMS),
  name: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  email: z.union([z.literal(""), z.string().trim().email("Adresse email invalide").max(160)]).optional(),
  deliveryCity: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
  // Champ piège invisible : un humain le laisse vide
  website: z.string().max(200).optional(),
});

function revalidateOrders(id: string) {
  revalidatePath("/dashboard/orders");
  revalidatePath("/staff/orders");
  revalidatePath("/admin/orders");
  revalidatePath(`/staff/orders/${id}`);
  revalidatePath(`/commande/${id}`);
}

/**
 * Envoie le panier comme demande de devis. Ouvert à tous : un client connecté
 * retrouve sa demande dans « Mes commandes » ; sans compte, on demande un nom
 * et un numéro WhatsApp et la demande se suit par lien signé.
 */
export async function createCartOrder(
  input: unknown,
): Promise<Result<{ reference: string; trackPath: string | null; whatsappUrl: string | null; hasAccount: boolean }>> {
  const session = await auth();
  const user = session?.user;
  if (user && user.role !== "CLIENT") {
    return { success: false, error: "Les commandes se passent avec un compte client (ou sans compte)." };
  }

  const parsed = CartOrderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodError(parsed.error) };
  const d = parsed.data;
  if (d.website) return { success: false, error: "Envoi impossible. Réessayez." };

  const limiterKey = user ? `cart-order:user:${user.id}` : `cart-order:ip:${ipFromHeaders(await headers())}`;
  const limit = rateLimit(limiterKey, 6, 10 * 60 * 1000);
  if (!limit.ok) {
    return { success: false, error: "Trop de demandes envoyées. Réessayez dans quelques minutes." };
  }

  const guestName = d.name ?? "";
  const phone = d.contactPhone ?? "";
  if (!user) {
    if (guestName.length < 2) return { success: false, error: "Indiquez votre nom." };
    if (phone.replace(/\D/g, "").length < 8) return { success: false, error: "Indiquez un numéro WhatsApp valide." };
  }

  const catalogIds = [...new Set(d.items.flatMap((i) => (i.kind === "page" ? [i.catalogId] : [])))];
  const catalogs = catalogIds.length
    ? await prisma.catalog.findMany({
        where: { id: { in: catalogIds }, active: true },
        select: { id: true, title: true, category: true },
      })
    : [];
  const byId = new Map(catalogs.map((c) => [c.id, c]));
  if (catalogIds.some((id) => !byId.has(id))) {
    return { success: false, error: "Un des catalogues de votre panier n'est plus disponible." };
  }

  // Une ligne par article, dans l'ordre du panier
  const lines: { data: Prisma.CatalogOrderItemCreateWithoutOrderInput; emailDesignation: string }[] = [];
  const priced: { product: ShopProduct; quantity: number }[] = [];
  for (const item of d.items) {
    if (item.kind === "product") {
      const product = getShopProduct(item.ref);
      if (!product) return { success: false, error: "Un des articles de votre panier n'est plus disponible." };
      const designation = shopProductName(product);
      priced.push({ product, quantity: item.quantity });
      lines.push({
        data: {
          category: product.family,
          catalogTitle: SHOP_CATALOG_TITLE,
          reference: product.ref,
          designation,
          quantity: item.quantity,
          // Prix affiché au moment de la demande : il pré-remplit le devis, que l'équipe vérifie avant envoi
          unitPrice: product.price,
          lineTotal: product.price * item.quantity,
          note: item.note || null,
        },
        emailDesignation: item.note ? `${designation} — ${item.note}` : designation,
      });
      continue;
    }
    const data = Buffer.from(item.thumb.slice(THUMB_PREFIX.length), "base64");
    const isJpeg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    if (!isJpeg || data.length > THUMB_MAX_BYTES) return { success: false, error: "Photo d'article invalide." };
    const cat = byId.get(item.catalogId)!;
    lines.push({
      data: {
        catalog: { connect: { id: cat.id } },
        category: cat.category,
        catalogTitle: cat.title,
        // La référence exacte est précisée par AFRYNTIX au moment du devis
        reference: "",
        designation: `Article page ${item.page}`,
        page: String(item.page),
        quantity: item.quantity,
        posX: item.x,
        posY: item.y,
        note: item.note || null,
        image: { create: { data } },
      },
      emailDesignation: item.note ? `Article page ${item.page} — ${item.note}` : `Article page ${item.page}`,
    });
  }
  // Fret + dédouanement des articles à prix affichés : pré-remplit les frais du devis
  const freight = shopTotals(priced).freight;

  const order = await prisma.catalogOrder.create({
    data: {
      reference: await uniqueOrderReference(),
      clientId: user?.id ?? null,
      guestName: user ? null : guestName,
      guestEmail: user ? null : d.email || null,
      contactPhone: phone || null,
      deliveryCity: d.deliveryCity || null,
      notes: d.notes || null,
      feesAmount: freight || null,
      items: { create: lines.map((l) => l.data) },
    },
  });

  const name = user?.name ?? guestName;
  if (user) {
    await notifyInApp({
      userId: user.id,
      template: "catalog_order_created",
      title: "Demande de devis reçue",
      body: `Votre demande ${order.reference} a bien été reçue. Nous préparons votre devis.`,
      link: "/dashboard/orders",
    });
  }
  await notifyOrderTeam({
    template: "catalog_order_received",
    title: "Nouvelle demande de devis",
    body: `${order.reference} — ${name}${user ? "" : " (sans compte)"} : ${d.items.length} article${d.items.length > 1 ? "s" : ""} choisi${d.items.length > 1 ? "s" : ""} dans le catalogue. ${
      priced.length === d.items.length
        ? "Devis pré-rempli aux prix affichés : à vérifier et envoyer."
        : "Devis à établir."
    }`,
    orderId: order.id,
  });
  await emailOrderTeam(order.id, "catalog_order_received", {
    heading: user ? "Nouvelle demande de devis" : "Nouvelle demande de devis (sans compte)",
    reference: order.reference,
    clientName: name,
    clientEmail: user?.email ?? d.email,
    clientPhone: phone,
    deliveryCity: d.deliveryCity,
    notes: d.notes,
    items: lines.map((l) => ({
      catalogTitle: l.data.catalogTitle,
      reference: l.data.reference,
      designation: l.emailDesignation,
      page: l.data.page ?? null,
      quantity: l.data.quantity,
    })),
  });

  revalidateOrders(order.id);
  return {
    success: true,
    data: {
      reference: order.reference,
      trackPath: user ? "/dashboard/orders" : getCatalogOrderPublicPath(order.id),
      whatsappUrl: buildCompanyWhatsAppUrl(order.reference),
      hasAccount: !!user,
    },
  };
}

// =============================================================
// Réponse au devis par lien signé (demandeur sans compte)
// =============================================================

async function loadOrderByLink(id: string, signature: string) {
  if (!verifyCatalogOrderSignature(id, signature)) return null;
  const limit = rateLimit(`order-link:${ipFromHeaders(await headers())}`, 20, 10 * 60 * 1000);
  if (!limit.ok) return null;
  return prisma.catalogOrder.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      reference: true,
      totalAmount: true,
      contactPhone: true,
      guestName: true,
      guestEmail: true,
      client: { select: { name: true, email: true, phone: true, whatsapp: true } },
    },
  });
}

/** Le demandeur accepte le devis depuis le lien reçu : la commande est confirmée. */
export async function acceptCatalogQuoteByLink(id: string, signature: string): Promise<Result> {
  const order = await loadOrderByLink(id, signature);
  if (!order) return { success: false, error: "Lien invalide ou expiré." };
  if (order.status !== "QUOTED" || order.totalAmount == null) {
    return { success: false, error: "Aucun devis en attente de validation pour cette commande." };
  }
  const party = orderParty(order);

  await prisma.catalogOrder.update({ where: { id }, data: { status: "CONFIRMED", acceptedAt: new Date() } });
  await notifyOrderTeam({
    template: "catalog_quote_accepted",
    title: "Devis accepté",
    body: `${order.reference} — ${party.name} a accepté le devis (${formatXOF(order.totalAmount)}).`,
    orderId: id,
  });
  await emailOrderTeam(id, "catalog_quote_accepted", {
    heading: "Devis accepté",
    reference: order.reference,
    clientName: party.name,
    clientEmail: party.email,
    clientPhone: party.phone,
    totalAmount: order.totalAmount,
  });

  revalidateOrders(id);
  return { success: true };
}

/** Annulation depuis le lien : possible avant le devis, ou pour refuser un devis. */
export async function cancelCatalogOrderByLink(id: string, signature: string): Promise<Result> {
  const order = await loadOrderByLink(id, signature);
  if (!order) return { success: false, error: "Lien invalide ou expiré." };
  if (order.status !== "PENDING" && order.status !== "QUOTED") {
    return { success: false, error: "Cette commande est déjà confirmée. Contactez AFRYNTIX pour l'annuler." };
  }
  const party = orderParty(order);

  await prisma.catalogOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  await notifyOrderTeam({
    template: "catalog_order_cancelled",
    title: order.status === "QUOTED" ? "Devis refusé" : "Demande annulée",
    body: `${order.reference} — annulée par ${party.name}.`,
    orderId: id,
  });
  await emailOrderTeam(id, "catalog_order_cancelled", {
    heading: order.status === "QUOTED" ? "Devis refusé par le client" : "Demande annulée par le client",
    reference: order.reference,
    clientName: party.name,
    clientEmail: party.email,
    clientPhone: party.phone,
  });

  revalidateOrders(id);
  return { success: true };
}
