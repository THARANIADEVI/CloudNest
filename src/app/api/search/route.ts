import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const TYPE_FILTERS: Record<string, string[]> = {
  image: ["image/"],
  pdf: ["application/pdf"],
  video: ["video/"],
  audio: ["audio/"],
  text: ["text/"],
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = request.nextUrl.searchParams.get("type")?.trim() ?? "";
  const tagId = request.nextUrl.searchParams.get("tag")?.trim() ?? "";
  if (!q && !type && !tagId) return NextResponse.json({ files: [] });

  const where: Prisma.FileWhereInput = {
    ownerId: session.userId,
    deletedAt: null,
  };
  if (q) where.name = { contains: q };
  if (type && TYPE_FILTERS[type]) {
    where.OR = TYPE_FILTERS[type].map((prefix) => ({ mimeType: { startsWith: prefix } }));
  }
  if (tagId) where.tags = { some: { id: tagId } };

  const files = await prisma.file.findMany({ where, include: { tags: true }, orderBy: { name: "asc" } });

  return NextResponse.json({ files });
}
