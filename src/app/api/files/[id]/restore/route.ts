import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const file = await prisma.file.findFirst({ where: { id, ownerId: session.userId } });
  if (!file || !file.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.file.update({ where: { id }, data: { deletedAt: null } });

  await logActivity({
    ownerId: file.ownerId,
    actorId: session.userId,
    action: "restore",
    targetType: "file",
    targetName: file.name,
  });

  return NextResponse.json({ ok: true });
}
