"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type Agent = {
  id: string;
  created_at: string;
  agent_name: string;
  email: string | null;
  phone: string | null;
  agent_type: string | null;
  commission_rate: number | null;
  notes: string | null;
  profiles: { full_name: string | null } | null;
};

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      const { data } = await supabase
        .from("agents")
        .select("id, created_at, agent_name, email, phone, agent_type, commission_rate, notes, profiles!agents_assigned_sales_id_fkey(full_name)")
        .order("created_at", { ascending: false });

      if (data) setAgents(data as unknown as Agent[]);
      setIsLoading(false);
    }
    fetchData();
  }, [router]);

  const filtered = agents.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.agent_name.toLowerCase().includes(q) ||
      (a.email ?? "").toLowerCase().includes(q) ||
      (a.phone ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Agents</h2>
            <p className="text-sm text-white/50 mt-1">{filtered.length} total</p>
          </div>
          <Link href="/agents/new" className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">
            + Add Agent
          </Link>
        </div>

        {/* Search */}
        <div className="mb-6 flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">
              Clear
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-white/50 text-center py-20">Loading...</p>
        ) : agents.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-xl font-bold mb-2">No agents yet</p>
            <p className="text-white/50 mb-6">Add your first agent/referrer.</p>
            <Link href="/agents/new" className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">
              + Add Agent
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[500px] border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Agent Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Commission %</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Sales</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((agent) => (
                  <tr key={agent.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm font-semibold">
                      <Link href={`/agents/${agent.id}`} className="hover:text-blue-400 hover:underline">
                        {agent.agent_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70 capitalize">{agent.agent_type ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-white/70">{agent.email ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-white/70">{agent.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-white/70">
                      {agent.commission_rate != null ? `${agent.commission_rate}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70">{agent.profiles?.full_name ?? "—"}</td>
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
