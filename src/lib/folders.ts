import { prisma } from "@/lib/prisma";

export async function collectFolderIds(ownerId: string, rootId: string): Promise<string[]> {
  const ids = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await prisma.folder.findMany({
      where: { ownerId, parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}

export async function isSameOrDescendant(ownerId: string, rootId: string, targetId: string) {
  const ids = await collectFolderIds(ownerId, rootId);
  return ids.includes(targetId);
}
