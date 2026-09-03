import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const share = await prisma.share.findUnique({ where: { token }, include: { file: true } });
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }

  return NextResponse.json({
    name: share.file.name,
    size: share.file.size,
    mimeType: share.file.mimeType,
    hasPassword: !!share.password,
  });
}
