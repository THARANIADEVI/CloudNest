import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getQuota } from "@/lib/quota";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await getQuota(session.userId);
  return NextResponse.json(quota);
}
