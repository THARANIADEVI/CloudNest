import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { ownerId: session.userId, deletedAt: { not: null } },
      include: { parent: true },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.file.findMany({
      where: { ownerId: session.userId, deletedAt: { not: null } },
      include: { folder: true },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  const topFolders = folders.filter((f) => !f.parent || !f.parent.deletedAt);
  const topFiles = files.filter((f) => !f.folder || !f.folder.deletedAt);

  return NextResponse.json({ folders: topFolders, files: topFiles });
}
