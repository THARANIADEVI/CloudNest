import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const bodySchema = z.object({
  password: z.string().min(1).optional(),
  expiresInHours: z.number().positive().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const file = await prisma.file.findFirst({ where: { id, ownerId: session.userId, deletedAt: null } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { password, expiresInHours } = parsed.data;

  const passwordHash = password ? await hashPassword(password) : null;
  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null;

  const existing = await prisma.share.findFirst({ where: { fileId: id } });
  const share = existing
    ? await prisma.share.update({ where: { id: existing.id }, data: { password: passwordHash, expiresAt } })
    : await prisma.share.create({ data: { fileId: id, token: randomUUID(), password: passwordHash, expiresAt } });

  await logActivity({
    ownerId: session.userId,
    actorId: session.userId,
    action: "create_link",
    targetType: "file",
    targetName: file.name,
  });

  return NextResponse.json({ token: share.token, url: `/s/${share.token}`, expiresAt: share.expiresAt });
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

  await prisma.share.deleteMany({ where: { fileId: id } });

  await logActivity({
    ownerId: session.userId,
    actorId: session.userId,
    action: "revoke_link",
    targetType: "file",
    targetName: file.name,
  });

  return NextResponse.json({ ok: true });
}
