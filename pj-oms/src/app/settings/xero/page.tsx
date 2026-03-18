"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";

type Tenant = { tenantId: string; tenantName: string; tenantType: string };
type Mapping = {
  immigration: { tenantId: string | null; tenantName: string | null };
  international: { tenantId: string | null; tenantName: string | null };
};

function XeroSettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [immigrationId, setImmigrationId] = useState("");
  const [internationalId, setInternationalId] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastSync, setLastSync] = useState<{ time: string; details: Record<string, unknown> } | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: profileData } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!profileData || !hasRole(profileData, "admin")) { router.push("/crm"); return; }

      if (searchParams.get("connected") === "true") {
        setMessage({ type: "success", text: "Successfully connected to Xero!" });
      } else if (searchParams.get("error")) {
        setMessage({ type: "error", text: `Xero connection failed: ${searchParams.get("error")}` });
      }

      await fetchStatus();
      setIsLoading(false);
    }
    init();
  }, [router, searchParams]);

  const fetchStatus = async () => {
    try {
      const [statusRes, tenantsRes] = await Promise.all([
        fetch("/api/xero/status"),
        fetch("/api/xero/tenants"),
      ]);
      const statusData = await statusRes.json();
      setConnected(statusData.connected);
      setConnectedAt(statusData.connectedAt ?? null);

      if (statusData.connected) {
        const tenantsData = await tenantsRes.json();
        setTenants(tenantsData.tenants ?? []);
        setMapping(tenantsData.mapping ?? null);
        if (tenantsData.mapping) {
          setImmigrationId(tenantsData.mapping.immigration?.tenantId ?? "");
          setInternationalId(tenantsData.mapping.international?.tenantId ?? "");
        }
      }

      // Fetch last auto sync log
      const { data: syncLog } = await supabase
        .from("activity_logs")
        .select("created_at, details")
        .eq("action", "xero_auto_sync")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (syncLog) setLastSync({ time: syncLog.created_at, details: syncLog.details });
    } catch {}
  };

  const handleSaveMapping = async () => {
    setSaving(true);
    setMessage(null);
    const immTenant = tenants.find(t => t.tenantId === immigrationId);
    const intTenant = tenants.find(t => t.tenantId === internationalId);

    try {
      const res = await fetch("/api/xero/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id_immigration: immigrationId,
          tenant_name_immigration: immTenant?.tenantName ?? "",
          tenant_id_international: internationalId,
          tenant_name_international: intTenant?.tenantName ?? "",
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Tenant mapping saved!" });
        await fetchStatus();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Save failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
    setSaving(false);
  };

  const selectClass = "w-full rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-blue-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none";

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-blue-950"><p className="text-gray-500 dark:text-white/60">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-blue-950 text-gray-900 dark:text-white">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold mb-6">Xero Connection</h2>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${message.type === "success" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"}`}>
            {message.text}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Connection Status</h3>
            {connected ? (
              <div className="flex items-center gap-3">
                <span className="inline-block w-3 h-3 rounded-full bg-green-400"></span>
                <span className="text-green-700 dark:text-green-400 font-medium">Connected</span>
                {connectedAt && (
                  <span className="text-gray-500 dark:text-white/40 text-xs">since {new Date(connectedAt).toLocaleDateString()}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="inline-block w-3 h-3 rounded-full bg-red-400"></span>
                <span className="text-red-700 dark:text-red-400 font-medium">Not Connected</span>
              </div>
            )}
          </div>

          <a
            href="/api/xero/connect"
            className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold hover:bg-blue-500 transition-colors"
          >
            {connected ? "Reconnect to Xero" : "Connect to Xero"}
          </a>

          {connected && tenants.length > 0 && (
            <div className="border-t border-gray-200 dark:border-white/10 pt-6">
              <h3 className="text-lg font-semibold mb-4">Tenant Mapping</h3>
              <p className="text-gray-500 dark:text-white/50 text-sm mb-4">
                Map each Xero organisation to its CRM module. CRM invoices go to the Immigration tenant, commission invoices go to the International tenant.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-white/70 mb-1">
                    PJ Immigration Limited (CRM Invoices)
                  </label>
                  <select value={immigrationId} onChange={e => setImmigrationId(e.target.value)} className={selectClass}>
                    <option value="" className="bg-white dark:bg-blue-900">— Select tenant —</option>
                    {tenants.map(t => (
                      <option key={t.tenantId} value={t.tenantId} className="bg-white dark:bg-blue-900">{t.tenantName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-white/70 mb-1">
                    PJ International Limited (Commission Invoices)
                  </label>
                  <select value={internationalId} onChange={e => setInternationalId(e.target.value)} className={selectClass}>
                    <option value="" className="bg-white dark:bg-blue-900">— Select tenant —</option>
                    {tenants.map(t => (
                      <option key={t.tenantId} value={t.tenantId} className="bg-white dark:bg-blue-900">{t.tenantName}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSaveMapping}
                  disabled={saving || !immigrationId || !internationalId}
                  className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-bold hover:bg-green-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Save Mapping"}
                </button>
              </div>
            </div>
          )}

          {connected && mapping && (mapping.immigration.tenantName || mapping.international.tenantName) && (
            <div className="border-t border-gray-200 dark:border-white/10 pt-6">
              <h3 className="text-lg font-semibold mb-3">Current Mapping</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-white/50">CRM Invoices (Immigration):</span>
                  <span className="font-medium">{mapping.immigration.tenantName || "Not mapped"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-white/50">Commission Invoices (International):</span>
                  <span className="font-medium">{mapping.international.tenantName || "Not mapped"}</span>
                </div>
              </div>
            </div>
          )}

          {connected && (
            <div className="border-t border-gray-200 dark:border-white/10 pt-6">
              <h3 className="text-lg font-semibold mb-3">Auto Sync</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-white/50">Schedule:</span>
                  <span>Daily at 18:00 NZST</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-white/50">Last auto sync:</span>
                  <span>{lastSync ? new Date(lastSync.time).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" }) : "Never"}</span>
                </div>
                {lastSync?.details && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-white/50">Result:</span>
                    <span>Checked {String(lastSync.details.total_checked ?? 0)} invoices, {String(lastSync.details.new_payments ?? 0)} payment(s) synced{Array.isArray(lastSync.details.errors) && lastSync.details.errors.length > 0 ? `, ${lastSync.details.errors.length} error(s)` : ""}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function XeroSettingsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-blue-950"><p className="text-gray-500 dark:text-white/60">Loading...</p></div>}>
      <XeroSettingsInner />
    </Suspense>
  );
}
