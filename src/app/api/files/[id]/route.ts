import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFileAccess, canEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  folderId: z.string().nullable().optional(),
  starred: z.boolean().optional(),
  tagIds: z.array(z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getFileAccess(id, session.userId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...access.file, role: access.role });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getFileAccess(id, session.userId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { name, folderId, starred, tagIds } = parsed.data;

  if (folderId !== undefined && access.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can move this file" }, { status: 403 });
  }
  if (starred !== undefined && access.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can star this file" }, { status: 403 });
  }
  if (tagIds !== undefined && access.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can tag this file" }, { status: 403 });
  }

  if (tagIds !== undefined) {
    const ownedTags = await prisma.tag.findMany({
      where: { id: { in: tagIds }, ownerId: session.userId },
      select: { id: true },
    });
    if (ownedTags.length !== tagIds.length) {
      return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
    }
  }

  if (folderId !== undefined && folderId !== null) {
    const target = await prisma.folder.findFirst({ where: { id: folderId, ownerId: session.userId, deletedAt: null } });
    if (!target) return NextResponse.json({ error: "Target folder not found" }, { status: 404 });
  }

  const updated = await prisma.file.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(folderId !== undefined ? { folderId } : {}),
      ...(starred !== undefined ? { starred } : {}),
      ...(tagIds !== undefined ? { tags: { set: tagIds.map((tagId) => ({ id: tagId })) } } : {}),
    },
    include: { tags: true },
  });

  if (name !== undefined && name !== access.file.name) {
    await logActivity({
      ownerId: access.file.ownerId,
      actorId: session.userId,
      action: "rename",
      targetType: "file",
      targetName: name,
    });
  }
  if (folderId !== undefined) {
    await logActivity({
      ownerId: access.file.ownerId,
      actorId: session.userId,
      action: "move",
      targetType: "file",
      targetName: updated.name,
    });
  }
  if (starred !== undefined) {
    await logActivity({
      ownerId: access.file.ownerId,
      actorId: session.userId,
      action: starred ? "star" : "unstar",
      targetType: "file",
      targetName: updated.name,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getFileAccess(id, session.userId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.file.update({ where: { id }, data: { deletedAt: new Date() } });

  await logActivity({
    ownerId: access.file.ownerId,
    actorId: session.userId,
    action: "trash",
    targetType: "file",
    targetName: access.file.name,
  });

  return NextResponse.json({ ok: true });
}
