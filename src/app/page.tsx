"use client";

import { ChangeEvent, DragEvent, FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MoveDialog from "@/components/MoveDialog";
import ShareDialog from "@/components/ShareDialog";
import VersionsDialog from "@/components/VersionsDialog";
import TagsDialog from "@/components/TagsDialog";

type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  deletedAt?: string | null;
  createdAt?: string;
};

type Tag = { id: string; name: string };

type FileItem = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  folderId: string | null;
  starred: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  role?: "owner" | "editor" | "viewer";
  tags?: Tag[];
  ownerName?: string;
};

type Crumb = { id: string | null; name: string };
type View = "drive" | "starred" | "shared" | "trash" | "activity";

const NAV_ICONS: Record<View, ReactNode> = {
  drive: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px] shrink-0">
      <path d="M3 10.5 12 4l9 6.5V19a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  ),
  starred: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px] shrink-0">
      <path d="M12 3.5 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 9.9l6-.9z" strokeLinejoin="round" />
    </svg>
  ),
  shared: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px] shrink-0">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16 4.5a3 3 0 0 1 0 6M20 20c0-2.5-1.8-4.4-4-4.9" strokeLinecap="round" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px] shrink-0">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.8 12.1A2 2 0 0 1 14.2 21H9.8a2 2 0 0 1-2-1.9L7 7" strokeLinejoin="round" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px] shrink-0">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

type Activity = {
  id: string;
  action: string;
  targetType: string;
  targetName: string;
  createdAt: string;
  actor: { name: string; email: string };
};

const ACTION_LABELS: Record<string, string> = {
  upload: "uploaded",
  new_version: "uploaded a new version of",
  restore_version: "restored a previous version of",
  rename: "renamed",
  move: "moved",
  star: "starred",
  unstar: "unstarred",
  trash: "moved to trash",
  restore: "restored",
  delete_forever: "permanently deleted",
  share: "shared",
  unshare: "unshared",
  create_link: "created a share link for",
  revoke_link: "revoked the share link for",
  create_folder: "created folder",
  rename_folder: "renamed folder",
  move_folder: "moved folder",
  trash_folder: "moved folder to trash",
  restore_folder: "restored folder",
  delete_folder_forever: "permanently deleted folder",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
  const sidebarUploadRef = useRef<HTMLInputElement>(null);

  const [checkedAuth, setCheckedAuth] = useState(false);
  const [userName, setUserName] = useState("");

  const [view, setView] = useState<View>("drive");
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "My files" }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [trashFolders, setTrashFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ index: number; total: number; percent: number } | null>(
    null
  );
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [searchResults, setSearchResults] = useState<FileItem[] | null>(null);

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [quota, setQuota] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);

  const [moveTarget, setMoveTarget] = useState<
    { type: "file" | "folder"; id: string; name: string } | null
  >(null);
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string } | null>(null);
  const [versionsTarget, setVersionsTarget] = useState<{ id: string; name: string; canEdit: boolean } | null>(
    null
  );
  const [tagsTarget, setTagsTarget] = useState<FileItem | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);

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

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/activity");
    if (res.ok) {
      const data = await res.json();
      setActivities(data.activities);
    } else {
      setError("Failed to load activity");
    }
    setLoading(false);
  }, []);

  const loadTags = useCallback(async () => {
    const res = await fetch("/api/tags");
    if (res.ok) {
      const data = await res.json();
      setAllTags(data.tags);
    }
  }, []);

  const loadQuota = useCallback(async () => {
    const res = await fetch("/api/quota");
    if (res.ok) setQuota(await res.json());
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
      loadTags();
      loadQuota();
    })();
  }, [router, loadTags, loadQuota]);

  useEffect(() => {
    if (!checkedAuth) return;
    if (view === "drive") loadFolder(currentFolderId);
    else if (view === "starred") loadStarred();
    else if (view === "shared") loadShared();
    else if (view === "trash") loadTrash();
    else if (view === "activity") loadActivity();
  }, [checkedAuth, view, currentFolderId, loadFolder, loadStarred, loadShared, loadTrash, loadActivity]);

  function refresh() {
    if (view === "drive") loadFolder(currentFolderId);
    else if (view === "starred") loadStarred();
    else if (view === "shared") loadShared();
    else if (view === "trash") loadTrash();
    else if (view === "activity") loadActivity();
    loadQuota();
  }

  function startNewFolder() {
    setNewMenuOpen(false);
    if (view !== "drive") switchView("drive");
    createFolder();
  }

  function startUpload() {
    setNewMenuOpen(false);
    if (view !== "drive") switchView("drive");
    sidebarUploadRef.current?.click();
  }

  function switchView(v: View) {
    setView(v);
    setCrumbs([{ id: null, name: "My files" }]);
    setQuery("");
    setTypeFilter("");
    setTagFilter("");
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

  function uploadOne(file: File, onProgress: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      if (currentFolderId) formData.append("folderId", currentFolderId);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/files");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          const message = (() => {
            try {
              return JSON.parse(xhr.responseText).error as string;
            } catch {
              return `Upload failed: ${file.name}`;
            }
          })();
          reject(new Error(message));
        }
      };
      xhr.onerror = () => reject(new Error(`Upload failed: ${file.name}`));
      xhr.send(formData);
    });
  }

  async function uploadFiles(fileList: FileList | File[]) {
    setUploading(true);
    setError("");
    const filesArr = Array.from(fileList);
    for (let i = 0; i < filesArr.length; i++) {
      const file = filesArr[i];
      setUploadProgress({ index: i + 1, total: filesArr.length, percent: 0 });
      try {
        await uploadOne(file, (percent) =>
          setUploadProgress({ index: i + 1, total: filesArr.length, percent })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : `Upload failed: ${file.name}`);
      }
    }
    setUploadProgress(null);
    setUploading(false);
    loadFolder(currentFolderId);
    loadQuota();
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
    if (res.ok) {
      loadTrash();
      loadQuota();
    } else setError("Delete failed");
  }

  async function deleteFolderForever(id: string) {
    if (!window.confirm("Permanently delete this folder and everything inside it? This cannot be undone.")) return;
    const res = await fetch(`/api/folders/${id}/permanent`, { method: "DELETE" });
    if (res.ok) {
      loadTrash();
      loadQuota();
    } else setError("Delete failed");
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

  async function saveTagsForFile(file: FileItem, names: string[]) {
    const tagIds: string[] = [];
    for (const name of names) {
      const existing = allTags.find((t) => t.name === name);
      if (existing) {
        tagIds.push(existing.id);
        continue;
      }
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) tagIds.push((await res.json()).id);
    }

    const res = await fetch(`/api/files/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds }),
    });
    if (res.ok) {
      loadTags();
      refresh();
    } else {
      setError("Failed to update tags");
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
    if (!query.trim() && !typeFilter && !tagFilter) {
      setSearchResults(null);
      return;
    }
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (typeFilter) params.set("type", typeFilter);
    if (tagFilter) params.set("tag", tagFilter);
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
    <div className="flex-1 flex flex-col sm:flex-row">
      <aside className="w-full sm:w-56 border-b sm:border-b-0 sm:border-r shrink-0 p-3 text-sm flex flex-col sm:h-full bg-white">
        <div className="flex items-center gap-2 px-2 pb-4">
          <span className="text-xl">🗂️</span>
          <span className="font-semibold text-lg">CloudNest</span>
        </div>

        <div className="relative px-2 pb-4">
          <button
            onClick={() => setNewMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-2xl border shadow-sm px-4 py-2.5 text-sm font-medium hover:shadow-md transition-shadow"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            New
          </button>
          {newMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNewMenuOpen(false)} />
              <div className="absolute left-2 top-full mt-1 z-20 w-44 bg-white border rounded-lg shadow-lg py-1">
                <button onClick={startNewFolder} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2">
                  <span>📁</span> New folder
                </button>
                <button onClick={startUpload} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2">
                  <span>📄</span> Upload file
                </button>
              </div>
            </>
          )}
          <input
            ref={sidebarUploadRef}
            type="file"
            multiple
            className="hidden"
            onChange={onUploadChange}
          />
        </div>

        <div className="flex flex-row sm:flex-col gap-1 overflow-x-auto sm:overflow-visible">
          {(
            [
              ["drive", "My Drive"],
              ["starred", "Starred"],
              ["shared", "Shared with me"],
              ["trash", "Trash"],
              ["activity", "Activity"],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={`flex items-center gap-3 text-left rounded-full px-4 py-2 whitespace-nowrap sm:w-full transition-colors ${
                view === v ? "bg-blue-100 text-blue-800 font-medium" : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              {NAV_ICONS[v]}
              {label}
            </button>
          ))}
        </div>
        {quota && (
          <div className="sm:mt-auto px-4 pt-4 text-xs text-gray-500">
            <div className="flex items-center gap-2 pb-2 text-gray-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 shrink-0">
                <path d="M6 18a4 4 0 0 1-1-7.9 5 5 0 0 1 9.6-2A4.5 4.5 0 0 1 18 18H6Z" strokeLinejoin="round" />
              </svg>
              Storage
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${quota.usedBytes / quota.quotaBytes > 0.9 ? "bg-red-500" : "bg-blue-600"}`}
                style={{ width: `${Math.min(100, (quota.usedBytes / quota.quotaBytes) * 100)}%` }}
              />
            </div>
            <div className="pt-1">
              {formatSize(quota.usedBytes)} of {formatSize(quota.quotaBytes)} used
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <form onSubmit={runSearch} className="w-full sm:flex-1 sm:max-w-md flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full sm:w-auto sm:flex-1 border rounded px-3 py-1.5 text-sm"
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
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm shrink-0"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
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
          <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b">
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
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={createFolder} className="border rounded px-3 py-1.5 text-sm">
                New folder
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-black text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {uploadProgress
                  ? `Uploading ${uploadProgress.index}/${uploadProgress.total} — ${uploadProgress.percent}%`
                  : "Upload file"}
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onUploadChange} />
            </div>
          </div>
        )}

        {uploadProgress && (
          <div className="px-4 sm:px-6 pb-1 -mt-2">
            <div className="h-1.5 w-full max-w-xs rounded bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-black transition-[width]"
                style={{ width: `${uploadProgress.percent}%` }}
              />
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
          className={`flex-1 p-4 sm:p-6 relative ${dragging ? "bg-blue-50" : ""}`}
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
          ) : view === "activity" ? (
            <div className="space-y-1">
              {activities.length === 0 && <p className="text-sm text-gray-500">No activity yet.</p>}
              {activities.map((a) => (
                <div key={a.id} className="border rounded px-3 py-2 text-sm">
                  <span className="font-medium">{a.actor.name}</span>{" "}
                  <span className="text-gray-600">{ACTION_LABELS[a.action] ?? a.action}</span>{" "}
                  <span className="font-medium">{a.targetName}</span>
                  <span className="text-gray-400"> · {new Date(a.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-normal">Name</th>
                  <th className="py-2 px-3 font-normal hidden sm:table-cell">Owner</th>
                  <th className="py-2 px-3 font-normal hidden sm:table-cell">Last modified</th>
                  <th className="py-2 px-3 font-normal hidden sm:table-cell">File size</th>
                  <th className="py-2 pl-3 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {view === "drive" &&
                  !searchResults &&
                  folders.map((folder) => (
                    <tr key={folder.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-3 min-w-0">
                        <button onClick={() => openFolder(folder)} className="flex items-center gap-2 text-left w-full min-w-0">
                          <span>📁</span>
                          <span className="truncate">{folder.name}</span>
                        </button>
                      </td>
                      <td className="py-2 px-3 text-gray-500 hidden sm:table-cell">me</td>
                      <td className="py-2 px-3 text-gray-500 hidden sm:table-cell whitespace-nowrap">
                        {formatDate(folder.createdAt)}
                      </td>
                      <td className="py-2 px-3 text-gray-400 hidden sm:table-cell">—</td>
                      <td className="py-2 pl-3">
                        <div className="flex items-center gap-3 flex-wrap justify-end">
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
                      </td>
                    </tr>
                  ))}

                {view === "trash" &&
                  trashFolders.map((folder) => (
                    <tr key={folder.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-3 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span>📁</span>
                          <span className="truncate">{folder.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-gray-500 hidden sm:table-cell">me</td>
                      <td className="py-2 px-3 text-gray-500 hidden sm:table-cell whitespace-nowrap">
                        {formatDate(folder.createdAt)}
                      </td>
                      <td className="py-2 px-3 text-gray-400 hidden sm:table-cell">—</td>
                      <td className="py-2 pl-3">
                        <div className="flex items-center gap-3 flex-wrap justify-end">
                          <button onClick={() => restoreFolder(folder.id)} className="underline">
                            Restore
                          </button>
                          <button onClick={() => deleteFolderForever(folder.id)} className="text-red-600 underline">
                            Delete forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {listFiles.map((file) => {
                  const previewable =
                    file.mimeType.startsWith("image/") ||
                    file.mimeType === "application/pdf" ||
                    file.mimeType === "text/plain";
                  const owner = isOwner(file);
                  const editable = canEditFile(file);
                  return (
                    <tr key={file.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-3 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span>📄</span>
                          <span className="truncate">{file.name}</span>
                          {!owner && <span className="text-gray-400 shrink-0">({file.role})</span>}
                          {file.tags && file.tags.length > 0 && (
                            <span className="flex items-center gap-1 shrink-0">
                              {file.tags.map((t) => (
                                <span key={t.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                  {t.name}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-gray-500 hidden sm:table-cell">
                        {owner ? "me" : (file.ownerName ?? "—")}
                      </td>
                      <td className="py-2 px-3 text-gray-500 hidden sm:table-cell whitespace-nowrap">
                        {formatDate(file.createdAt)}
                      </td>
                      <td className="py-2 px-3 text-gray-500 hidden sm:table-cell whitespace-nowrap">
                        {formatSize(file.size)}
                      </td>
                      <td className="py-2 pl-3">
                        <div className="flex items-center gap-3 flex-wrap justify-end">
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
                              <button
                                onClick={() => setVersionsTarget({ id: file.id, name: file.name, canEdit: editable })}
                                className="underline"
                              >
                                Versions
                              </button>
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
                                <button onClick={() => setTagsTarget(file)} className="underline">
                                  Tags
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
                      </td>
                    </tr>
                  );
                })}

                {view === "drive" &&
                  !loading &&
                  !searchResults &&
                  folders.length === 0 &&
                  files.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-sm text-gray-500">
                        Empty folder. Drag files here to upload.
                      </td>
                    </tr>
                  )}
                {view !== "drive" &&
                  !loading &&
                  !searchResults &&
                  listFiles.length === 0 &&
                  folders.length === 0 &&
                  trashFolders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-sm text-gray-500">
                        Nothing here.
                      </td>
                    </tr>
                  )}
                {searchResults && searchResults.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-sm text-gray-500">
                      No files found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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

      {versionsTarget && (
        <VersionsDialog
          fileId={versionsTarget.id}
          fileName={versionsTarget.name}
          canEdit={versionsTarget.canEdit}
          onClose={() => setVersionsTarget(null)}
          onRestored={refresh}
        />
      )}

      {tagsTarget && (
        <TagsDialog
          fileName={tagsTarget.name}
          initialTags={tagsTarget.tags ?? []}
          allTags={allTags}
          onClose={() => setTagsTarget(null)}
          onSave={(names) => saveTagsForFile(tagsTarget, names)}
        />
      )}
    </div>
  );
}
