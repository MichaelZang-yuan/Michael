"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  department: string;
  created_at: string | null;
};

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales: "Sales",
};

const inputClass =
  "rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full";

const selectClass =
  "rounded-lg border border-white/20 bg-blue-900 px-4 py-3 text-white focus:border-blue-400 focus:outline-none w-full";

export default function UsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "sales",
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
        .select("id, full_name, email, role, department, created_at")
        .eq("id", session.user.id)
        .single();

      if (profileData) setCurrentUser(profileData as unknown as Profile);

      const { data: usersData, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, department, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Users] fetch error:", error);
      }
      if (usersData) setUsers(usersData as unknown as Profile[]);

      setIsLoading(false);
    }

    init();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

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
        role: form.role,
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
      text: "✅ User created! They can login with password: Welcome123!",
    });
    setForm({ email: "", full_name: "", role: "sales", department: "china" });
    setShowInviteForm(false);

    // 刷新用户列表
    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, department, created_at")
      .order("created_at", { ascending: false });
    if (usersData) setUsers(usersData as unknown as Profile[]);

    setIsSubmitting(false);
  };

  const handleDelete = async (id: string, role: string) => {
    if (role === "admin") return;
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

  const isAdmin = currentUser?.role === "admin";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-950">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-blue-950 text-white">
        <Navbar />
        <main className="mx-auto max-w-6xl px-6 py-20 text-center">
          <p className="text-2xl font-bold text-red-400">Access Denied</p>
          <p className="text-white/50 mt-2">You do not have permission to view this page.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Users</h2>
            <p className="text-white/50 mt-1">{users.length} total</p>
          </div>
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
          >
            Invite User
          </button>
        </div>

        {showInviteForm && (
          <form onSubmit={handleInvite} className="mb-10 rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-bold mb-4">Invite New User</h3>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-white/70">Email *</label>
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
                <label className="text-sm font-semibold text-white/70">Full Name *</label>
                <input
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  required
                  placeholder="John Doe"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-white/70">Role</label>
                <select name="role" value={form.role} onChange={handleChange} className={selectClass}>
                  <option value="admin" className="bg-blue-900 text-white">Admin</option>
                  <option value="sales" className="bg-blue-900 text-white">Sales</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-white/70">Department</label>
                <select name="department" value={form.department} onChange={handleChange} className={selectClass}>
                  <option value="china" className="bg-blue-900 text-white">China</option>
                  <option value="thailand" className="bg-blue-900 text-white">Thailand</option>
                  <option value="myanmar" className="bg-blue-900 text-white">Myanmar</option>
                  <option value="korea_japan" className="bg-blue-900 text-white">Korea & Japan</option>
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
          <p className={`mb-6 ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {message.text}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Department</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Created At</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-white/10 hover:bg-white/5 last:border-b-0">
                  <td className="px-6 py-4 font-semibold">{user.full_name ?? "—"}</td>
                  <td className="px-6 py-4 text-white/70">{user.email ?? "—"}</td>
                  <td className="px-6 py-4 text-white/70">{ROLE_LABELS[user.role] ?? user.role}</td>
                  <td className="px-6 py-4 text-white/70">{DEPT_LABELS[user.department] ?? user.department}</td>
                  <td className="px-6 py-4 text-white/70">
                    {user.created_at ? new Date(user.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-6 py-4">
                    {user.role !== "admin" && (
                      <button
                        onClick={() => handleDelete(user.id, user.role)}
                        disabled={isDeleting === user.id}
                        className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {isDeleting === user.id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
