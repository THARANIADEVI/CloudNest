import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const file = await prisma.file.findFirst({ where: { id, ownerId: session.userId } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let share = await prisma.share.findFirst({ where: { fileId: id } });
  if (!share) {
    share = await prisma.share.create({ data: { fileId: id, token: randomUUID() } });
  }

  return NextResponse.json({ token: share.token, url: `/s/${share.token}` });
}
