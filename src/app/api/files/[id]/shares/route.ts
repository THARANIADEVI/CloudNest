import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["viewer", "editor"]),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const file = await prisma.file.findFirst({ where: { id, ownerId: session.userId } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const shares = await prisma.userShare.findMany({
    where: { fileId: id },
    include: { sharedWith: { select: { email: true } } },
  });

  return NextResponse.json({ shares });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const file = await prisma.file.findFirst({ where: { id, ownerId: session.userId, deletedAt: null } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { email, role } = parsed.data;

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return NextResponse.json({ error: "No user with that email" }, { status: 404 });
  if (target.id === session.userId) {
    return NextResponse.json({ error: "You already own this file" }, { status: 400 });
  }

  const share = await prisma.userShare.upsert({
    where: { fileId_sharedWithId: { fileId: id, sharedWithId: target.id } },
    update: { role },
    create: { fileId: id, sharedWithId: target.id, role },
  });

  await logActivity({
    ownerId: session.userId,
    actorId: session.userId,
    action: "share",
    targetType: "file",
    targetName: `${file.name} → ${email} (${role})`,
  });

  return NextResponse.json(share, { status: 201 });
}
