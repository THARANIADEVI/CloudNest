import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, shareId } = await params;
  const file = await prisma.file.findFirst({ where: { id, ownerId: session.userId } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const share = await prisma.userShare.findFirst({
    where: { id: shareId, fileId: id },
    include: { sharedWith: { select: { email: true } } },
  });
  await prisma.userShare.deleteMany({ where: { id: shareId, fileId: id } });

  if (share) {
    await logActivity({
      ownerId: session.userId,
      actorId: session.userId,
      action: "unshare",
      targetType: "file",
      targetName: `${file.name} → ${share.sharedWith.email}`,
    });
  }

  return NextResponse.json({ ok: true });
}
