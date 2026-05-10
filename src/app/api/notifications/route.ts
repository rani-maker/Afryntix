import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [], unread: 0 }, { status: 401 });
  }

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id, channel: "IN_APP" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        body: true,
        link: true,
        readAt: true,
        createdAt: true,
        template: true,
      },
    }),
    prisma.notification.count({
      where: { userId: session.user.id, channel: "IN_APP", readAt: null },
    }),
  ]);

  return NextResponse.json({ items, unread });
}
