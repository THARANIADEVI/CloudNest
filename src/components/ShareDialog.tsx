"use client";

import { FormEvent, useEffect, useState } from "react";

type UserShare = { id: string; role: string; sharedWith: { email: string } };

export default function ShareDialog({
  fileId,
  fileName,
  onClose,
}: {
  fileId: string;
  fileName: string;
  onClose: () => void;
}) {
  const [shares, setShares] = useState<UserShare[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState("");

  const [password, setPassword] = useState("");
  const [expiresInHours, setExpiresInHours] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadShares() {
    const res = await fetch(`/api/files/${fileId}/shares`);
    if (res.ok) {
      const data = await res.json();
      setShares(data.shares);
    }
  }

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/files/${fileId}/shares`);
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares);
      }
    })();
  }, [fileId]);

  async function addShare(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/files/${fileId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (res.ok) {
      setEmail("");
      loadShares();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to share");
    }
  }

  async function removeShare(shareId: string) {
    await fetch(`/api/files/${fileId}/shares/${shareId}`, { method: "DELETE" });
    loadShares();
  }

  async function createLink() {
    setError("");
    const res = await fetch(`/api/files/${fileId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(password ? { password } : {}),
        ...(expiresInHours ? { expiresInHours: Number(expiresInHours) } : {}),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setLinkUrl(`${window.location.origin}${data.url}`);
      setCopied(false);
    } else {
      setError("Failed to create link");
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(linkUrl).catch(() => {});
    setCopied(true);
  }

  async function revokeLink() {
    await fetch(`/api/files/${fileId}/share`, { method: "DELETE" });
    setLinkUrl("");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-4 space-y-4">
        <h2 className="font-semibold text-sm">Share &quot;{fileName}&quot;</h2>

        <section className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 uppercase">People</h3>
          <form onSubmit={addShare} className="flex items-center gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 border rounded px-2 py-1.5 text-sm min-w-0"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button type="submit" className="bg-black text-white rounded px-3 py-1.5 text-sm">
              Add
            </button>
          </form>

          <div className="space-y-1">
            {shares.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm px-1">
                <span className="truncate">
                  {s.sharedWith.email} <span className="text-gray-400">· {s.role}</span>
                </span>
                <button onClick={() => removeShare(s.id)} className="text-red-600 underline shrink-0">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2 border-t pt-3">
          <h3 className="text-xs font-medium text-gray-500 uppercase">Public link</h3>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (optional)"
              className="flex-1 border rounded px-2 py-1.5 text-sm min-w-0"
            />
            <input
              type="number"
              min={1}
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
              placeholder="Expires in (hrs)"
              className="w-32 border rounded px-2 py-1.5 text-sm"
            />
            <button onClick={createLink} className="border rounded px-3 py-1.5 text-sm">
              Generate
            </button>
          </div>
          {linkUrl && (
            <div className="flex items-center gap-2">
              <input readOnly value={linkUrl} className="flex-1 border rounded px-2 py-1.5 text-sm min-w-0" />
              <button onClick={copyLink} className="border rounded px-3 py-1.5 text-sm shrink-0">
                {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={revokeLink} className="text-red-600 underline text-sm shrink-0">
                Revoke
              </button>
            </div>
          )}
        </section>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="border rounded px-3 py-1.5 text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
