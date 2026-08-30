import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { resolveFilePath } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const share = await prisma.share.findUnique({ where: { token }, include: { file: true } });
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await readFile(resolveFilePath(share.file.path));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": share.file.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(share.file.name)}"`,
    },
  });
}
