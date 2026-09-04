import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFileAccess } from "@/lib/permissions";
import { readStoredFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionId } = await params;
  const access = await getFileAccess(id, session.userId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId: id } });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await readStoredFile(version.path);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": version.mimeType,
      "Content-Disposition": `attachment; filename="v${version.versionNumber}-${encodeURIComponent(access.file.name)}"`,
    },
  });
}
