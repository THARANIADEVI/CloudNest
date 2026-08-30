import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { deleteFile } from "@/lib/storage";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  folderId: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const file = await prisma.file.findFirst({ where: { id, ownerId: session.userId } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { name, folderId } = parsed.data;

  if (folderId !== undefined && folderId !== null) {
    const target = await prisma.folder.findFirst({ where: { id: folderId, ownerId: session.userId } });
    if (!target) return NextResponse.json({ error: "Target folder not found" }, { status: 404 });
  }

  const updated = await prisma.file.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(folderId !== undefined ? { folderId } : {}),
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
  const file = await prisma.file.findFirst({ where: { id, ownerId: session.userId } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.file.delete({ where: { id } });
  await deleteFile(file.path);

  return NextResponse.json({ ok: true });
}
