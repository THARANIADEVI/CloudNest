import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await prisma.share.findUnique({ where: { token }, include: { file: true } });

  if (!share) notFound();

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 border rounded-lg p-6 text-center">
        <p className="text-4xl">📄</p>
        <h1 className="font-semibold break-all">{share.file.name}</h1>
        <p className="text-sm text-gray-500">{formatSize(share.file.size)}</p>
        <a
          href={`/api/share/${token}/download`}
          className="inline-block bg-black text-white rounded px-4 py-2 text-sm"
        >
          Download
        </a>
      </div>
    </div>
  );
}
