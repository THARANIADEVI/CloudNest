import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { collectFolderIds } from "@/lib/folders";
import { deleteFile } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folder = await prisma.folder.findFirst({ where: { id, ownerId: session.userId } });
  if (!folder || !folder.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const folderIds = await collectFolderIds(session.userId, id);
  const files = await prisma.file.findMany({
    where: { ownerId: session.userId, folderId: { in: folderIds } },
    select: { id: true, path: true },
  });
  const versions = await prisma.fileVersion.findMany({
    where: { fileId: { in: files.map((f) => f.id) } },
    select: { path: true },
  });

  await prisma.folder.delete({ where: { id } });
  await Promise.all([...files.map((f) => deleteFile(f.path)), ...versions.map((v) => deleteFile(v.path))]);

  await logActivity({
    ownerId: session.userId,
    actorId: session.userId,
    action: "delete_folder_forever",
    targetType: "folder",
    targetName: folder.name,
  });

  return NextResponse.json({ ok: true });
}
