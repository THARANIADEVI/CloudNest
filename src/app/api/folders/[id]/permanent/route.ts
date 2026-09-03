import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { collectFolderIds } from "@/lib/folders";
import { deleteFile } from "@/lib/storage";

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
    select: { path: true },
  });

  await prisma.folder.delete({ where: { id } });
  await Promise.all(files.map((f) => deleteFile(f.path)));

  return NextResponse.json({ ok: true });
}
