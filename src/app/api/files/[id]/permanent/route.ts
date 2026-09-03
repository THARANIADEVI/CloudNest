import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { deleteFile } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const file = await prisma.file.findFirst({ where: { id, ownerId: session.userId } });
  if (!file || !file.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await prisma.fileVersion.findMany({ where: { fileId: id }, select: { path: true } });

  await prisma.file.delete({ where: { id } });
  await Promise.all([deleteFile(file.path), ...versions.map((v) => deleteFile(v.path))]);

  await logActivity({
    ownerId: file.ownerId,
    actorId: session.userId,
    action: "delete_forever",
    targetType: "file",
    targetName: file.name,
  });

  return NextResponse.json({ ok: true });
}
