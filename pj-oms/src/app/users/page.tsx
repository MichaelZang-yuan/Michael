"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { hasRole, formatRoles, ROLE_LABELS, VALID_ROLES, MAX_ROLES } from "@/lib/roles";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  roles: string[];
  department: string;
  created_at: string | null;
};

type LoginLog = {
  id: string;
  created_at: string;
  details: { email?: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

const inputClass =
  "rounded-lg border border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-white/10 px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-white/30 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none w-full";

const selectClass =
  "rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-blue-900 px-4 py-3 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none w-full";

function RolesCheckboxGroup({
  selected,
  onChange,
  className,
}: {
  selected: string[];
  onChange: (roles: string[]) => void;
  className?: string;
}) {
  const toggle = (role: string) => {
    if (selected.includes(role)) {
      if (selected.length <= 1) return; // must have at least 1
      onChange(selected.filter((r) => r !== role));
    } else {
      if (selected.length >= MAX_ROLES) return; // max 3
      onChange([...selected, role]);
    }
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {VALID_ROLES.map((role) => {
        const isSelected = selected.includes(role);
        const isDisabled = !isSelected && selected.length >= MAX_ROLES;
        return (
          <button
            key={role}
            type="button"
            onClick={() => toggle(role)}
            disabled={isDisabled}
            className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors ${
              isSelected
                ? "border-blue-400 bg-blue-600/30 text-blue-700 dark:text-blue-300"
                : isDisabled
                  ? "border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/20 cursor-not-allowed"
                  : "border-gray-300 dark:border-white/20 text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10"
            }`}
          >
            {ROLE_LABELS[role]}
          </button>
        );
      })}
    </div>
  );
}

function RoleBadges({ roles }: { roles: string[] }) {
  const colors: Record<string, string> = {
    admin: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
    sales: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
    lia: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400",
    accountant: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
    copywriter: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  };
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <span key={r} className={`rounded-full px-2 py-0.5 text-xs font-bold ${colors[r] ?? "bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400"}`}>
          {ROLE_LABELS[r] ?? r}
        </span>
      ))}
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ full_name: string; roles: string[]; department: string } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    roles: ["sales"] as string[],
    department: "china",
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, roles, department, created_at")
        .eq("id", session.user.id)
        .single();

      if (profileData) setCurrentUser(profileData as unknown as Profile);

      const { data: usersData, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, roles, department, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Users] fetch error:", error);
      }
      if (usersData) setUsers(usersData as unknown as Profile[]);

      const { data: logsData } = await supabase
        .from("activity_logs")
        .select("id, created_at, details, profiles(full_name, email)")
        .eq("action", "login")
        .eq("entity_type", "auth")
        .order("created_at", { ascending: false })
        .limit(50);
      if (logsData) setLoginLogs(logsData as unknown as LoginLog[]);

      setIsLoading(false);
    }

    init();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditClick = (user: Profile) => {
    setEditingUserId(user.id);
    setEditForm({
      full_name: user.full_name ?? "",
      roles: user.roles ?? [user.role],
      department: user.department,
    });
    setMessage(null);
  };

  const handleEditCancel = () => {
    setEditingUserId(null);
    setEditForm(null);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSave = async () => {
    if (!editingUserId || !editForm) return;
    setIsSavingEdit(true);
    setMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.full_name.trim() || null,
        roles: editForm.roles,
        department: editForm.department,
      })
      .eq("id", editingUserId);

    if (error) {
      setMessage({ type: "error", text: "Failed to update user." });
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUserId
            ? { ...u, full_name: editForm.full_name.trim() || null, roles: editForm.roles, role: editForm.roles[0], department: editForm.department }
            : u
        )
      );
      setMessage({ type: "success", text: "User updated." });
      setEditingUserId(null);
      setEditForm(null);
    }
    setIsSavingEdit(false);
  };

  const canEditUser = () => true;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        roles: form.roles,
        department: form.department,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Failed to create user." });
      setIsSubmitting(false);
      return;
    }

    setMessage({
      type: "success",
      text: "User created! They can login with password: Welcome123!",
    });
    setForm({ email: "", full_name: "", roles: ["sales"], department: "china" });
    setShowInviteForm(false);

    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, roles, department, created_at")
      .order("created_at", { ascending: false });
    if (usersData) setUsers(usersData as unknown as Profile[]);

    setIsSubmitting(false);
  };

  const handleDelete = async (id: string, user: Profile) => {
    if (hasRole(user, "admin")) return;
    if (!confirm("Are you sure you want to delete this user?")) return;

    setIsDeleting(id);

    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Users] delete error:", err);
      setMessage({ type: "error", text: err.error ?? "Failed to delete user." });
    } else {
      setUsers(users.filter((u) => u.id !== id));
      setMessage({ type: "success", text: "User deleted." });
    }
    setIsDeleting(null);
  };

  const isAdmin = hasRole(currentUser, "admin");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-blue-950">
        <p className="text-gray-500 dark:text-white/60">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
        <Navbar />
        <main className="mx-auto max-w-6xl px-6 py-20 text-center">
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">Access Denied</p>
          <p className="text-gray-500 dark:text-white/50 mt-2">You do not have permission to view this page.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Users</h2>
            <p className="text-gray-500 dark:text-white/50 mt-1">{users.length} total</p>
          </div>
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
          >
            Invite User
          </button>
        </div>

        {showInviteForm && (
          <form onSubmit={handleInvite} className="mb-10 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-6">
            <h3 className="text-lg font-bold mb-4">Invite New User</h3>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-600 dark:text-white/70">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="user@example.com"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-600 dark:text-white/70">Full Name *</label>
                <input
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  required
                  placeholder="John Doe"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-gray-600 dark:text-white/70">Roles (select up to {MAX_ROLES})</label>
                <RolesCheckboxGroup
                  selected={form.roles}
                  onChange={(roles) => setForm({ ...form, roles })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-600 dark:text-white/70">Department</label>
                <select name="department" value={form.department} onChange={handleChange} className={selectClass}>
                  <option value="china" className="bg-white dark:bg-blue-900 text-gray-900 dark:text-white">China</option>
                  <option value="thailand" className="bg-white dark:bg-blue-900 text-gray-900 dark:text-white">Thailand</option>
                  <option value="myanmar" className="bg-white dark:bg-blue-900 text-gray-900 dark:text-white">Myanmar</option>
                  <option value="korea_japan" className="bg-white dark:bg-blue-900 text-gray-900 dark:text-white">Korea & Japan</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 rounded-lg bg-green-600 px-6 py-2.5 font-bold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Send Invite"}
            </button>
          </form>
        )}

        {message && (
          <p className={`mb-6 ${message.type === "success" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
            {message.text}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-white/70">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-white/70">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-white/70">Roles</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-white/70">Department</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-white/70">Created At</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-white/70">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isEditing = editingUserId === user.id;
                const showEditButton = isAdmin && canEditUser();
                const userRoles = user.roles ?? [user.role];

                return (
                  <tr key={user.id} className="border-b border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 last:border-b-0">
                    {isEditing && editForm ? (
                      <>
                        <td className="px-6 py-4">
                          <input
                            name="full_name"
                            value={editForm.full_name}
                            onChange={handleEditChange}
                            className={`${inputClass} py-2 text-sm`}
                            placeholder="Full Name"
                          />
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-white/70">{user.email ?? "---"}</td>
                        <td className="px-6 py-4">
                          <RolesCheckboxGroup
                            selected={editForm.roles}
                            onChange={(roles) => setEditForm({ ...editForm, roles })}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <select
                            name="department"
                            value={editForm.department}
                            onChange={handleEditChange}
                            className={`${selectClass} py-2 text-sm`}
                          >
                            <option value="china" className="bg-white dark:bg-blue-900 text-gray-900 dark:text-white">China</option>
                            <option value="thailand" className="bg-white dark:bg-blue-900 text-gray-900 dark:text-white">Thailand</option>
                            <option value="myanmar" className="bg-white dark:bg-blue-900 text-gray-900 dark:text-white">Myanmar</option>
                            <option value="korea_japan" className="bg-white dark:bg-blue-900 text-gray-900 dark:text-white">Korea & Japan</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-white/70">
                          {user.created_at ? new Date(user.created_at).toLocaleString() : "---"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleEditSave}
                              disabled={isSavingEdit}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {isSavingEdit ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={handleEditCancel}
                              disabled={isSavingEdit}
                              className="rounded-lg border border-gray-300 dark:border-white/20 px-3 py-1.5 text-sm font-bold hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 font-semibold">{user.full_name ?? "---"}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-white/70">{user.email ?? "---"}</td>
                        <td className="px-6 py-4"><RoleBadges roles={userRoles} /></td>
                        <td className="px-6 py-4 text-gray-600 dark:text-white/70">{DEPT_LABELS[user.department] ?? user.department}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-white/70">
                          {user.created_at ? new Date(user.created_at).toLocaleString() : "---"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {showEditButton && (
                              <button
                                type="button"
                                onClick={() => handleEditClick(user)}
                                className="rounded-lg border border-gray-300 dark:border-white/20 px-3 py-1.5 text-sm font-bold hover:bg-gray-100 dark:hover:bg-white/10"
                              >
                                Edit
                              </button>
                            )}
                            {!hasRole(user, "admin") && (
                              <button
                                onClick={() => handleDelete(user.id, user)}
                                disabled={isDeleting === user.id}
                                className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm font-bold text-red-700 dark:text-red-400 hover:bg-red-100 dark:bg-red-500/20 disabled:opacity-50"
                              >
                                {isDeleting === user.id ? "Deleting..." : "Delete"}
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Login History */}
        <div className="mt-12">
          <h3 className="mb-4 text-xl font-bold">Login History</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
            <table className="w-full min-w-[400px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-white/70">Time</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-white/70">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-white/70">Email</th>
                </tr>
              </thead>
              <tbody>
                {loginLogs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-white/50">No login records yet.</td>
                  </tr>
                ) : (
                  loginLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 last:border-b-0">
                      <td className="px-6 py-4 text-gray-600 dark:text-white/70">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-semibold">{log.profiles?.full_name ?? "---"}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-white/70">
                        {log.profiles?.email ?? (log.details as { email?: string })?.email ?? "---"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
