import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const files = await prisma.file.findMany({
    where: { ownerId: session.userId, starred: true, deletedAt: null },
    include: { tags: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ files });
}
