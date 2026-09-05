import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import path from "path";
import os from "os";

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "cloudnest-storage-"));
  process.env.UPLOAD_DIR = tmpDir;
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("local disk storage", () => {
  it("round-trips saveFile -> readStoredFile -> deleteFile", async () => {
    const { saveFile, readStoredFile, deleteFile, isS3Configured } = await import("@/lib/storage");
    expect(isS3Configured).toBe(false);

    const content = Buffer.from("hello cloudnest");
    const diskName = await saveFile(content, "note.txt");
    expect(diskName.endsWith(".txt")).toBe(true);

    const read = await readStoredFile(diskName);
    expect(read.toString()).toBe("hello cloudnest");

    await deleteFile(diskName);
    await expect(readStoredFile(diskName)).rejects.toThrow();
  });

  it("returns null signed URL when S3 is not configured", async () => {
    const { getSignedDownloadUrl } = await import("@/lib/storage");
    const url = await getSignedDownloadUrl("some-file.txt", "some-file.txt");
    expect(url).toBeNull();
  });
});
