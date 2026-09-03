"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Meta = { name: string; size: number; mimeType: string; hasPassword: boolean };

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/share/${token}`);
      if (res.status === 404) {
        setError("This link doesn't exist.");
        return;
      }
      if (res.status === 410) {
        setError("This link has expired.");
        return;
      }
      const data = await res.json();
      setMeta(data);
    })();
  }, [token]);

  function download(e?: FormEvent) {
    e?.preventDefault();
    setDownloadError("");
    const url = `/api/share/${token}/download${password ? `?password=${encodeURIComponent(password)}` : ""}`;
    window.location.href = url;
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 border rounded-lg p-6 text-center">
        <p className="text-4xl">📄</p>
        <h1 className="font-semibold break-all">{meta.name}</h1>
        <p className="text-sm text-gray-500">{formatSize(meta.size)}</p>

        {meta.hasPassword ? (
          <form onSubmit={download} className="space-y-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
            {downloadError && <p className="text-xs text-red-600">{downloadError}</p>}
            <button type="submit" className="w-full bg-black text-white rounded px-4 py-2 text-sm">
              Download
            </button>
          </form>
        ) : (
          <button onClick={() => download()} className="inline-block bg-black text-white rounded px-4 py-2 text-sm">
            Download
          </button>
        )}
      </div>
    </div>
  );
}
