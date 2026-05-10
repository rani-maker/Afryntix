import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let id: string | undefined;
  try {
    const body = (await req.json()) as { id?: string };
    id = body.id;
  } catch {
    // pas de body → mark all as read
  }

  const where = id
    ? { id, userId: session.user.id, channel: "IN_APP" as const }
    : { userId: session.user.id, channel: "IN_APP" as const, readAt: null };

  const result = await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true, count: result.count });
}
