import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyCatalogOrderSignature } from "@/lib/catalog-order-link";

/**
 * Photo de la zone touchée par le client pour une ligne de commande (panier).
 * Accès : équipe (staff / admin), client propriétaire de la commande, ou
 * porteur du lien signé de la commande (`?k=`, demandes sans compte).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const item = await prisma.catalogOrderItem.findUnique({
    where: { id },
    select: { order: { select: { id: true, clientId: true } }, image: { select: { data: true } } },
  });
  if (!item?.image) return new NextResponse("Not found", { status: 404 });

  const signature = new URL(req.url).searchParams.get("k");
  if (!verifyCatalogOrderSignature(item.order.id, signature)) {
    const session = await auth();
    const role = session?.user?.role;
    const isTeam = role === "ADMIN" || role === "STAFF";
    const isOwner = !!session?.user && item.order.clientId === session.user.id;
    if (!isTeam && !isOwner) return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(item.image.data), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
