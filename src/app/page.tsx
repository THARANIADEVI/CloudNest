"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MoveDialog from "@/components/MoveDialog";

type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
};

type FileItem = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  folderId: string | null;
};

type Crumb = { id: string | null; name: string };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [checkedAuth, setCheckedAuth] = useState(false);
  const [userName, setUserName] = useState("");

  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "My files" }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FileItem[] | null>(null);

  const [moveTarget, setMoveTarget] = useState<
    { type: "file" | "folder"; id: string; name: string } | null
  >(null);

  const currentFolderId = crumbs[crumbs.length - 1].id;

  const loadFolder = useCallback(async (parentId: string | null) => {
    setLoading(true);
    setError("");
    const url = parentId ? `/api/folders?parentId=${parentId}` : "/api/folders";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setFolders(data.folders);
      setFiles(data.files);
    } else {
      setError("Failed to load folder");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUserName(data.user.email);
      setCheckedAuth(true);
    })();
  }, [router]);

  useEffect(() => {
    if (checkedAuth) loadFolder(currentFolderId);
  }, [checkedAuth, currentFolderId, loadFolder]);

  function openFolder(folder: FolderItem) {
    setSearchResults(null);
    setCrumbs((c) => [...c, { id: folder.id, name: folder.name }]);
  }

  function goToCrumb(index: number) {
    setSearchResults(null);
    setCrumbs((c) => c.slice(0, index + 1));
  }

  async function createFolder() {
    const name = window.prompt("Folder name:");
    if (!name) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: currentFolderId }),
    });
    if (res.ok) {
      loadFolder(currentFolderId);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create folder");
    }
  }

  async function onUploadChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    if (currentFolderId) formData.append("folderId", currentFolderId);
    const res = await fetch("/api/files", { method: "POST", body: formData });
    setUploading(false);
    if (e.target) e.target.value = "";
    if (res.ok) {
      loadFolder(currentFolderId);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Upload failed");
    }
  }

  async function deleteFileItem(id: string) {
    if (!window.confirm("Delete this file?")) return;
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (res.ok) {
      loadFolder(currentFolderId);
      setSearchResults((r) => (r ? r.filter((f) => f.id !== id) : r));
    } else {
      setError("Delete failed");
    }
  }

  async function deleteFolderItem(id: string) {
    if (!window.confirm("Delete this folder and everything inside it?")) return;
    const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (res.ok) {
      loadFolder(currentFolderId);
    } else {
      setError("Delete failed");
    }
  }

  async function renameFolderItem(folder: FolderItem) {
    const name = window.prompt("Rename folder:", folder.name);
    if (!name || name === folder.name) return;
    const res = await fetch(`/api/folders/${folder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      loadFolder(currentFolderId);
    } else {
      setError("Rename failed");
    }
  }

  async function renameFileItem(file: FileItem) {
    const name = window.prompt("Rename file:", file.name);
    if (!name || name === file.name) return;
    const res = await fetch(`/api/files/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      loadFolder(currentFolderId);
      setSearchResults((r) => (r ? r.map((f) => (f.id === file.id ? { ...f, name } : f)) : r));
    } else {
      setError("Rename failed");
    }
  }

  async function confirmMove(targetFolderId: string | null) {
    if (!moveTarget) return;
    const url =
      moveTarget.type === "folder" ? `/api/folders/${moveTarget.id}` : `/api/files/${moveTarget.id}`;
    const key = moveTarget.type === "folder" ? "parentId" : "folderId";
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: targetFolderId }),
    });
    setMoveTarget(null);
    if (res.ok) {
      loadFolder(currentFolderId);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Move failed");
    }
  }

  async function shareFileItem(id: string) {
    const res = await fetch(`/api/files/${id}/share`, { method: "POST" });
    if (!res.ok) {
      setError("Share failed");
      return;
    }
    const data = await res.json();
    const fullUrl = `${window.location.origin}${data.url}`;
    await navigator.clipboard.writeText(fullUrl).catch(() => {});
    window.alert(`Share link copied:\n${fullUrl}`);
  }

  async function runSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data.files);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!checkedAuth) {
    return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  }

  const listFiles = searchResults ?? files;

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between gap-4">
        <span className="font-semibold">CloudNest</span>
        <form onSubmit={runSearch} className="flex-1 max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
        </form>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">{userName}</span>
          <button onClick={logout} className="underline">
            Log out
          </button>
        </div>
      </header>

      <div className="px-6 py-3 flex items-center justify-between gap-4 border-b">
        <nav className="text-sm flex items-center gap-1 flex-wrap">
          {crumbs.map((c, i) => (
            <span key={c.id ?? "root"} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-400">/</span>}
              <button
                onClick={() => goToCrumb(i)}
                disabled={!searchResults && i === crumbs.length - 1}
                className="hover:underline disabled:no-underline disabled:text-gray-900"
              >
                {c.name}
              </button>
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={createFolder} className="border rounded px-3 py-1.5 text-sm">
            New folder
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-black text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload file"}
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={onUploadChange} />
        </div>
      </div>

      {error && <p className="px-6 pt-2 text-sm text-red-600">{error}</p>}

      <main className="flex-1 p-6">
        {searchResults && (
          <p className="text-sm text-gray-500 mb-3">
            Search results for &quot;{query}&quot; ({searchResults.length})
          </p>
        )}

        {loading && !searchResults ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-1">
            {!searchResults &&
              folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between border rounded px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <button onClick={() => openFolder(folder)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                    <span>📁</span>
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => renameFolderItem(folder)} className="underline">
                      Rename
                    </button>
                    <button
                      onClick={() => setMoveTarget({ type: "folder", id: folder.id, name: folder.name })}
                      className="underline"
                    >
                      Move
                    </button>
                    <button onClick={() => deleteFolderItem(folder.id)} className="text-red-600 underline">
                      Delete
                    </button>
                  </div>
                </div>
              ))}

            {listFiles.map((file) => {
              const previewable =
                file.mimeType.startsWith("image/") ||
                file.mimeType === "application/pdf" ||
                file.mimeType === "text/plain";
              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between border rounded px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span>📄</span>
                    <span className="truncate">{file.name}</span>
                    <span className="text-gray-400 shrink-0">{formatSize(file.size)}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {previewable && (
                      <a href={`/api/files/${file.id}/preview`} target="_blank" rel="noreferrer" className="underline">
                        Preview
                      </a>
                    )}
                    <a href={`/api/files/${file.id}/download`} className="underline">
                      Download
                    </a>
                    <button onClick={() => renameFileItem(file)} className="underline">
                      Rename
                    </button>
                    <button
                      onClick={() => setMoveTarget({ type: "file", id: file.id, name: file.name })}
                      className="underline"
                    >
                      Move
                    </button>
                    <button onClick={() => shareFileItem(file.id)} className="underline">
                      Share
                    </button>
                    <button onClick={() => deleteFileItem(file.id)} className="text-red-600 underline">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {!loading && !searchResults && folders.length === 0 && files.length === 0 && (
              <p className="text-sm text-gray-500">Empty folder.</p>
            )}
            {searchResults && searchResults.length === 0 && (
              <p className="text-sm text-gray-500">No files found.</p>
            )}
          </div>
        )}
      </main>

      {moveTarget && (
        <MoveDialog
          itemType={moveTarget.type}
          itemName={moveTarget.name}
          excludeFolderId={moveTarget.type === "folder" ? moveTarget.id : undefined}
          onCancel={() => setMoveTarget(null)}
          onConfirm={confirmMove}
        />
      )}
    </div>
  );
}
