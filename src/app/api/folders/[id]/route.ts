import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { collectFolderIds, isSameOrDescendant } from "@/lib/folders";
import { deleteFile } from "@/lib/storage";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  parentId: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folder = await prisma.folder.findFirst({ where: { id, ownerId: session.userId } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { name, parentId } = parsed.data;

  if (parentId !== undefined && parentId !== null) {
    if (parentId === id) {
      return NextResponse.json({ error: "Cannot move folder into itself" }, { status: 400 });
    }
    const target = await prisma.folder.findFirst({ where: { id: parentId, ownerId: session.userId } });
    if (!target) return NextResponse.json({ error: "Target folder not found" }, { status: 404 });
    if (await isSameOrDescendant(session.userId, id, parentId)) {
      return NextResponse.json({ error: "Cannot move folder into its own subfolder" }, { status: 400 });
    }
  }

  const updated = await prisma.folder.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folder = await prisma.folder.findFirst({ where: { id, ownerId: session.userId } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const folderIds = await collectFolderIds(session.userId, id);
  const files = await prisma.file.findMany({
    where: { ownerId: session.userId, folderId: { in: folderIds } },
    select: { path: true },
  });

  await prisma.folder.delete({ where: { id } });

  await Promise.all(files.map((f) => deleteFile(f.path)));

  return NextResponse.json({ ok: true });
}
