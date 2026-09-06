"use client";

import { KeyboardEvent, useState } from "react";

type Tag = { id: string; name: string };

export default function TagsDialog({
  fileName,
  initialTags,
  allTags,
  onClose,
  onSave,
}: {
  fileName: string;
  initialTags: Tag[];
  allTags: Tag[];
  onClose: () => void;
  onSave: (names: string[]) => Promise<void>;
}) {
  const [tags, setTags] = useState<string[]>(initialTags.map((t) => t.name));
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const suggestions = allTags
    .map((t) => t.name)
    .filter((name) => !tags.includes(name) && name.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 6);

  function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((t) => [...t, trimmed]);
    setInput("");
  }

  function removeTag(name: string) {
    setTags((t) => t.filter((n) => n !== name));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  async function handleSave() {
    setSaving(true);
    await onSave(tags);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-4 space-y-3">
        <h2 className="font-semibold text-sm">
          Tags for &quot;{fileName}&quot;
        </h2>

        <div className="border rounded px-2 py-2 flex flex-wrap gap-1.5">
          {tags.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
            >
              {name}
              <button onClick={() => removeTag(name)} className="text-gray-400 hover:text-gray-700" aria-label={`Remove ${name}`}>
                ×
              </button>
            </span>
          ))}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={tags.length === 0 ? "Add a tag..." : ""}
            className="flex-1 min-w-[6rem] text-sm outline-none py-0.5"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((name) => (
              <button
                key={name}
                onClick={() => addTag(name)}
                className="rounded-full border px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                + {name}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="border rounded px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-black text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
