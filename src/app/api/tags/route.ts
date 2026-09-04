import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tags = await prisma.tag.findMany({
    where: { ownerId: session.userId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ tags });
}

const createSchema = z.object({ name: z.string().trim().min(1).max(40) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const tag = await prisma.tag.upsert({
    where: { ownerId_name: { ownerId: session.userId, name: parsed.data.name } },
    update: {},
    create: { name: parsed.data.name, ownerId: session.userId },
  });

  return NextResponse.json(tag, { status: 201 });
}
