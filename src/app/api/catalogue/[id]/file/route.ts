import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCatalogSignedUrl } from "@/lib/supabase-storage";

/**
 * Ouvre le PDF d'un catalogue : redirection vers un lien signé temporaire.
 * Public pour les catalogues actifs ; les catalogues masqués restent
 * consultables par le staff / l'admin.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const catalog = await prisma.catalog.findUnique({
    where: { id },
    select: { filePath: true, active: true },
  });
  if (!catalog) return new NextResponse("Not found", { status: 404 });

  if (!catalog.active) {
    const session = await auth();
    const role = session?.user?.role;
    if (role !== "ADMIN" && role !== "STAFF") return new NextResponse("Not found", { status: 404 });
  }

  try {
    const url = await getCatalogSignedUrl(catalog.filePath, 600);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[catalogue/file]", e);
    return new NextResponse("Fichier indisponible", { status: 502 });
  }
}
