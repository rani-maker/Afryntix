import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadCatalogObject } from "@/lib/supabase-storage";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Sert l'image de couverture d'un catalogue depuis le bucket privé
 * (proxy same-origin : compatible avec la CSP `img-src 'self'`).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const catalog = await prisma.catalog.findUnique({ where: { id }, select: { coverPath: true } });
  if (!catalog?.coverPath) return new NextResponse("Not found", { status: 404 });

  try {
    const blob = await downloadCatalogObject(catalog.coverPath);
    const ext = catalog.coverPath.split(".").pop() ?? "";
    return new NextResponse(blob.stream(), {
      status: 200,
      headers: {
        "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
        "Content-Length": String(blob.size),
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[catalogue/cover]", e);
    return new NextResponse("Not found", { status: 404 });
  }
}
