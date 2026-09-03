import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { collectFolderIds } from "@/lib/folders";
import { logActivity } from "@/lib/activity";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folder = await prisma.folder.findFirst({ where: { id, ownerId: session.userId } });
  if (!folder || !folder.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const folderIds = await collectFolderIds(session.userId, id);

  await prisma.$transaction([
    prisma.folder.updateMany({
      where: { ownerId: session.userId, id: { in: folderIds } },
      data: { deletedAt: null },
    }),
    prisma.file.updateMany({
      where: { ownerId: session.userId, folderId: { in: folderIds } },
      data: { deletedAt: null },
    }),
  ]);

  await logActivity({
    ownerId: session.userId,
    actorId: session.userId,
    action: "restore_folder",
    targetType: "folder",
    targetName: folder.name,
  });

  return NextResponse.json({ ok: true });
}
