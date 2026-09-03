import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { resolveFilePath } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const share = await prisma.share.findUnique({ where: { token }, include: { file: true } });
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }

  if (share.password) {
    const provided = request.nextUrl.searchParams.get("password") ?? "";
    const valid = provided && (await verifyPassword(provided, share.password));
    if (!valid) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const buffer = await readFile(resolveFilePath(share.file.path));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": share.file.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(share.file.name)}"`,
    },
  });
}
