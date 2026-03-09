"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type Company = {
  id: string;
  company_name: string;
  trading_name: string | null;
  email: string | null;
  phone: string | null;
  accreditation_status: string | null;
  region: string | null;
  department: string | null;
  profiles: { full_name: string | null } | null;
};

const DEPT_LABELS: Record<string, string> = {
  china: "China", thailand: "Thailand", myanmar: "Myanmar", korea_japan: "Korea & Japan",
};

const ACCREDITATION_COLORS: Record<string, string> = {
  none: "bg-gray-500/20 text-gray-400",
  standard: "bg-blue-500/20 text-blue-400",
  high_volume: "bg-green-500/20 text-green-400",
};

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filters, setFilters] = useState({ department: "all", accreditation: "all", search: "" });

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data: profileData } = await supabase.from("profiles").select("role, department").eq("id", session.user.id).single();
      const admin = profileData?.role === "admin";
      setIsAdmin(admin);

      let query = supabase
        .from("companies")
        .select("id, company_name, trading_name, email, phone, accreditation_status, region, department, profiles!companies_assigned_sales_id_fkey(full_name)")
        .order("created_at", { ascending: false });

      if (!admin && profileData?.department) query = query.eq("department", profileData.department);

      const { data } = await query;
      if (data) setCompanies(data as unknown as Company[]);
      setIsLoading(false);
    }
    fetchData();
  }, [router]);

  const filtered = companies.filter((c) => {
    if (filters.department !== "all" && c.department !== filters.department) return false;
    if (filters.accreditation !== "all" && c.accreditation_status !== filters.accreditation) return false;
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      if (!c.company_name.toLowerCase().includes(q) && !(c.trading_name ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filterSelectClass = "rounded-lg border border-white/20 bg-blue-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none";

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Companies</h2>
            <p className="text-sm text-white/50 mt-1">{filtered.length} total</p>
          </div>
          <Link href="/companies/new" className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">
            + Add Company
          </Link>
        </div>

        {!isLoading && companies.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:flex-wrap sm:items-center">
            {isAdmin && (
              <select value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))} className={filterSelectClass}>
                <option value="all" className="bg-blue-900">All Departments</option>
                <option value="china" className="bg-blue-900">China</option>
                <option value="thailand" className="bg-blue-900">Thailand</option>
                <option value="myanmar" className="bg-blue-900">Myanmar</option>
                <option value="korea_japan" className="bg-blue-900">Korea & Japan</option>
              </select>
            )}
            <select value={filters.accreditation} onChange={e => setFilters(f => ({ ...f, accreditation: e.target.value }))} className={filterSelectClass}>
              <option value="all" className="bg-blue-900">All Accreditation</option>
              <option value="none" className="bg-blue-900">None</option>
              <option value="standard" className="bg-blue-900">Standard</option>
              <option value="high_volume" className="bg-blue-900">High Volume</option>
            </select>
            <input
              type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Search company name..."
              className="flex-1 min-w-[180px] rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
            />
            <button onClick={() => setFilters({ department: "all", accreditation: "all", search: "" })} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">
              Clear
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="text-white/50 text-center py-20">Loading...</p>
        ) : companies.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-xl font-bold mb-2">No companies yet</p>
            <p className="text-white/50 mb-6">Add your first employer or company client.</p>
            <Link href="/companies/new" className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">+ Add Company</Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-white/50">No companies match the current filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Company Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Trading Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Accreditation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Region</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Dept</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Sales</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5 cursor-pointer" onClick={() => router.push(`/companies/${c.id}`)}>
                    <td className="px-4 py-3 text-sm font-semibold">
                      <Link href={`/companies/${c.id}`} className="hover:text-blue-400 hover:underline" onClick={e => e.stopPropagation()}>{c.company_name}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70">{c.trading_name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-white/70">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-white/70">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${ACCREDITATION_COLORS[c.accreditation_status ?? "none"] ?? "bg-gray-500/20 text-gray-400"}`}>
                        {c.accreditation_status?.replace("_", " ") ?? "none"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70">{c.region ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-white/70">{c.department ? DEPT_LABELS[c.department] ?? c.department : "—"}</td>
                    <td className="px-4 py-3 text-xs text-white/70">{c.profiles?.full_name ?? "—"}</td>
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
