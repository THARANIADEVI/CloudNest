"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type Version = {
  id: string;
  versionNumber: number;
  size: number;
  mimeType: string;
  createdAt: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VersionsDialog({
  fileId,
  fileName,
  canEdit,
  onClose,
  onRestored,
}: {
  fileId: string;
  fileName: string;
  canEdit: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [currentVersion, setCurrentVersion] = useState(1);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/files/${fileId}/versions`);
    if (res.ok) {
      const data = await res.json();
      setCurrentVersion(data.currentVersion);
      setVersions(data.versions);
    } else {
      setError("Failed to load version history");
    }
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/files/${fileId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setCurrentVersion(data.currentVersion);
        setVersions(data.versions);
      } else {
        setError("Failed to load version history");
      }
      setLoading(false);
    })();
  }, [fileId]);

  async function uploadNewVersion(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/files/${fileId}/versions`, { method: "POST", body: formData });
    setUploading(false);
    if (e.target) e.target.value = "";
    if (res.ok) {
      load();
      onRestored();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Upload failed");
    }
  }

  async function restore(versionId: string) {
    if (!window.confirm("Restore this version? The current content will be kept in history.")) return;
    const res = await fetch(`/api/files/${fileId}/versions/${versionId}/restore`, { method: "POST" });
    if (res.ok) {
      load();
      onRestored();
    } else {
      setError("Restore failed");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-4 space-y-3">
        <h2 className="font-semibold text-sm">Version history — &quot;{fileName}&quot;</h2>

        {canEdit && (
          <div>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="border rounded px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload new version"}
            </button>
            <input ref={inputRef} type="file" className="hidden" onChange={uploadNewVersion} />
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="border rounded max-h-64 overflow-y-auto">
          {loading ? (
            <p className="p-3 text-sm text-gray-500">Loading...</p>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 text-sm bg-gray-50">
                <span>Version {currentVersion} (current)</span>
                <span className="text-gray-400">latest</span>
              </div>
              {versions.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">No earlier versions.</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between px-3 py-2 text-sm border-t">
                    <span>
                      Version {v.versionNumber}{" "}
                      <span className="text-gray-400">
                        · {formatSize(v.size)} · {new Date(v.createdAt).toLocaleString()}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <a href={`/api/files/${fileId}/versions/${v.id}`} className="underline">
                        Download
                      </a>
                      {canEdit && (
                        <button onClick={() => restore(v.id)} className="underline">
                          Restore
                        </button>
                      )}
                    </span>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="border rounded px-3 py-1.5 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
