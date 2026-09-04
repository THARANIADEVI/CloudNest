import { prisma } from "@/lib/prisma";

export type FileRole = "owner" | "editor" | "viewer";

export async function getFileAccess(fileId: string, userId: string) {
  const file = await prisma.file.findUnique({ where: { id: fileId }, include: { tags: true } });
  if (!file || file.deletedAt) return null;

  if (file.ownerId === userId) return { file, role: "owner" as FileRole };

  const share = await prisma.userShare.findUnique({
    where: { fileId_sharedWithId: { fileId, sharedWithId: userId } },
  });
  if (!share) return null;

  return { file, role: share.role as FileRole };
}

export function canEdit(role: FileRole) {
  return role === "owner" || role === "editor";
}
