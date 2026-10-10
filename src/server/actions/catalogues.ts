"use server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/auth";
import { notifyInApp } from "@/lib/notifications";
import { sendEmail, emailCatalogQuote, emailCatalogOrderTeam, TEAM_EMAIL } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { generateReference, formatXOF, getAppUrl } from "@/lib/utils";
import {
  CATALOG_CATEGORIES,
  CATALOG_ORDER_STATUS_LABELS,
  CATALOG_STAFF_STATUSES,
} from "@/lib/catalog-labels";
import {
  CATALOG_COVER_MAX_BYTES,
  CATALOG_COVER_MIME,
  CATALOG_PDF_MAX_BYTES,
  createCatalogUploadUrl,
  deleteCatalogObjects,
  getCatalogSignedUrl,
} from "@/lib/supabase-storage";

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

const zodError = (e: z.ZodError) => e.issues.map((i) => i.message).join(", ");

// Chemins générés côté serveur uniquement (voir requestCatalogUpload)
const PDF_PATH_RE = /^pdf\/[a-f0-9]{24}\.pdf$/;
const COVER_PATH_RE = /^covers\/[a-f0-9]{24}\.(jpg|png|webp)$/;

function revalidateCatalogs() {
  revalidatePath("/catalogue");
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/catalogue/order");
  revalidatePath("/admin/catalogues");
}

function revalidateOrders(id?: string) {
  revalidatePath("/dashboard/orders");
  revalidatePath("/staff/orders");
  revalidatePath("/admin/orders");
  if (id) revalidatePath(`/staff/orders/${id}`);
}

// =============================================================
// Catalogues (ADMIN)
// =============================================================

const UploadRequestSchema = z.object({
  kind: z.enum(["pdf", "cover"]),
  mimeType: z.string().max(100),
  size: z.number().int().positive(),
});

/**
 * Prépare un upload direct navigateur → Supabase et renvoie le lien signé
 * ainsi que le chemin de l'objet à repasser à `createCatalog` / `updateCatalog`.
 */
export async function requestCatalogUpload(
  input: unknown,
): Promise<Result<{ signedUrl: string; path: string }>> {
  await requireRole("ADMIN");
  const parsed = UploadRequestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodError(parsed.error) };
  const { kind, mimeType, size } = parsed.data;

  let path: string;
  const id = randomBytes(12).toString("hex");
  if (kind === "pdf") {
    if (mimeType !== "application/pdf") return { success: false, error: "Le catalogue doit être un fichier PDF." };
    if (size > CATALOG_PDF_MAX_BYTES) return { success: false, error: "PDF trop volumineux (max 50 Mo)." };
    path = `pdf/${id}.pdf`;
  } else {
    if (!CATALOG_COVER_MIME.includes(mimeType)) {
      return { success: false, error: "Couverture : image JPG, PNG ou WebP uniquement." };
    }
    if (size > CATALOG_COVER_MAX_BYTES) return { success: false, error: "Image trop volumineuse (max 5 Mo)." };
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    path = `covers/${id}.${ext}`;
  }

  try {
    const signedUrl = await createCatalogUploadUrl(path);
    return { success: true, data: { signedUrl, path } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Upload impossible." };
  }
}

const CatalogSchema = z.object({
  category: z.enum(CATALOG_CATEGORIES),
  title: z.string().trim().min(2, "Titre trop court").max(160),
  description: z.string().trim().max(500).optional(),
  filePath: z.string().regex(PDF_PATH_RE, "Fichier PDF invalide"),
  fileName: z.string().max(200),
  fileSize: z.number().int().positive().optional(),
  coverPath: z.string().regex(COVER_PATH_RE, "Image de couverture invalide").optional(),
});

export async function createCatalog(input: unknown): Promise<Result<{ id: string }>> {
  const session = await requireRole("ADMIN");
  const parsed = CatalogSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodError(parsed.error) };
  const d = parsed.data;

  // Vérifie que le PDF a bien été déposé dans le bucket
  try {
    await getCatalogSignedUrl(d.filePath, 60);
  } catch {
    return { success: false, error: "Le fichier PDF n'a pas été reçu. Réessayez l'upload." };
  }

  const last = await prisma.catalog.findFirst({
    where: { category: d.category },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const row = await prisma.catalog.create({
    data: {
      category: d.category,
      title: d.title,
      description: d.description || null,
      filePath: d.filePath,
      fileName: d.fileName,
      fileSize: d.fileSize,
      coverPath: d.coverPath ?? null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      uploadedById: session.user.id,
    },
  });

  revalidateCatalogs();
  return { success: true, data: { id: row.id } };
}

const CatalogUpdateSchema = z.object({
  id: z.string().min(1),
  category: z.enum(CATALOG_CATEGORIES).optional(),
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  coverPath: z.string().regex(COVER_PATH_RE).optional(),
});

export async function updateCatalog(input: unknown): Promise<Result> {
  await requireRole("ADMIN");
  const parsed = CatalogUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodError(parsed.error) };
  const { id, description, coverPath, ...rest } = parsed.data;

  const existing = await prisma.catalog.findUnique({ where: { id }, select: { coverPath: true } });
  if (!existing) return { success: false, error: "Catalogue introuvable." };

  await prisma.catalog.update({
    where: { id },
    data: {
      ...rest,
      ...(description !== undefined ? { description: description || null } : {}),
      ...(coverPath ? { coverPath } : {}),
    },
  });

  if (coverPath && existing.coverPath && existing.coverPath !== coverPath) {
    await deleteCatalogObjects([existing.coverPath]).catch(() => {});
  }

  revalidateCatalogs();
  return { success: true };
}

export async function deleteCatalog(id: string): Promise<Result> {
  await requireRole("ADMIN");
  const row = await prisma.catalog.findUnique({ where: { id }, select: { filePath: true, coverPath: true } });
  if (!row) return { success: false, error: "Catalogue introuvable." };

  // Les lignes de commande existantes gardent le titre du catalogue (copie).
  await prisma.catalog.delete({ where: { id } });
  await deleteCatalogObjects([row.filePath, ...(row.coverPath ? [row.coverPath] : [])]).catch((e) =>
    console.error("[deleteCatalog] fichiers non supprimés:", e),
  );

  revalidateCatalogs();
  return { success: true };
}

// =============================================================
// Bon de commande (CLIENT)
// Le client choisit ses articles sans prix : AFRYNTIX établit le devis.
// =============================================================

const OrderItemSchema = z.object({
  catalogId: z.string().min(1, "Choisissez un catalogue"),
  reference: z.string().trim().min(1, "Référence requise").max(80),
  designation: z.string().trim().min(2, "Désignation requise").max(200),
  page: z.string().trim().max(20).optional(),
  quantity: z.coerce.number().int().min(1, "Quantité minimale : 1").max(100000),
});

const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, "Ajoutez au moins un article").max(100),
  contactPhone: z.string().trim().max(40).optional(),
  deliveryCity: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

async function uniqueOrderReference(): Promise<string> {
  let reference = generateReference("CMD");
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.catalogOrder.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) break;
    reference = generateReference("CMD");
  }
  return reference;
}

/** Prévient toute l'équipe (staff + admin) dans la cloche de notifications. */
async function notifyTeam(args: { template: string; title: string; body: string; orderId: string }) {
  const team = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] }, active: true },
    select: { id: true },
  });
  await Promise.all(
    team.map((u) =>
      notifyInApp({
        userId: u.id,
        template: args.template,
        title: args.title,
        body: args.body,
        link: `/staff/orders/${args.orderId}`,
      }),
    ),
  );
}

/** Email à la boîte de l'équipe (TEAM_EMAIL). Ne bloque jamais l'action en cas d'échec. */
async function emailTeam(
  orderId: string,
  template: string,
  args: Omit<Parameters<typeof emailCatalogOrderTeam>[0], "link">,
) {
  try {
    const mail = emailCatalogOrderTeam({ ...args, link: `${getAppUrl()}/staff/orders/${orderId}` });
    await sendEmail({ to: TEAM_EMAIL, subject: mail.subject, html: mail.html, template });
  } catch (e) {
    console.error("[catalogues] email équipe non envoyé:", e);
  }
}

export async function createCatalogOrder(input: unknown): Promise<Result<{ id: string; reference: string }>> {
  const session = await requireRole("CLIENT");
  const parsed = CreateOrderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodError(parsed.error) };
  const d = parsed.data;

  const catalogs = await prisma.catalog.findMany({
    where: { id: { in: [...new Set(d.items.map((i) => i.catalogId))] }, active: true },
    select: { id: true, title: true, category: true },
  });
  const byId = new Map(catalogs.map((c) => [c.id, c]));
  if (d.items.some((i) => !byId.has(i.catalogId))) {
    return { success: false, error: "Un des catalogues sélectionnés n'est plus disponible." };
  }

  const order = await prisma.catalogOrder.create({
    data: {
      reference: await uniqueOrderReference(),
      clientId: session.user.id,
      contactPhone: d.contactPhone || null,
      deliveryCity: d.deliveryCity || null,
      notes: d.notes || null,
      items: {
        create: d.items.map((i) => {
          const cat = byId.get(i.catalogId)!;
          return {
            catalogId: cat.id,
            category: cat.category,
            catalogTitle: cat.title,
            reference: i.reference,
            designation: i.designation,
            page: i.page || null,
            quantity: i.quantity,
          };
        }),
      },
    },
  });

  await notifyInApp({
    userId: session.user.id,
    template: "catalog_order_created",
    title: "Bon de commande reçu",
    body: `Votre commande ${order.reference} a bien été reçue. Nous préparons votre devis.`,
    link: "/dashboard/orders",
  });
  await notifyTeam({
    template: "catalog_order_received",
    title: "Nouveau bon de commande",
    body: `${order.reference} — ${session.user.name} (${d.items.length} article${d.items.length > 1 ? "s" : ""}). Devis à établir.`,
    orderId: order.id,
  });
  await emailTeam(order.id, "catalog_order_received", {
    heading: "Nouveau bon de commande",
    reference: order.reference,
    clientName: session.user.name,
    clientEmail: session.user.email,
    clientPhone: d.contactPhone,
    deliveryCity: d.deliveryCity,
    notes: d.notes,
    items: d.items.map((i) => ({ ...i, catalogTitle: byId.get(i.catalogId)!.title })),
  });

  revalidateOrders();
  return { success: true, data: { id: order.id, reference: order.reference } };
}

/** Le client accepte le devis reçu : la commande est confirmée. */
export async function acceptCatalogQuote(id: string): Promise<Result> {
  const session = await requireRole("CLIENT");
  const order = await prisma.catalogOrder.findUnique({
    where: { id },
    select: { clientId: true, status: true, reference: true, totalAmount: true },
  });
  if (!order || order.clientId !== session.user.id) return { success: false, error: "Commande introuvable." };
  if (order.status !== "QUOTED" || order.totalAmount == null) {
    return { success: false, error: "Aucun devis en attente de validation pour cette commande." };
  }

  await prisma.catalogOrder.update({ where: { id }, data: { status: "CONFIRMED", acceptedAt: new Date() } });
  await notifyTeam({
    template: "catalog_quote_accepted",
    title: "Devis accepté",
    body: `${order.reference} — ${session.user.name} a accepté le devis (${formatXOF(order.totalAmount)}).`,
    orderId: id,
  });
  await emailTeam(id, "catalog_quote_accepted", {
    heading: "Devis accepté",
    reference: order.reference,
    clientName: session.user.name,
    clientEmail: session.user.email,
    totalAmount: order.totalAmount,
  });

  revalidateOrders(id);
  return { success: true };
}

/** Annulation par le client : possible avant le devis, ou pour refuser un devis. */
export async function cancelCatalogOrder(id: string): Promise<Result> {
  const session = await requireRole("CLIENT");
  const order = await prisma.catalogOrder.findUnique({
    where: { id },
    select: { clientId: true, status: true, reference: true },
  });
  if (!order || order.clientId !== session.user.id) return { success: false, error: "Commande introuvable." };
  if (order.status !== "PENDING" && order.status !== "QUOTED") {
    return { success: false, error: "Cette commande est déjà confirmée. Contactez AFRYNTIX pour l'annuler." };
  }

  await prisma.catalogOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  await notifyTeam({
    template: "catalog_order_cancelled",
    title: order.status === "QUOTED" ? "Devis refusé" : "Commande annulée",
    body: `${order.reference} — annulée par ${session.user.name}.`,
    orderId: id,
  });
  await emailTeam(id, "catalog_order_cancelled", {
    heading: order.status === "QUOTED" ? "Devis refusé par le client" : "Commande annulée par le client",
    reference: order.reference,
    clientName: session.user.name,
    clientEmail: session.user.email,
  });

  revalidateOrders(id);
  return { success: true };
}

// =============================================================
// Devis & suivi (STAFF + ADMIN)
// =============================================================

const optionalAmount = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().min(0, "Montant invalide").max(1_000_000_000).nullable(),
);

const QuoteSchema = z.object({
  id: z.string().min(1),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(100000),
        unitPrice: optionalAmount,
      }),
    )
    .min(1)
    .max(100),
  feesAmount: optionalAmount,
  staffNotes: z.string().trim().max(2000).optional(),
  send: z.boolean(),
});

/**
 * Enregistre le devis d'une commande (prix unitaires, frais annexes, remarque).
 * Avec `send: true`, tous les prix doivent être renseignés : le devis est
 * envoyé au client (in-app + email) et la commande passe en QUOTED.
 */
export async function saveCatalogQuote(input: unknown): Promise<Result> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = QuoteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodError(parsed.error) };
  const d = parsed.data;

  const order = await prisma.catalogOrder.findUnique({
    where: { id: d.id },
    include: {
      items: { select: { id: true, catalogTitle: true, reference: true, designation: true, page: true } },
      client: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!order) return { success: false, error: "Commande introuvable." };
  if (order.status !== "PENDING" && order.status !== "QUOTED") {
    return { success: false, error: "Le devis ne peut plus être modifié : la commande est déjà confirmée ou clôturée." };
  }

  const edits = new Map(d.items.map((i) => [i.id, i]));
  if (edits.size !== order.items.length || order.items.some((i) => !edits.has(i.id))) {
    return { success: false, error: "Les lignes du devis ne correspondent pas à la commande." };
  }

  const lines = d.items.map((i) => {
    const unitPrice = i.unitPrice == null ? null : Math.round(i.unitPrice);
    return { id: i.id, quantity: i.quantity, unitPrice, lineTotal: unitPrice == null ? null : unitPrice * i.quantity };
  });
  const complete = lines.every((l) => l.lineTotal != null);
  if (d.send && !complete) {
    return { success: false, error: "Renseignez le prix unitaire de chaque article avant d'envoyer le devis." };
  }
  const feesAmount = d.feesAmount == null ? null : Math.round(d.feesAmount);
  const totalAmount = complete ? lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0) + (feesAmount ?? 0) : null;

  await prisma.$transaction([
    ...lines.map((l) =>
      prisma.catalogOrderItem.update({
        where: { id: l.id },
        data: { quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal },
      }),
    ),
    prisma.catalogOrder.update({
      where: { id: order.id },
      data: {
        feesAmount,
        totalAmount,
        staffNotes: d.staffNotes || null,
        handledById: session.user.id,
        // Un devis déjà envoyé puis modifié sans renvoi repasse « à chiffrer »
        // pour que le client ne puisse pas accepter un devis en cours de révision.
        ...(d.send ? { status: "QUOTED" as const, quotedAt: new Date() } : { status: "PENDING" as const }),
      },
    }),
  ]);

  if (d.send && totalAmount != null) {
    await notifyInApp({
      userId: order.client.id,
      template: "catalog_quote_sent",
      title: "Votre devis est prêt",
      body: `Commande ${order.reference} : devis de ${formatXOF(totalAmount)}. Consultez-le et validez-le.`,
      link: "/dashboard/orders",
    });
    try {
      const mail = emailCatalogQuote({
        recipientName: order.client.name,
        reference: order.reference,
        totalAmount,
        link: `${getAppUrl()}/dashboard/orders`,
      });
      await sendEmail({
        to: order.client.email,
        subject: mail.subject,
        html: mail.html,
        template: "catalog_quote_sent",
        userId: order.client.id,
        replyTo: TEAM_EMAIL,
      });
    } catch (e) {
      console.error("[saveCatalogQuote] email non envoyé:", e);
    }
    // Copie du devis dans la boîte de l'équipe
    await emailTeam(order.id, "catalog_quote_copy", {
      heading: "Devis envoyé au client",
      reference: order.reference,
      clientName: order.client.name,
      clientEmail: order.client.email,
      clientPhone: order.contactPhone ?? order.client.phone,
      deliveryCity: order.deliveryCity,
      notes: d.staffNotes,
      items: order.items.map((i) => ({ ...i, ...lines.find((l) => l.id === i.id)! })),
      feesAmount,
      totalAmount,
    });
  }

  revalidateOrders(order.id);
  return { success: true };
}

const StatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(CATALOG_STAFF_STATUSES),
});

/** Suivi après devis : confirmation, préparation, expédition, livraison, annulation. */
export async function updateCatalogOrderStatus(input: unknown): Promise<Result> {
  const session = await requireRole("STAFF", "ADMIN");
  const parsed = StatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodError(parsed.error) };
  const { id, status } = parsed.data;

  const order = await prisma.catalogOrder.findUnique({
    where: { id },
    select: { clientId: true, status: true, reference: true, totalAmount: true },
  });
  if (!order) return { success: false, error: "Commande introuvable." };
  if (status === order.status) return { success: true };
  if (status !== "CANCELLED" && (order.status === "PENDING" || order.totalAmount == null)) {
    return { success: false, error: "Envoyez d'abord le devis au client." };
  }

  await prisma.catalogOrder.update({
    where: { id },
    data: {
      status,
      handledById: session.user.id,
      ...(status === "CONFIRMED" && order.status === "QUOTED" ? { acceptedAt: new Date() } : {}),
    },
  });
  await notifyInApp({
    userId: order.clientId,
    template: "catalog_order_updated",
    title: "Mise à jour de votre commande",
    body: `${order.reference} : ${CATALOG_ORDER_STATUS_LABELS[status]}.`,
    link: "/dashboard/orders",
  });

  revalidateOrders(id);
  return { success: true };
}
