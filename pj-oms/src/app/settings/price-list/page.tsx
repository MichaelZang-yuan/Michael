"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";
import Navbar from "@/components/Navbar";

type PriceItem = {
  id: string;
  category: string;
  service_name: string;
  service_fee: number;
  inz_fee: number;
  inz_fee_note: string | null;
  currency: string;
  is_active: boolean;
  display_order: number;
};

const CURRENCIES = ["NZD", "CNY", "THB"];

export default function PriceListPage() {
  const router = useRouter();
  const [items, setItems] = useState<PriceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Edit modal
  const [editItem, setEditItem] = useState<PriceItem | null>(null);
  const [editForm, setEditForm] = useState({ category: "", service_name: "", service_fee: "", inz_fee: "", inz_fee_note: "", currency: "NZD", display_order: "0" });

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ category: "", service_name: "", service_fee: "", inz_fee: "", inz_fee_note: "", currency: "NZD", display_order: "0" });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }
      const { data: profileData } = await supabase.from("profiles").select("role, roles").eq("id", session.user.id).single();
      if (!profileData || !hasRole(profileData, "admin")) { router.push("/crm"); return; }
      await fetchItems();
      setIsLoading(false);
    }
    init();
  }, [router]);

  const fetchItems = async () => {
    const { data } = await supabase.from("service_price_list").select("*").order("display_order").order("category");
    if (data) setItems(data as PriceItem[]);
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/seed-price-list", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: `Seeded ${data.count} price list entries.` });
        await fetchItems();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to seed." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    }
    setIsSeeding(false);
  };

  const handleToggleActive = async (item: PriceItem) => {
    await supabase.from("service_price_list").update({ is_active: !item.is_active }).eq("id", item.id);
    await fetchItems();
  };

  const openEdit = (item: PriceItem) => {
    setEditItem(item);
    setEditForm({
      category: item.category,
      service_name: item.service_name,
      service_fee: String(item.service_fee),
      inz_fee: String(item.inz_fee),
      inz_fee_note: item.inz_fee_note ?? "",
      currency: item.currency,
      display_order: String(item.display_order),
    });
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    await supabase.from("service_price_list").update({
      category: editForm.category,
      service_name: editForm.service_name,
      service_fee: parseFloat(editForm.service_fee) || 0,
      inz_fee: parseFloat(editForm.inz_fee) || 0,
      inz_fee_note: editForm.inz_fee_note.trim() || null,
      currency: editForm.currency,
      display_order: parseInt(editForm.display_order) || 0,
    }).eq("id", editItem.id);
    setEditItem(null);
    await fetchItems();
  };

  const handleAdd = async () => {
    await supabase.from("service_price_list").insert({
      category: addForm.category,
      service_name: addForm.service_name,
      service_fee: parseFloat(addForm.service_fee) || 0,
      inz_fee: parseFloat(addForm.inz_fee) || 0,
      inz_fee_note: addForm.inz_fee_note.trim() || null,
      currency: addForm.currency,
      display_order: parseInt(addForm.display_order) || 0,
      is_active: true,
    });
    setShowAddModal(false);
    setAddForm({ category: "", service_name: "", service_fee: "", inz_fee: "", inz_fee_note: "", currency: "NZD", display_order: "0" });
    await fetchItems();
  };

  // Group by category
  const categories = [...new Set(items.map(i => i.category))];

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const inputClass = "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none text-sm";
  const selectClass = "w-full rounded-lg border border-white/20 bg-blue-900 px-3 py-2 text-white focus:border-blue-400 focus:outline-none text-sm";
  const labelClass = "block text-sm font-medium text-white/70 mb-1";

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-blue-950"><p className="text-white/60">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Service Price List</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowAddModal(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-700">+ Add Item</button>
            <button onClick={handleSeed} disabled={isSeeding} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50">
              {isSeeding ? "Seeding..." : "Seed Default Prices"}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 ${message.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {message.text}
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <p className="text-lg mb-2">No price list entries yet.</p>
            <p className="text-sm">Click &ldquo;Seed Default Prices&rdquo; to populate with default data.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map(cat => (
              <div key={cat} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                  <h3 className="font-bold text-sm">{cat}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-2 px-4 text-white/50 font-medium">Service Name</th>
                        <th className="text-right py-2 px-4 text-white/50 font-medium">Service Fee</th>
                        <th className="text-right py-2 px-4 text-white/50 font-medium">INZ Fee</th>
                        <th className="text-left py-2 px-4 text-white/50 font-medium">Note</th>
                        <th className="text-left py-2 px-4 text-white/50 font-medium">Ccy</th>
                        <th className="text-center py-2 px-4 text-white/50 font-medium">Active</th>
                        <th className="py-2 px-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.filter(i => i.category === cat).map(item => (
                        <tr key={item.id} className={`border-b border-white/5 ${!item.is_active ? "opacity-40" : ""}`}>
                          <td className="py-2 px-4 text-white/80">{item.service_name}</td>
                          <td className="py-2 px-4 text-right font-semibold">${fmt(item.service_fee)}</td>
                          <td className="py-2 px-4 text-right">{item.inz_fee > 0 ? `$${fmt(item.inz_fee)}` : "—"}</td>
                          <td className="py-2 px-4 text-white/50 text-xs">{item.inz_fee_note ?? "—"}</td>
                          <td className="py-2 px-4 text-white/60">{item.currency}</td>
                          <td className="py-2 px-4 text-center">
                            <button onClick={() => handleToggleActive(item)} className={`text-xs px-2 py-0.5 rounded-full ${item.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                              {item.is_active ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="py-2 px-4">
                            <button onClick={() => openEdit(item)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-blue-900 p-6">
            <h4 className="text-lg font-bold mb-4">Edit Price Item</h4>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Category</label>
                <input value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Service Name</label>
                <input value={editForm.service_name} onChange={e => setEditForm(f => ({ ...f, service_name: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Service Fee</label>
                  <input value={editForm.service_fee} onChange={e => setEditForm(f => ({ ...f, service_fee: e.target.value }))} type="number" step="0.01" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>INZ Fee</label>
                  <input value={editForm.inz_fee} onChange={e => setEditForm(f => ({ ...f, inz_fee: e.target.value }))} type="number" step="0.01" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>INZ Fee Note</label>
                <input value={editForm.inz_fee_note} onChange={e => setEditForm(f => ({ ...f, inz_fee_note: e.target.value }))} className={inputClass} placeholder="e.g. Varies" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Currency</label>
                  <select value={editForm.currency} onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))} className={selectClass}>
                    {CURRENCIES.map(c => <option key={c} value={c} className="bg-blue-900">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Display Order</label>
                  <input value={editForm.display_order} onChange={e => setEditForm(f => ({ ...f, display_order: e.target.value }))} type="number" className={inputClass} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSaveEdit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-700">Save</button>
              <button onClick={() => setEditItem(null)} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-blue-900 p-6">
            <h4 className="text-lg font-bold mb-4">Add Price Item</h4>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Category</label>
                <input value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} className={inputClass} placeholder="e.g. Student Visa" />
              </div>
              <div>
                <label className={labelClass}>Service Name</label>
                <input value={addForm.service_name} onChange={e => setAddForm(f => ({ ...f, service_name: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Service Fee</label>
                  <input value={addForm.service_fee} onChange={e => setAddForm(f => ({ ...f, service_fee: e.target.value }))} type="number" step="0.01" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>INZ Fee</label>
                  <input value={addForm.inz_fee} onChange={e => setAddForm(f => ({ ...f, inz_fee: e.target.value }))} type="number" step="0.01" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>INZ Fee Note</label>
                <input value={addForm.inz_fee_note} onChange={e => setAddForm(f => ({ ...f, inz_fee_note: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Currency</label>
                  <select value={addForm.currency} onChange={e => setAddForm(f => ({ ...f, currency: e.target.value }))} className={selectClass}>
                    {CURRENCIES.map(c => <option key={c} value={c} className="bg-blue-900">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Display Order</label>
                  <input value={addForm.display_order} onChange={e => setAddForm(f => ({ ...f, display_order: e.target.value }))} type="number" className={inputClass} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleAdd} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-700">Add</button>
              <button onClick={() => setShowAddModal(false)} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
