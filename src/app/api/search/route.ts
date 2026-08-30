import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ files: [] });

  const files = await prisma.file.findMany({
    where: {
      ownerId: session.userId,
      name: { contains: q },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ files });
}
