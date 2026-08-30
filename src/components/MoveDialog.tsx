"use client";

import { useEffect, useState } from "react";

type FolderItem = { id: string; name: string; parentId: string | null };
type Crumb = { id: string | null; name: string };

export default function MoveDialog({
  itemType,
  itemName,
  excludeFolderId,
  onCancel,
  onConfirm,
}: {
  itemType: "file" | "folder";
  itemName: string;
  excludeFolderId?: string;
  onCancel: () => void;
  onConfirm: (targetFolderId: string | null) => void;
}) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "My files" }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const currentId = crumbs[crumbs.length - 1].id;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const url = currentId ? `/api/folders?parentId=${currentId}` : "/api/folders";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders);
      }
      setLoading(false);
    })();
  }, [currentId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-4 space-y-3">
        <h2 className="font-semibold text-sm">
          Move &quot;{itemName}&quot; to...
        </h2>

        <nav className="text-xs flex items-center gap-1 flex-wrap text-gray-500">
          {crumbs.map((c, i) => (
            <span key={c.id ?? "root"} className="flex items-center gap-1">
              {i > 0 && <span>/</span>}
              <button onClick={() => setCrumbs((cs) => cs.slice(0, i + 1))} className="hover:underline">
                {c.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="border rounded max-h-56 overflow-y-auto">
          {loading ? (
            <p className="p-3 text-sm text-gray-500">Loading...</p>
          ) : folders.filter((f) => f.id !== excludeFolderId).length === 0 ? (
            <p className="p-3 text-sm text-gray-500">No subfolders.</p>
          ) : (
            folders
              .filter((f) => f.id !== excludeFolderId)
              .map((f) => (
                <button
                  key={f.id}
                  onClick={() => setCrumbs((cs) => [...cs, { id: f.id, name: f.name }])}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <span>📁</span>
                  <span>{f.name}</span>
                </button>
              ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="border rounded px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(currentId)}
            disabled={itemType === "folder" && currentId === excludeFolderId}
            className="bg-black text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}
