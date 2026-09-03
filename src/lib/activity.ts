import { prisma } from "@/lib/prisma";

export type ActivityAction =
  | "upload"
  | "new_version"
  | "restore_version"
  | "rename"
  | "move"
  | "star"
  | "unstar"
  | "trash"
  | "restore"
  | "delete_forever"
  | "share"
  | "unshare"
  | "create_link"
  | "revoke_link"
  | "create_folder"
  | "rename_folder"
  | "move_folder"
  | "trash_folder"
  | "restore_folder"
  | "delete_folder_forever";

export function logActivity(params: {
  ownerId: string;
  actorId: string;
  action: ActivityAction;
  targetType: "file" | "folder";
  targetName: string;
}) {
  return prisma.activity.create({ data: params }).catch(() => null);
}
