import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFileAccess, canEdit } from "@/lib/permissions";
import { saveFile } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import { getQuota } from "@/lib/quota";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getFileAccess(id, session.userId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await prisma.fileVersion.findMany({
    where: { fileId: id },
    orderBy: { versionNumber: "desc" },
  });

  return NextResponse.json({
    currentVersion: access.file.currentVersion,
    versions,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getFileAccess(id, session.userId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await request.formData();
  const upload = formData.get("file");
  if (!(upload instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const file = access.file;
  const buffer = Buffer.from(await upload.arrayBuffer());

  const { usedBytes, quotaBytes } = await getQuota(file.ownerId);
  if (usedBytes + buffer.length > quotaBytes) {
    return NextResponse.json({ error: "Storage quota exceeded" }, { status: 413 });
  }

  const diskName = await saveFile(buffer, upload.name);

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
        path: diskName,
        size: buffer.length,
        mimeType: upload.type || "application/octet-stream",
        currentVersion: file.currentVersion + 1,
      },
    }),
  ]);

  await logActivity({
    ownerId: file.ownerId,
    actorId: session.userId,
    action: "new_version",
    targetType: "file",
    targetName: file.name,
  });

  return NextResponse.json(updated);
}
