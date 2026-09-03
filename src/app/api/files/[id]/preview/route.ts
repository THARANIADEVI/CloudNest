import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getSession } from "@/lib/auth";
import { resolveFilePath } from "@/lib/storage";
import { getFileAccess } from "@/lib/permissions";

const INLINE_SAFE = ["image/", "application/pdf", "text/plain"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getFileAccess(id, session.userId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const file = access.file;

  const inline = INLINE_SAFE.some((prefix) => file.mimeType.startsWith(prefix));
  const buffer = await readFile(resolveFilePath(file.path));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": inline ? file.mimeType : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.name)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
