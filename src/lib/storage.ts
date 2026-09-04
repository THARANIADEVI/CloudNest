import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

function resolveFilePath(diskName: string) {
  return path.join(UPLOAD_DIR, diskName);
}

export async function saveFile(buffer: Buffer, originalName: string) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(originalName);
  const diskName = `${randomUUID()}${ext}`;
  await writeFile(resolveFilePath(diskName), buffer);
  return diskName;
}

export async function readStoredFile(diskName: string) {
  return readFile(resolveFilePath(diskName));
}

export async function deleteFile(diskName: string) {
  try {
    await unlink(resolveFilePath(diskName));
  } catch {
    // already gone, ignore
  }
}
