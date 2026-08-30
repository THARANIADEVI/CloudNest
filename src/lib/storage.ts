import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function saveFile(buffer: Buffer, originalName: string) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(originalName);
  const diskName = `${randomUUID()}${ext}`;
  const fullPath = path.join(UPLOAD_DIR, diskName);
  await writeFile(fullPath, buffer);
  return diskName;
}

export function resolveFilePath(diskName: string) {
  return path.join(UPLOAD_DIR, diskName);
}

export async function deleteFile(diskName: string) {
  try {
    await unlink(resolveFilePath(diskName));
  } catch {
    // already gone, ignore
  }
}
