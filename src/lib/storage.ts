import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION ?? "auto";
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;

export const isS3Configured = Boolean(S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);

// Lazily constructed so local-disk deployments never need the AWS SDK to succeed.
async function getS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: Boolean(S3_ENDPOINT),
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID!,
      secretAccessKey: S3_SECRET_ACCESS_KEY!,
    },
    // Non-AWS S3-compatible providers (Supabase, R2, MinIO) don't handle the
    // SDK's default request/response checksum headers and fail signature
    // verification with SignatureDoesNotMatch unless this is disabled.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

function resolveFilePath(diskName: string) {
  return path.join(UPLOAD_DIR, diskName);
}

export async function saveFile(buffer: Buffer, originalName: string) {
  const ext = path.extname(originalName);
  const diskName = `${randomUUID()}${ext}`;

  if (isS3Configured) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    await client.send(
      new PutObjectCommand({ Bucket: S3_BUCKET, Key: diskName, Body: buffer })
    );
    return diskName;
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(resolveFilePath(diskName), buffer);
  return diskName;
}

export async function readStoredFile(diskName: string) {
  if (isS3Configured) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    const result = await client.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: diskName })
    );
    const bytes = await result.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  return readFile(resolveFilePath(diskName));
}

export async function deleteFile(diskName: string) {
  if (isS3Configured) {
    try {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await getS3Client();
      await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: diskName }));
    } catch {
      // already gone, ignore
    }
    return;
  }

  try {
    await unlink(resolveFilePath(diskName));
  } catch {
    // already gone, ignore
  }
}

/**
 * Time-limited direct-to-storage URL so downloads don't have to proxy
 * bytes through the app server. Returns null on local-disk deployments,
 * where callers should fall back to streaming via readStoredFile.
 */
export async function getSignedDownloadUrl(diskName: string, filename: string, expiresInSeconds = 300) {
  if (!isS3Configured) return null;

  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await getS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: diskName,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    }),
    { expiresIn: expiresInSeconds }
  );
}
