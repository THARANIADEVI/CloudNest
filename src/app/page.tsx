"use client";

import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MoveDialog from "@/components/MoveDialog";
import ShareDialog from "@/components/ShareDialog";

type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  deletedAt?: string | null;
};

type FileItem = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  folderId: string | null;
  starred: boolean;
  deletedAt?: string | null;
  role?: "owner" | "editor" | "viewer";
};

type Crumb = { id: string | null; name: string };
type View = "drive" | "starred" | "shared" | "trash";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isOwner(file: FileItem) {
  return !file.role || file.role === "owner";
}

function canEditFile(file: FileItem) {
  return isOwner(file) || file.role === "editor";
}

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [checkedAuth, setCheckedAuth] = useState(false);
  const [userName, setUserName] = useState("");

  const [view, setView] = useState<View>("drive");
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "My files" }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [trashFolders, setTrashFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchResults, setSearchResults] = useState<FileItem[] | null>(null);

  const [moveTarget, setMoveTarget] = useState<
    { type: "file" | "folder"; id: string; name: string } | null
  >(null);
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string } | null>(null);

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

  const loadStarred = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/starred");
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files);
      setFolders([]);
    } else {
      setError("Failed to load starred files");
    }
    setLoading(false);
  }, []);

  const loadShared = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/shared-with-me");
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files);
      setFolders([]);
    } else {
      setError("Failed to load shared files");
    }
    setLoading(false);
  }, []);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/trash");
    if (res.ok) {
      const data = await res.json();
      setTrashFolders(data.folders);
      setFiles(data.files);
    } else {
      setError("Failed to load trash");
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
    if (!checkedAuth) return;
    if (view === "drive") loadFolder(currentFolderId);
    else if (view === "starred") loadStarred();
    else if (view === "shared") loadShared();
    else if (view === "trash") loadTrash();
  }, [checkedAuth, view, currentFolderId, loadFolder, loadStarred, loadShared, loadTrash]);

  function refresh() {
    if (view === "drive") loadFolder(currentFolderId);
    else if (view === "starred") loadStarred();
    else if (view === "shared") loadShared();
    else if (view === "trash") loadTrash();
  }

  function switchView(v: View) {
    setView(v);
    setCrumbs([{ id: null, name: "My files" }]);
    setQuery("");
    setTypeFilter("");
    setSearchResults(null);
  }

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

  async function uploadFiles(fileList: FileList | File[]) {
    setUploading(true);
    setError("");
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append("file", file);
      if (currentFolderId) formData.append("folderId", currentFolderId);
      const res = await fetch("/api/files", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Upload failed: ${file.name}`);
      }
    }
    setUploading(false);
    loadFolder(currentFolderId);
  }

  async function onUploadChange(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    await uploadFiles(list);
    if (e.target) e.target.value = "";
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    if (view !== "drive") return;
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  async function onDrop(e: DragEvent<HTMLDivElement>) {
    if (view !== "drive") return;
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files);
    }
  }

  async function toggleStar(file: FileItem) {
    const res = await fetch(`/api/files/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: !file.starred }),
    });
    if (res.ok) {
      refresh();
    } else {
      setError("Failed to update star");
    }
  }

  async function trashFileItem(id: string) {
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (res.ok) {
      refresh();
      setSearchResults((r) => (r ? r.filter((f) => f.id !== id) : r));
    } else {
      setError("Delete failed");
    }
  }

  async function trashFolderItem(id: string) {
    if (!window.confirm("Move this folder and everything inside it to Trash?")) return;
    const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (res.ok) {
      loadFolder(currentFolderId);
    } else {
      setError("Delete failed");
    }
  }

  async function restoreFile(id: string) {
    const res = await fetch(`/api/files/${id}/restore`, { method: "POST" });
    if (res.ok) loadTrash();
    else setError("Restore failed");
  }

  async function restoreFolder(id: string) {
    const res = await fetch(`/api/folders/${id}/restore`, { method: "POST" });
    if (res.ok) loadTrash();
    else setError("Restore failed");
  }

  async function deleteFileForever(id: string) {
    if (!window.confirm("Permanently delete this file? This cannot be undone.")) return;
    const res = await fetch(`/api/files/${id}/permanent`, { method: "DELETE" });
    if (res.ok) loadTrash();
    else setError("Delete failed");
  }

  async function deleteFolderForever(id: string) {
    if (!window.confirm("Permanently delete this folder and everything inside it? This cannot be undone.")) return;
    const res = await fetch(`/api/folders/${id}/permanent`, { method: "DELETE" });
    if (res.ok) loadTrash();
    else setError("Delete failed");
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
      refresh();
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

  async function runSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim() && !typeFilter) {
      setSearchResults(null);
      return;
    }
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (typeFilter) params.set("type", typeFilter);
    const res = await fetch(`/api/search?${params.toString()}`);
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
    <div className="flex-1 flex">
      <aside className="w-48 border-r shrink-0 p-3 space-y-1 text-sm">
        <div className="font-semibold px-2 pb-3">CloudNest</div>
        {(
          [
            ["drive", "My Drive"],
            ["starred", "Starred"],
            ["shared", "Shared with me"],
            ["trash", "Trash"],
          ] as [View, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => switchView(v)}
            className={`w-full text-left rounded px-2 py-1.5 ${
              view === v ? "bg-black text-white" : "hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b px-6 py-3 flex items-center justify-between gap-4">
          <form onSubmit={runSearch} className="flex-1 max-w-md flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm shrink-0"
            >
              <option value="">All types</option>
              <option value="image">Images</option>
              <option value="pdf">PDFs</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="text">Text</option>
            </select>
          </form>
          <div className="flex items-center gap-3 text-sm shrink-0">
            <span className="text-gray-500">{userName}</span>
            <button onClick={logout} className="underline">
              Log out
            </button>
          </div>
        </header>

        {view === "drive" && (
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
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onUploadChange} />
            </div>
          </div>
        )}

        {view === "trash" && (trashFolders.length > 0 || files.length > 0) && (
          <div className="px-6 py-3 border-b text-sm text-gray-500">
            Items in Trash are kept until permanently deleted.
          </div>
        )}

        {error && <p className="px-6 pt-2 text-sm text-red-600">{error}</p>}

        <main
          className={`flex-1 p-6 relative ${dragging ? "bg-blue-50" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {dragging && (
            <div className="absolute inset-3 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center text-blue-600 text-sm pointer-events-none z-10">
              Drop files to upload
            </div>
          )}

          {searchResults && (
            <p className="text-sm text-gray-500 mb-3">
              Search results ({searchResults.length})
            </p>
          )}

          {loading && !searchResults ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : (
            <div className="space-y-1">
              {view === "drive" &&
                !searchResults &&
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
                      <button onClick={() => trashFolderItem(folder.id)} className="text-red-600 underline">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

              {view === "trash" &&
                trashFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center justify-between border rounded px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span>📁</span>
                      <span className="truncate">{folder.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => restoreFolder(folder.id)} className="underline">
                        Restore
                      </button>
                      <button onClick={() => deleteFolderForever(folder.id)} className="text-red-600 underline">
                        Delete forever
                      </button>
                    </div>
                  </div>
                ))}

              {listFiles.map((file) => {
                const previewable =
                  file.mimeType.startsWith("image/") ||
                  file.mimeType === "application/pdf" ||
                  file.mimeType === "text/plain";
                const owner = isOwner(file);
                const editable = canEditFile(file);
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between border rounded px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span>📄</span>
                      <span className="truncate">{file.name}</span>
                      <span className="text-gray-400 shrink-0">{formatSize(file.size)}</span>
                      {!owner && (
                        <span className="text-gray-400 shrink-0">({file.role})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {view !== "trash" && owner && (
                        <button onClick={() => toggleStar(file)} className="underline">
                          {file.starred ? "Unstar" : "Star"}
                        </button>
                      )}
                      {previewable && (
                        <a href={`/api/files/${file.id}/preview`} target="_blank" rel="noreferrer" className="underline">
                          Preview
                        </a>
                      )}
                      <a href={`/api/files/${file.id}/download`} className="underline">
                        Download
                      </a>
                      {view === "trash" ? (
                        <>
                          <button onClick={() => restoreFile(file.id)} className="underline">
                            Restore
                          </button>
                          <button onClick={() => deleteFileForever(file.id)} className="text-red-600 underline">
                            Delete forever
                          </button>
                        </>
                      ) : (
                        <>
                          {editable && (
                            <button onClick={() => renameFileItem(file)} className="underline">
                              Rename
                            </button>
                          )}
                          {owner && (
                            <button
                              onClick={() => setMoveTarget({ type: "file", id: file.id, name: file.name })}
                              className="underline"
                            >
                              Move
                            </button>
                          )}
                          {owner && (
                            <button onClick={() => setShareTarget({ id: file.id, name: file.name })} className="underline">
                              Share
                            </button>
                          )}
                          {editable && (
                            <button onClick={() => trashFileItem(file.id)} className="text-red-600 underline">
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {view === "drive" &&
                !loading &&
                !searchResults &&
                folders.length === 0 &&
                files.length === 0 && <p className="text-sm text-gray-500">Empty folder. Drag files here to upload.</p>}
              {view !== "drive" && !loading && !searchResults && listFiles.length === 0 && folders.length === 0 && trashFolders.length === 0 && (
                <p className="text-sm text-gray-500">Nothing here.</p>
              )}
              {searchResults && searchResults.length === 0 && (
                <p className="text-sm text-gray-500">No files found.</p>
              )}
            </div>
          )}
        </main>
      </div>

      {moveTarget && (
        <MoveDialog
          itemType={moveTarget.type}
          itemName={moveTarget.name}
          excludeFolderId={moveTarget.type === "folder" ? moveTarget.id : undefined}
          onCancel={() => setMoveTarget(null)}
          onConfirm={confirmMove}
        />
      )}

      {shareTarget && (
        <ShareDialog fileId={shareTarget.id} fileName={shareTarget.name} onClose={() => setShareTarget(null)} />
      )}
    </div>
  );
}
