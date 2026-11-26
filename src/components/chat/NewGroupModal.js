"use client";

import { useState } from "react";
import AvatarBadge from "./AvatarBadge";

export default function NewGroupModal({
  isOpen,
  users,
  onlineUserIds,
  onClose,
  onCreateGroup,
}) {
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  function toggleMember(userId) {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");

    if (groupName.trim().length < 2) {
      setErrorMessage("Enter a group name (at least 2 characters).");
      return;
    }

    if (selectedIds.length === 0) {
      setErrorMessage("Select at least 1 person to add to the group.");
      return;
    }

    setIsCreating(true);
    try {
      await onCreateGroup({
        name: groupName.trim(),
        memberIds: selectedIds,
      });
      setGroupName("");
      setSearch("");
      setSelectedIds([]);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Unable to create group."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111b21] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            New Group Chat
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="h-8 w-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="group-name"
              className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1.5"
            >
              Group Name
            </label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Project Team"
              className="w-full h-11 rounded-full bg-neutral-100 dark:bg-[#0b141a] border border-neutral-200 dark:border-neutral-700 px-4 text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:border-[#2b8c98]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                Add Members ({selectedIds.length} selected)
              </span>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full h-10 rounded-full bg-neutral-100 dark:bg-[#0b141a] border border-neutral-200 dark:border-neutral-700 px-4 text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-[#2b8c98] mb-2"
            />

            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {filteredUsers.length === 0 ? (
                <p className="py-6 text-center text-xs text-neutral-500">
                  No users found.
                </p>
              ) : (
                filteredUsers.map((person) => {
                  const selected = selectedIds.includes(person.id);
                  const online = onlineUserIds.has(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => toggleMember(person.id)}
                      className={`w-full flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition cursor-pointer ${
                        selected
                          ? "bg-[#2b8c98]/12 dark:bg-[#2b8c98]/20"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarBadge
                          src={person.avatarUrl}
                          name={person.displayName}
                          isOnline={online}
                          showPresence
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            {person.displayName}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                            {person.username
                              ? `@${person.username}`
                              : person.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`h-5 w-5 rounded-full border flex items-center justify-center text-xs ${
                          selected
                            ? "bg-[#2b8c98] border-[#2b8c98] text-white"
                            : "border-neutral-300 dark:border-neutral-600"
                        }`}
                      >
                        {selected ? "✓" : ""}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300"
            >
              {errorMessage}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full px-4 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="h-10 rounded-full bg-[#050505] dark:bg-[#2b8c98] px-5 text-sm font-medium text-white hover:bg-[#1f1f1f] dark:hover:bg-[#237782] disabled:opacity-60 cursor-pointer"
            >
              {isCreating ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
