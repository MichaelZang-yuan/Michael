"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile: string | null;
  type: string;
  current_visa_type: string | null;
  on_offshore: string | null;
  department: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

function escapeCsvValue(val: string): string {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filters, setFilters] = useState({
    department: "all",
    type: "all",
    on_offshore: "all",
    search: "",
  });

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase
        .from("profiles").select("role, roles, department").eq("id", session.user.id).single();

      const admin = hasRole(profileData, "admin");
      setIsAdmin(admin);

      let query = supabase
        .from("contacts")
        .select("id, first_name, last_name, email, mobile, type, current_visa_type, on_offshore, department, created_at, profiles!contacts_assigned_sales_id_fkey(full_name)")
        .order("created_at", { ascending: false });

      if (!admin && profileData?.department) {
        query = query.eq("department", profileData.department);
      }

      const { data } = await query;
      if (data) setContacts(data as unknown as Contact[]);
      setIsLoading(false);
    }
    fetchData();
  }, [router]);

  const filtered = contacts.filter((c) => {
    if (filters.department !== "all" && c.department !== filters.department) return false;
    if (filters.type !== "all" && c.type !== filters.type) return false;
    if (filters.on_offshore !== "all" && c.on_offshore !== filters.on_offshore) return false;
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      const name = `${c.first_name} ${c.last_name}`.toLowerCase();
      if (!name.includes(q) && !(c.email ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleExportCsv = () => {
    const headers = ["First Name", "Last Name", "Email", "Mobile", "Type", "Visa Type", "On/Offshore", "Department", "Sales", "Created Date"];
    const rows = filtered.map((c) => [
      escapeCsvValue(c.first_name),
      escapeCsvValue(c.last_name),
      escapeCsvValue(c.email ?? ""),
      escapeCsvValue(c.mobile ?? ""),
      escapeCsvValue(c.type),
      escapeCsvValue(c.current_visa_type ?? ""),
      escapeCsvValue(c.on_offshore ?? ""),
      escapeCsvValue(c.department ? DEPT_LABELS[c.department] ?? c.department : ""),
      escapeCsvValue(c.profiles?.full_name ?? ""),
      escapeCsvValue(new Date(c.created_at).toLocaleDateString()),
    ]);
    const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "contacts-export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const filterSelectClass = "rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-blue-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Contacts</h2>
            <p className="text-sm text-gray-500 dark:text-white/50 mt-1">{filtered.length} total</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button onClick={handleExportCsv} disabled={filtered.length === 0} className="rounded-lg border border-gray-300 dark:border-white/20 px-5 py-2.5 font-bold hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 text-sm">
              Export CSV
            </button>
            <Link href="/contacts/new" className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">
              + Add Contact
            </Link>
          </div>
        </div>

        {/* Filters */}
        {!isLoading && contacts.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 sm:flex-row sm:flex-wrap sm:items-center">
            {isAdmin && (
              <select value={filters.department} onChange={(e) => setFilters(f => ({ ...f, department: e.target.value }))} className={filterSelectClass}>
                <option value="all" className="bg-white dark:bg-blue-900">All Departments</option>
                <option value="china" className="bg-white dark:bg-blue-900">China</option>
                <option value="thailand" className="bg-white dark:bg-blue-900">Thailand</option>
                <option value="myanmar" className="bg-white dark:bg-blue-900">Myanmar</option>
                <option value="korea_japan" className="bg-white dark:bg-blue-900">Korea & Japan</option>
              </select>
            )}
            <select value={filters.type} onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))} className={filterSelectClass}>
              <option value="all" className="bg-white dark:bg-blue-900">All Types</option>
              <option value="lead" className="bg-white dark:bg-blue-900">Lead</option>
              <option value="client" className="bg-white dark:bg-blue-900">Client</option>
            </select>
            <select value={filters.on_offshore} onChange={(e) => setFilters(f => ({ ...f, on_offshore: e.target.value }))} className={filterSelectClass}>
              <option value="all" className="bg-white dark:bg-blue-900">All Locations</option>
              <option value="onshore" className="bg-white dark:bg-blue-900">Onshore</option>
              <option value="offshore" className="bg-white dark:bg-blue-900">Offshore</option>
            </select>
            <input
              type="text" value={filters.search} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Search by name or email..."
              className="flex-1 min-w-[180px] rounded-lg border border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-white/30 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
            />
            <button onClick={() => setFilters({ department: "all", type: "all", on_offshore: "all", search: "" })} className="rounded-lg border border-gray-300 dark:border-white/20 px-4 py-2 text-sm font-bold hover:bg-gray-100 dark:hover:bg-white/10">
              Clear
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="text-gray-500 dark:text-white/50 text-center py-20">Loading...</p>
        ) : contacts.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-12 text-center">
            <p className="text-xl font-bold mb-2">No contacts yet</p>
            <p className="text-gray-500 dark:text-white/50 mb-6">Add your first contact to get started.</p>
            <Link href="/contacts/new" className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">+ Add Contact</Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-gray-500 dark:text-white/50">No contacts match the current filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Mobile</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Visa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Dept</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-white/70">Sales</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-gray-200 dark:border-white/10 last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => router.push(`/contacts/${c.id}`)}>
                    <td className="px-4 py-3 text-sm font-semibold">
                      <Link href={`/contacts/${c.id}`} className="hover:text-blue-700 dark:text-blue-400 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.first_name} {c.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-white/70">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-white/70">{c.mobile ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${c.type === "client" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-white/70">{c.current_visa_type ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-white/70 capitalize">{c.on_offshore ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-white/70">{c.department ? DEPT_LABELS[c.department] ?? c.department : "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-white/70">{c.profiles?.full_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
