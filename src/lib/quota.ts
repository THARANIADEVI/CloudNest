import { prisma } from "@/lib/prisma";

export async function getUsedBytes(ownerId: string) {
  const [fileTotal, versionTotal] = await Promise.all([
    prisma.file.aggregate({
      where: { ownerId },
      _sum: { size: true },
    }),
    prisma.fileVersion.aggregate({
      where: { file: { ownerId } },
      _sum: { size: true },
    }),
  ]);
  return (fileTotal._sum.size ?? 0) + (versionTotal._sum.size ?? 0);
}

export async function getQuota(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { quotaBytes: true } });
  const quotaBytes = user?.quotaBytes ?? 1073741824;
  const usedBytes = await getUsedBytes(userId);
  return { usedBytes, quotaBytes };
}
