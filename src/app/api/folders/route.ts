import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parentId = request.nextUrl.searchParams.get("parentId");

  const [folders, files, currentFolder] = await Promise.all([
    prisma.folder.findMany({
      where: { ownerId: session.userId, parentId: parentId ?? null, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.file.findMany({
      where: { ownerId: session.userId, folderId: parentId ?? null, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    parentId
      ? prisma.folder.findFirst({ where: { id: parentId, ownerId: session.userId, deletedAt: null } })
      : null,
  ]);

  return NextResponse.json({ folders, files, currentFolder });
}

const createSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { name, parentId } = parsed.data;

  if (parentId) {
    const parent = await prisma.folder.findFirst({ where: { id: parentId, ownerId: session.userId, deletedAt: null } });
    if (!parent) return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
  }

  const folder = await prisma.folder.create({
    data: { name, parentId: parentId ?? null, ownerId: session.userId },
  });

  return NextResponse.json(folder, { status: 201 });
}
