import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { saveFile } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const folderIdRaw = formData.get("folderId");
  const folderId = typeof folderIdRaw === "string" && folderIdRaw.length > 0 ? folderIdRaw : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (folderId) {
    const parent = await prisma.folder.findFirst({ where: { id: folderId, ownerId: session.userId, deletedAt: null } });
    if (!parent) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const diskName = await saveFile(buffer, file.name);

  const record = await prisma.file.create({
    data: {
      name: file.name,
      path: diskName,
      size: buffer.length,
      mimeType: file.type || "application/octet-stream",
      folderId,
      ownerId: session.userId,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
