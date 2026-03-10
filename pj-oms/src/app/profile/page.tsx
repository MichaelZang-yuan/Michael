"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import SignaturePad from "@/components/SignaturePad";
import { hasRole, hasAnyRole, formatRoles, ROLE_LABELS } from "@/lib/roles";

type Profile = {
  full_name: string | null;
  email: string | null;
  role: string;
  roles: string[] | null;
  department: string;
  default_signature_url: string | null;
};

type MyStudent = {
  id: string;
  full_name: string | null;
  enrollment_date: string | null;
  status: string;
  department: string;
  schools: { name: string | null } | null;
};

type CommissionRow = {
  student_id: string;
  status: string;
  amount: number;
};

type MyStaffCommission = {
  id: string;
  deal_id: string;
  role_in_deal: string | null;
  commission_rate: number;
  base_amount: number;
  commission_amount: number;
  quarter: string | null;
  status: string;
  settled_date: string | null;
  notes: string | null;
  deals: { deal_number: string | null } | null;
};

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

const inputClass =
  "rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full";

function getYearRange() {
  const y = new Date().getFullYear();
  return {
    from: `${y}-01-01`,
    to: `${y}-12-31`,
  };
}

function getCurrentQuarter(): string {
  const d = new Date();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `${d.getFullYear()}-Q${q}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [isSavingSig, setIsSavingSig] = useState(false);
  const [sigMessage, setSigMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const yearRange = getYearRange();
  const [dateFrom, setDateFrom] = useState(yearRange.from);
  const [dateTo, setDateTo] = useState(yearRange.to);

  const [myStudents, setMyStudents] = useState<MyStudent[]>([]);
  const [myStats, setMyStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    cancelledStudents: 0,
    totalPendingCommissions: 0,
    totalClaimedCommissions: 0,
  });
  const [commissionsByStudent, setCommissionsByStudent] = useState<Record<string, { pendingCount: number; claimedCount: number }>>({});
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const [myStaffCommissions, setMyStaffCommissions] = useState<MyStaffCommission[]>([]);
  const [commissionQuarter, setCommissionQuarter] = useState(getCurrentQuarter());
  const [isLoadingStaffCommissions, setIsLoadingStaffCommissions] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }
      setUserId(session.user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email, role, roles, department, default_signature_url")
        .eq("id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      } else {
        setProfile({
          full_name: session.user.user_metadata?.full_name ?? null,
          email: session.user.email ?? null,
          role: "sales",
          roles: null,
          department: "china",
          default_signature_url: null,
        });
      }
      setIsLoading(false);
    }

    init();
  }, [router]);

  useEffect(() => {
    async function fetchMyStudents() {
      if (!userId || !hasRole(profile, "sales")) return;

      setIsLoadingStudents(true);
      let studentsData: unknown[] | null = null;
      const { data: orData, error: orError } = await supabase
        .from("students")
        .select("id, full_name, enrollment_date, status, department, schools(name)")
        .or(`created_by.eq.${userId},assigned_sales_id.eq.${userId}`)
        .gte("enrollment_date", dateFrom)
        .lte("enrollment_date", dateTo)
        .order("enrollment_date", { ascending: true });

      if (orError) {
        const { data: fallbackData } = await supabase
          .from("students")
          .select("id, full_name, enrollment_date, status, department, schools(name)")
          .eq("created_by", userId)
          .gte("enrollment_date", dateFrom)
          .lte("enrollment_date", dateTo)
          .order("enrollment_date", { ascending: true });
        studentsData = fallbackData;
      } else {
        studentsData = orData;
      }

      const students = (studentsData ?? []) as unknown as MyStudent[];

      if (students.length === 0) {
        setMyStudents([]);
        setMyStats({
          totalStudents: 0,
          activeStudents: 0,
          cancelledStudents: 0,
          totalPendingCommissions: 0,
          totalClaimedCommissions: 0,
        });
        setCommissionsByStudent({});
        setIsLoadingStudents(false);
        return;
      }

      const studentIds = students.map((s) => s.id);

      const { data: commissionsData } = await supabase
        .from("commissions")
        .select("student_id, status, amount")
        .in("student_id", studentIds);

      const commissions = (commissionsData ?? []) as CommissionRow[];

      const byStudent: Record<string, { pendingCount: number; claimedCount: number }> = {};
      for (const id of studentIds) {
        byStudent[id] = { pendingCount: 0, claimedCount: 0 };
      }
      let totalPendingAmount = 0;
      let totalClaimedAmount = 0;
      for (const c of commissions) {
        if (c.status === "pending") {
          byStudent[c.student_id].pendingCount += 1;
          totalPendingAmount += c.amount;
        } else if (c.status === "claimed") {
          byStudent[c.student_id].claimedCount += 1;
          totalClaimedAmount += c.amount;
        }
      }

      setMyStudents(students);
      setMyStats({
        totalStudents: students.length,
        activeStudents: students.filter((s) => s.status === "active").length,
        cancelledStudents: students.filter((s) => s.status === "cancelled").length,
        totalPendingCommissions: totalPendingAmount,
        totalClaimedCommissions: totalClaimedAmount,
      });
      setCommissionsByStudent(byStudent);
      setIsLoadingStudents(false);
    }

    fetchMyStudents();
  }, [userId, profile?.role, dateFrom, dateTo]);

  useEffect(() => {
    async function fetchStaffCommissions() {
      if (!userId) return;
      setIsLoadingStaffCommissions(true);
      let query = supabase
        .from("deal_staff_commissions")
        .select("id, deal_id, role_in_deal, commission_rate, base_amount, commission_amount, quarter, status, settled_date, notes, deals(deal_number)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (commissionQuarter !== "all") query = query.eq("quarter", commissionQuarter);
      const { data } = await query;
      setMyStaffCommissions((data ?? []) as unknown as MyStaffCommission[]);
      setIsLoadingStaffCommissions(false);
    }
    fetchStaffCommissions();
  }, [userId, commissionQuarter]);

  const quarterOptions = useMemo(() => {
    const opts: string[] = [];
    const d = new Date();
    for (let i = 0; i < 8; i++) {
      const q = Math.ceil((d.getMonth() + 1) / 3);
      const label = `${d.getFullYear()}-Q${q}`;
      if (!opts.includes(label)) opts.push(label);
      d.setMonth(d.getMonth() - 3);
    }
    return opts;
  }, []);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: "error", text: "❌ Passwords do not match" });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "✅ Password changed successfully!" });
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-950">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  const isSales = hasRole(profile, "sales");
  const isLia = hasAnyRole(profile, ["lia"]);

  const handleSaveSignature = async (dataUrl: string) => {
    if (!userId) return;
    setIsSavingSig(true);
    setSigMessage(null);

    try {
      // Convert data URL to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const filePath = `signatures/${userId}/default.png`;

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from("attachments")
        .upload(filePath, blob, { upsert: true, contentType: "image/png" });

      if (uploadErr) {
        setSigMessage({ type: "error", text: "Failed to upload signature: " + uploadErr.message });
        setIsSavingSig(false);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();

      // Save URL to profile
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ default_signature_url: publicUrl })
        .eq("id", userId);

      if (updateErr) {
        setSigMessage({ type: "error", text: "Failed to save signature URL." });
      } else {
        setProfile((prev) => prev ? { ...prev, default_signature_url: publicUrl } : prev);
        setSigMessage({ type: "success", text: "Signature saved successfully!" });
      }
    } catch {
      setSigMessage({ type: "error", text: "An error occurred while saving the signature." });
    }
    setIsSavingSig(false);
  };

  const handleRemoveSignature = async () => {
    if (!userId) return;
    setIsSavingSig(true);
    setSigMessage(null);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ default_signature_url: null })
      .eq("id", userId);

    if (updateErr) {
      setSigMessage({ type: "error", text: "Failed to remove signature." });
    } else {
      setProfile((prev) => prev ? { ...prev, default_signature_url: null } : prev);
      setSigMessage({ type: "success", text: "Signature removed." });
    }
    setIsSavingSig(false);
  };

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-3xl font-bold mb-8">My Profile</h2>

        {/* 基本信息（只读） */}
        <div className="mb-10 rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-bold mb-4">Account Information</h3>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Full Name</label>
              <input
                type="text"
                value={profile?.full_name ?? "—"}
                readOnly
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white/80 cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Email</label>
              <input
                type="email"
                value={profile?.email ?? "—"}
                readOnly
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white/80 cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Role</label>
              <input
                type="text"
                value={profile?.roles ? formatRoles(profile.roles) : profile?.role ? ROLE_LABELS[profile.role] ?? profile.role : "—"}
                readOnly
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white/80 cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Department</label>
              <input
                type="text"
                value={profile?.department ? DEPT_LABELS[profile.department] ?? profile.department : "—"}
                readOnly
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white/80 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* My Signature（仅 LIA 显示） */}
        {isLia && (
          <div className="mb-10 rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-bold mb-4">My Signature</h3>
            <p className="text-sm text-white/50 mb-4">
              Save a default signature to quickly sign contracts without redrawing each time.
            </p>

            {sigMessage && (
              <p className={`mb-4 text-sm ${sigMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
                {sigMessage.text}
              </p>
            )}

            {profile?.default_signature_url ? (
              <div className="mb-4">
                <p className="text-sm font-semibold text-white/70 mb-2">Current Saved Signature:</p>
                <div className="rounded-lg border border-white/20 bg-white p-4 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.default_signature_url} alt="Saved signature" className="max-h-20 object-contain" />
                </div>
                <div className="flex gap-3 mt-3">
                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    disabled={isSavingSig}
                    className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Remove Signature
                  </button>
                </div>
                <p className="text-xs text-white/40 mt-3">Upload a new signature below to replace:</p>
              </div>
            ) : null}

            <SignaturePad
              onSignature={handleSaveSignature}
              submitLabel={isSavingSig ? "Saving..." : "Save as Default Signature"}
              disabled={isSavingSig}
              theme="dark"
            />
          </div>
        )}

        {/* My Students（仅 sales 显示） */}
        {isSales && (
          <div className="mb-10 rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-bold mb-4">My Students</h3>

            {/* 时间段筛选 */}
            <div className="flex flex-wrap items-end gap-4 mb-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-white/70">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-white/70">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* 统计区域 */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-6">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs font-bold uppercase text-white/60">Total Students</div>
                <p className="text-2xl font-bold">{isLoadingStudents ? "…" : myStats.totalStudents}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs font-bold uppercase text-white/60">Active Students</div>
                <p className="text-2xl font-bold text-green-400">{isLoadingStudents ? "…" : myStats.activeStudents}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs font-bold uppercase text-white/60">Cancelled Students</div>
                <p className="text-2xl font-bold text-red-400">{isLoadingStudents ? "…" : myStats.cancelledStudents}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs font-bold uppercase text-white/60">Total Pending Commissions</div>
                <p className="text-2xl font-bold text-yellow-400">
                  {isLoadingStudents ? "…" : `$${myStats.totalPendingCommissions.toLocaleString()} NZD`}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs font-bold uppercase text-white/60">Total Claimed Commissions</div>
                <p className="text-2xl font-bold text-green-400">
                  {isLoadingStudents ? "…" : `$${myStats.totalClaimedCommissions.toLocaleString()} NZD`}
                </p>
              </div>
            </div>

            {/* 学生列表表格 */}
            <div className="overflow-x-auto rounded-xl border border-white/10">
              {isLoadingStudents ? (
                <p className="py-8 text-center text-white/60">Loading...</p>
              ) : myStudents.length === 0 ? (
                <p className="py-8 text-center text-white/60">No students in this date range.</p>
              ) : (
                <table className="w-full min-w-[600px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Student</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">School</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Department</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Enrollment Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Commission Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myStudents.map((s) => {
                      const comm = commissionsByStudent[s.id] ?? { pendingCount: 0, claimedCount: 0 };
                      return (
                        <tr key={s.id} className="border-b border-white/10 hover:bg-white/5 last:border-b-0">
                          <td className="px-6 py-4">
                            <Link
                              href={`/students/${s.id}`}
                              className="font-semibold text-blue-400 hover:underline"
                            >
                              {s.full_name ?? "—"}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-white/70">{s.schools?.name ?? "—"}</td>
                          <td className="px-6 py-4 text-white/70">{DEPT_LABELS[s.department] ?? s.department}</td>
                          <td className="px-6 py-4 text-white/70">
                            {s.enrollment_date ? new Date(s.enrollment_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-6 py-4 text-white/70">
                            {comm.pendingCount > 0 || comm.claimedCount > 0 ? (
                              <>
                                <span className="text-yellow-400">{comm.pendingCount} pending</span>
                                {" / "}
                                <span className="text-green-400">{comm.claimedCount} claimed</span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* My Commission */}
        <div className="mb-10 rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">My Commission</h3>
            <select
              value={commissionQuarter}
              onChange={e => setCommissionQuarter(e.target.value)}
              className="rounded-lg border border-white/20 bg-blue-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="all" className="bg-blue-900">All Quarters</option>
              {quarterOptions.map(q => <option key={q} value={q} className="bg-blue-900">{q}</option>)}
            </select>
          </div>

          {isLoadingStaffCommissions ? (
            <p className="py-8 text-center text-white/60">Loading...</p>
          ) : myStaffCommissions.length === 0 ? (
            <p className="py-8 text-center text-white/60">No commission records for this period.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-bold uppercase text-white/50 mb-1">Records</p>
                  <p className="text-xl font-bold">{myStaffCommissions.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-bold uppercase text-white/50 mb-1">Total</p>
                  <p className="text-xl font-bold">${myStaffCommissions.reduce((s, c) => s + c.commission_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-bold uppercase text-white/50 mb-1">Pending</p>
                  <p className="text-xl font-bold text-yellow-400">${myStaffCommissions.filter(c => c.status === "pending").reduce((s, c) => s + c.commission_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-bold uppercase text-white/50 mb-1">Settled</p>
                  <p className="text-xl font-bold text-green-400">${myStaffCommissions.filter(c => c.status === "settled").reduce((s, c) => s + c.commission_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[560px] text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/60">Deal</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/60">Quarter</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/60">Role</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-white/60">Base</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-white/60">Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-white/60">Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/60">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myStaffCommissions.map(c => (
                      <tr key={c.id} className="border-b border-white/10 hover:bg-white/5 last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/deals/${c.deal_id}`} className="text-blue-400 hover:underline">
                            {c.deals?.deal_number ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-white/60">{c.quarter ?? "—"}</td>
                        <td className="px-4 py-3 text-white/60 capitalize">{c.role_in_deal ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-white/80">${c.base_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right text-white/80">{c.commission_rate}%</td>
                        <td className="px-4 py-3 text-right font-bold">${c.commission_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.status === "settled" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                            {c.status === "settled" ? "Settled" : "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* 修改密码表单 */}
        <form onSubmit={handleChangePassword} className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-bold mb-4">Change Password</h3>
          <div className="flex flex-col gap-5 max-w-md">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">New Password *</label>
              <input
                type="password"
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Confirm New Password *</label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                required
                minLength={8}
                placeholder="Re-enter new password"
                className={inputClass}
              />
            </div>
            {message && (
              <p className={message.type === "success" ? "text-green-400" : "text-red-400"}>
                {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50 w-fit"
            >
              {isSubmitting ? "Updating..." : "Change Password"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
