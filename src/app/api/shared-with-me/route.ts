import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shares = await prisma.userShare.findMany({
    where: { sharedWithId: session.userId, file: { deletedAt: null } },
    include: { file: { include: { tags: true } } },
    orderBy: { createdAt: "desc" },
  });

  const files = shares.map((s) => ({ ...s.file, role: s.role }));

  return NextResponse.json({ files });
}
