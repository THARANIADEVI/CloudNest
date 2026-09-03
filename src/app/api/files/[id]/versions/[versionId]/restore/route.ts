import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFileAccess, canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionId } = await params;
  const access = await getFileAccess(id, session.userId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId: id } });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = access.file;

  const [, updated] = await prisma.$transaction([
    prisma.fileVersion.create({
      data: {
        fileId: id,
        path: file.path,
        size: file.size,
        mimeType: file.mimeType,
        versionNumber: file.currentVersion,
        createdById: session.userId,
      },
    }),
    prisma.file.update({
      where: { id },
      data: {
        path: version.path,
        size: version.size,
        mimeType: version.mimeType,
        currentVersion: file.currentVersion + 1,
      },
    }),
  ]);

  await logActivity({
    ownerId: file.ownerId,
    actorId: session.userId,
    action: "restore_version",
    targetType: "file",
    targetName: file.name,
  });

  return NextResponse.json(updated);
}
