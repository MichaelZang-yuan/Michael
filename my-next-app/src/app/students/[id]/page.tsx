"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { logActivity } from "@/lib/activityLog";

type AttachmentFile = { name: string; url: string; createdAt: string | null };

type ActivityLog = {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user_id: string;
};

const ACTION_LABELS: Record<string, (d: Record<string, unknown> | null) => string> = {
  created_student: () => "Added this student",
  updated_student: () => "Updated student information",
  claimed_commission: (d) => `Claimed Year ${d?.year ?? "?"} commission ($${d?.amount ?? "?"} NZD)`,
  unclaimed_commission: (d) => `Undid Year ${d?.year ?? "?"} commission claim`,
  deleted_student: () => "Deleted student",
};

type School = {
  id: string;
  name: string;
  course_type_a_name?: string | null;
  course_type_b_name?: string | null;
};

type SalesUser = {
  id: string;
  full_name: string | null;
};

type Student = {
  id: string;
  full_name: string;
  student_number: string | null;
  school_id: string | null;
  department: string;
  enrollment_date: string | null;
  tuition_fee: number;
  status: string;
  notes: string | null;
  created_by: string | null;
  assigned_sales_id?: string | null;
};

type Commission = {
  id: string;
  year: number;
  status: string;
  amount: number;
  tuition_fee: number | null;
  commission_rate: number | null;
  enrollment_date: string | null;
  claim_date: string | null;
  claimed_at: string | null;
};

type Profile = {
  role: string;
};

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  enrolled: "Enrolled",
  pending: "Pending",
  claimed: "Claimed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-500/20 text-blue-400",
  enrolled: "bg-yellow-500/20 text-yellow-400",
  pending: "bg-orange-500/20 text-orange-400",
  claimed: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
};

function getStatusBadgeClass(status: string): string {
  return STATUS_COLORS[status] ?? "bg-gray-500/20 text-gray-400";
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClaiming, setIsClaiming] = useState<string | null>(null);
  const [isStudentAction, setIsStudentAction] = useState<"invoice" | "undo-enrolled" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [addForm, setAddForm] = useState<{
    show: boolean;
    year: number;
    enrollment_date: string;
    tuition_fee: string;
    commission_rate: string;
    amount: string;
    defaultRate: number;
  }>({ show: false, year: 0, enrollment_date: "", tuition_fee: "", commission_rate: "", amount: "", defaultRate: 0.1 });
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
  const [editCommissionForm, setEditCommissionForm] = useState({ enrollment_date: "", tuition_fee: "", commission_rate: "", amount: "" });
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [userNamesByUserId, setUserNamesByUserId] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    full_name: "",
    student_number: "",
    school_id: "",
    department: "",
    status: "active",
    notes: "",
    created_by: "",
    assigned_sales_id: "",
  });
  const [initialForm, setInitialForm] = useState<string>("");

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/admin"); return; }

      // 获取当前用户角色
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profileData) setProfile(profileData);

      // 获取学校列表
      const { data: schoolData } = await supabase.from("schools").select("id, name, course_type_a_name, course_type_b_name").order("name");
      if (schoolData) setSchools(schoolData);

      // 获取 Sales 用户列表（供 admin 分配）
      const { data: salesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "sales")
        .order("full_name");
      if (salesData) setSalesUsers(salesData);

      // 获取学生信息
      const { data: studentData } = await supabase
        .from("students").select("*").eq("id", id).single();
      if (studentData) {
        setStudent(studentData);
        const loadedForm = {
          full_name: studentData.full_name ?? "",
          student_number: studentData.student_number ?? "",
          school_id: studentData.school_id ?? "",
          department: studentData.department ?? "",
          status: studentData.status ?? "active",
          notes: studentData.notes ?? "",
          created_by: studentData.created_by ?? "",
          assigned_sales_id: (studentData.assigned_sales_id ?? studentData.created_by) ?? "",
        };
        setForm(loadedForm);
        setInitialForm(JSON.stringify(loadedForm));
      }

      // 获取 commission 记录
      const { data: commissionData } = await supabase
        .from("commissions").select("*").eq("student_id", id).order("year");
      if (commissionData) setCommissions(commissionData);

      const attRes = await fetch(`/api/attachments?type=students&id=${id}`);
      const attJson = await attRes.json().catch(() => ({ files: [] }));
      if (attJson.files) setAttachments(attJson.files);

      const { data: logsData, error: logsError } = await supabase
        .from("activity_logs")
        .select("id, action, details, created_at, user_id")
        .eq("entity_id", id)
        .order("created_at", { ascending: false });

      if (logsError) console.error("Logs error:", logsError);
      if (logsData) {
        setActivityLogs(logsData as unknown as ActivityLog[]);
        const userIds = [...new Set((logsData as { user_id: string }[]).map((l) => l.user_id))];
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);
          const map: Record<string, string> = {};
          for (const p of profilesData ?? []) {
            const row = p as { id: string; full_name: string | null };
            map[row.id] = row.full_name ?? "Unknown";
          }
          setUserNamesByUserId(map);
        }
      }

      setIsLoading(false);
    }

    init();
  }, [id, router]);

  const fetchActivityLogs = useCallback(async () => {
    const { data: logsData, error: logsError } = await supabase
      .from("activity_logs")
      .select("id, action, details, created_at, user_id")
      .eq("entity_id", id)
      .order("created_at", { ascending: false });

    if (logsError) console.error("Logs error:", logsError);
    if (logsData) {
      setActivityLogs(logsData as unknown as ActivityLog[]);
      const userIds = [...new Set((logsData as { user_id: string }[]).map((l) => l.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        const map: Record<string, string> = {};
        for (const p of profilesData ?? []) {
          const row = p as { id: string; full_name: string | null };
          map[row.id] = row.full_name ?? "Unknown";
        }
        setUserNamesByUserId(map);
      }
    }
  }, [id]);

  const fetchAttachments = useCallback(async () => {
    const res = await fetch(`/api/attachments?type=students&id=${id}`);
    const json = await res.json().catch(() => ({ files: [] }));
    if (json.files) setAttachments(json.files);
  }, [id]);

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "students");
      formData.append("id", id);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Upload failed." });
        return;
      }
      await fetchAttachments();
      setMessage({ type: "success", text: "✅ File uploaded." });
    } catch (err) {
      setMessage({ type: "error", text: "Upload failed." });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const displayFileName = (name: string) => {
    const match = name.match(/^\d+-(.+)$/);
    return match ? match[1] : name;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const updatePayload: Record<string, unknown> = {
      full_name: form.full_name,
      student_number: form.student_number || null,
      school_id: form.school_id || null,
      notes: form.notes || null,
    };
    if (isAdmin) {
      updatePayload.department = form.department;
      updatePayload.status = form.status;
      updatePayload.assigned_sales_id = form.assigned_sales_id || null;
    }

    let { error } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", id);

    if (error && updatePayload.assigned_sales_id !== undefined) {
      const colMissing = error.message?.includes("assigned_sales_id") || error.code === "42703";
      if (colMissing) {
        delete updatePayload.assigned_sales_id;
        updatePayload.created_by = form.assigned_sales_id || null;
        const retry = await supabase.from("students").update(updatePayload).eq("id", id);
        error = retry.error;
      }
    }

    if (error) {
      setMessage({ type: "error", text: "Failed to save. Please try again." });
    } else {
      setMessage({ type: "success", text: "✅ Student updated successfully!" });
      setStudent({ ...student!, ...form, assigned_sales_id: form.assigned_sales_id || null });
      setInitialForm(JSON.stringify(form));
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await logActivity(supabase, session.user.id, "updated_student", "student", id, { name: form.full_name });
        await fetchActivityLogs();
      }
    }
    setIsSaving(false);
  };

  const handleAddCommissionClick = async (year: number) => {
    setMessage(null);
    const schoolId = form.school_id || student?.school_id;
    let defaultRate = 0.1;
    if (schoolId) {
      const { data: schoolData } = await supabase
        .from("schools")
        .select("course_type_a_rate, course_type_b_rate")
        .eq("id", schoolId)
        .single();
      if (schoolData) {
        const s = schoolData as { course_type_a_rate: number | null; course_type_b_rate: number | null };
        defaultRate = (s.course_type_a_rate ?? s.course_type_b_rate ?? 0.1);
      }
    }
    const defaultTuition = "";
    const defaultAmount = defaultTuition && defaultRate ? String((parseFloat(defaultTuition) * defaultRate).toFixed(2)) : "";
    const defaultEnrollment = commissions.length > 0
      ? (commissions.find((c) => c.enrollment_date)?.enrollment_date ?? "")
      : "";
    setAddForm({
      show: true,
      year,
      enrollment_date: defaultEnrollment,
      tuition_fee: defaultTuition,
      commission_rate: String((defaultRate * 100).toFixed(1)),
      amount: defaultAmount,
      defaultRate,
    });
  };

  const handleAddFormChange = (field: "enrollment_date" | "tuition_fee" | "commission_rate" | "amount", value: string) => {
    setAddForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "tuition_fee" || field === "commission_rate") {
        const tuition = parseFloat(field === "tuition_fee" ? value : prev.tuition_fee) || 0;
        const rate = parseFloat(field === "commission_rate" ? value : prev.commission_rate) || 0;
        next.amount = (tuition * rate / 100).toFixed(2);
      }
      return next;
    });
  };


  const handleAddCommission = async () => {
    const tuition = parseFloat(addForm.tuition_fee) || 0;
    const rate = parseFloat(addForm.commission_rate) || 0;
    const amount = parseFloat(addForm.amount) || 0;
    if (!amount) {
      setMessage({ type: "error", text: "Please enter a valid amount." });
      return;
    }

    const enrollmentDate = addForm.enrollment_date?.trim() || null;
    const { data, error } = await supabase
      .from("commissions")
      .insert({
        student_id: id,
        year: addForm.year,
        status: "pending",
        amount,
        tuition_fee: tuition || null,
        commission_rate: rate ? rate / 100 : null,
        enrollment_date: enrollmentDate,
      })
      .select().single();

    if (!error && data) {
      setCommissions([...commissions, data as Commission]);
      setAddForm({ show: false, year: 0, enrollment_date: "", tuition_fee: "", commission_rate: "", amount: "", defaultRate: 0.1 });
    } else {
      setMessage({ type: "error", text: "Failed to add commission." });
    }
  };

  const startEditCommission = (c: Commission) => {
    setEditingCommissionId(c.id);
    setEditCommissionForm({
      enrollment_date: c.enrollment_date ?? "",
      tuition_fee: String(c.tuition_fee ?? ""),
      commission_rate: c.commission_rate != null ? String((c.commission_rate * 100).toFixed(1)) : "",
      amount: String(c.amount ?? ""),
    });
  };

  const handleEditCommissionChange = (field: "enrollment_date" | "tuition_fee" | "commission_rate" | "amount", value: string) => {
    setEditCommissionForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "tuition_fee" || field === "commission_rate") {
        const tuition = parseFloat(field === "tuition_fee" ? value : prev.tuition_fee) || 0;
        const rate = parseFloat(field === "commission_rate" ? value : prev.commission_rate) || 0;
        next.amount = (tuition * rate / 100).toFixed(2);
      }
      return next;
    });
  };

  const handleSaveEditCommission = async () => {
    if (!editingCommissionId) return;
    const tuition = parseFloat(editCommissionForm.tuition_fee) || 0;
    const rate = parseFloat(editCommissionForm.commission_rate) || 0;
    const amount = parseFloat(editCommissionForm.amount) || 0;

    const enrollmentDate = editCommissionForm.enrollment_date?.trim() || null;
    const { data, error } = await supabase
      .from("commissions")
      .update({
        enrollment_date: enrollmentDate,
        tuition_fee: tuition || null,
        commission_rate: rate ? rate / 100 : null,
        amount,
      })
      .eq("id", editingCommissionId)
      .select().single();

    if (!error && data) {
      setCommissions(commissions.map((c) => (c.id === editingCommissionId ? (data as Commission) : c)));
      setEditingCommissionId(null);
    }
  };

  const handleDeleteCommission = async (commissionId: string) => {
    if (!confirm("Are you sure?")) return;

    const { error } = await supabase.from("commissions").delete().eq("id", commissionId);
    if (!error) {
      setCommissions(commissions.filter((c) => c.id !== commissionId));
      if (editingCommissionId === commissionId) setEditingCommissionId(null);
    }
  };

  const handleDeleteStudent = async () => {
    if (!confirm("Are you sure you want to delete this student? This will also delete all commission records.")) return;

    setIsDeleting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("[handleDeleteStudent] API error:", res.status, data);
        setMessage({
          type: "error",
          text: data.error || `删除失败 (${res.status})`,
        });
        setIsDeleting(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session && student) {
        await logActivity(supabase, session.user.id, "deleted_student", "student", id, { name: student.full_name });
      }

      router.push("/students");
    } catch (err) {
      console.error("[handleDeleteStudent] unexpected error:", err);
      setMessage({
        type: "error",
        text: `删除失败: ${err instanceof Error ? err.message : String(err)}`,
      });
      setIsDeleting(false);
    }
  };

  const handleClaim = async (commissionId: string) => {
    setIsClaiming(commissionId);
    setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    const commission = commissions.find((c) => c.id === commissionId);

    const { error } = await supabase
      .from("commissions")
      .update({
        status: "claimed",
        claimed_by: session?.user.id,
        claimed_at: new Date().toISOString(),
        claim_date: new Date().toISOString().split("T")[0],
      })
      .eq("id", commissionId);

    if (!error) {
      setCommissions(commissions.map(c =>
        c.id === commissionId
          ? { ...c, status: "claimed", claimed_at: new Date().toISOString() }
          : c
      ));
      // Claim 成功后自动把学生 status 更新为 claimed
      await supabase.from("students").update({ status: "claimed" }).eq("id", id);
      if (student) {
        setStudent({ ...student, status: "claimed" });
        setForm((prev) => ({ ...prev, status: "claimed" }));
      }
      if (session && commission) {
        await logActivity(supabase, session.user.id, "claimed_commission", "commission", id, {
          commission_id: commissionId,
          year: commission.year,
          amount: commission.amount,
        });
        await fetchActivityLogs();
      }

      if (student && commission) {
        const school = schools.find((s) => s.id === student.school_id);
        const schoolName = school?.name ?? "";
        const enrollmentDate = commission.enrollment_date ?? null;
        try {
          const zohoRes = await fetch("/api/zoho/update-deal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentName: student.full_name,
              schoolName,
              enrollmentDate,
            }),
          });
          const zohoData = await zohoRes.json().catch(() => ({}));
          if (zohoData.success && zohoData.dealName) {
            const prev = zohoData.previousStage ?? "unknown";
            setMessage({
              type: "success",
              text: `✅ Commission claimed! Zoho Deal '${zohoData.dealName}' updated from '${prev}' to 'Completed with Commission'`,
            });
          } else if (zohoData.success) {
            setMessage({ type: "success", text: "✅ Commission claimed! Zoho Deal updated." });
          } else {
            const err = zohoData.error ?? "Unknown error";
            setMessage({ type: "success", text: `✅ Commission claimed. ⚠️ Zoho Deal update failed: ${err}` });
          }
        } catch (e) {
          const err = e instanceof Error ? e.message : "Unknown error";
          setMessage({ type: "success", text: `✅ Commission claimed. ⚠️ Zoho Deal update failed: ${err}` });
        }

        // 发送邮件通知 Sales（不阻塞 claim 流程，失败仅记录到 console）
        const salesUserId = student.assigned_sales_id || student.created_by;
        if (salesUserId) {
          try {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("email, full_name")
              .eq("id", salesUserId)
              .single();
            if (profileData?.email) {
              const claimedDate = new Date().toISOString().split("T")[0];
              const res = await fetch("/api/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  toEmail: profileData.email,
                  salesName: profileData.full_name || "there",
                  studentName: student.full_name,
                  studentId: id,
                  commissionYear: commission.year,
                  amount: commission.amount,
                  claimedDate,
                }),
              });
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error("[Claim] Email notification failed:", errData.error ?? res.statusText);
              }
            }
          } catch (e) {
            console.error("[Claim] Email notification error:", e);
          }
        }
      } else {
        setMessage({ type: "success", text: "✅ Commission claimed." });
      }
    }
    setIsClaiming(null);
  };

  const handleInvoiceSent = async () => {
    setIsStudentAction("invoice");
    setMessage(null);
    const { error } = await supabase.from("students").update({ status: "pending" }).eq("id", id);
    if (!error && student) {
      setStudent({ ...student, status: "pending" });
      setForm((prev) => ({ ...prev, status: "pending" }));
      setMessage({ type: "success", text: "✅ Invoice sent. Student status updated to Pending." });
    } else if (error) {
      setMessage({ type: "error", text: "Failed to update status." });
    }
    setIsStudentAction(null);
  };

  const handleUndoToEnrolled = async () => {
    setIsStudentAction("undo-enrolled");
    setMessage(null);
    const { error } = await supabase.from("students").update({ status: "enrolled" }).eq("id", id);
    if (!error && student) {
      setStudent({ ...student, status: "enrolled" });
      setForm((prev) => ({ ...prev, status: "enrolled" }));
      setMessage({ type: "success", text: "✅ Undone. Student status reverted to Enrolled." });
    } else if (error) {
      setMessage({ type: "error", text: "Failed to update status." });
    }
    setIsStudentAction(null);
  };

  // 仅 Admin 可以撤销 claim
  const handleUnclaim = async (commissionId: string) => {
    setIsClaiming(commissionId);
    const { data: { session } } = await supabase.auth.getSession();
    const commission = commissions.find((c) => c.id === commissionId);

    const { error } = await supabase
      .from("commissions")
      .update({
        status: "pending",
        claimed_by: null,
        claimed_at: null,
        claim_date: null,
      })
      .eq("id", commissionId);

    if (!error) {
      setCommissions(commissions.map(c =>
        c.id === commissionId
          ? { ...c, status: "pending", claimed_at: null }
          : c
      ));
      // Undo 后把学生 status 改回 pending（invoice 已发，只是撤回了 claim）
      await supabase.from("students").update({ status: "pending" }).eq("id", id);
      if (student) {
        setStudent({ ...student, status: "pending" });
        setForm((prev) => ({ ...prev, status: "pending" }));
      }
      if (session && commission) {
        await logActivity(supabase, session.user.id, "unclaimed_commission", "commission", id, {
          commission_id: commissionId,
          year: commission.year,
        });
        await fetchActivityLogs();
      }
    }
    setIsClaiming(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-950">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-950">
        <p className="text-white/60">Student not found.</p>
      </div>
    );
  }

  const existingYears = commissions.map(c => c.year);
  const availableYears = [1, 2, 3, 4].filter(y => !existingYears.includes(y));
  const isAdmin = profile?.role === "admin";
  const canEditDeleteCommission = profile?.role === "admin" || profile?.role === "sales";
  const isDirty = initialForm !== "" && JSON.stringify(form) !== initialForm;

  return (
    <div className="min-h-screen bg-blue-950 text-white">
      <Navbar hasUnsavedChanges={isDirty} />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-3 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold sm:text-3xl">{student.full_name}</h2>
            <p className="text-white/50 mt-1">{DEPT_LABELS[student.department]}</p>
          </div>
          <span className={`rounded-full px-4 py-1.5 text-sm font-bold uppercase ${getStatusBadgeClass(student.status)}`}>
            {STATUS_LABELS[student.status] ?? student.status}
          </span>
        </div>

        {/* Commission Section */}
        <div className="mb-10 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-bold mb-4 sm:text-xl">Commission Tracking</h3>

          {commissions.length === 0 ? (
            <p className="text-white/50 mb-4">No commissions added yet.</p>
          ) : (
            <div className="flex flex-col gap-3 mb-4">
              {commissions.map((c) => (
                <div key={c.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  {editingCommissionId === c.id ? (
                    <div className="flex flex-col gap-3">
                      <p className="font-semibold">Year {c.year} Commission (editing)</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <div>
                          <label className="text-xs text-white/60">Enrollment Date</label>
                          <input
                            type="date"
                            value={editCommissionForm.enrollment_date}
                            onChange={(e) => handleEditCommissionChange("enrollment_date", e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-white/60">Tuition Fee</label>
                          <input
                            type="number"
                            value={editCommissionForm.tuition_fee}
                            onChange={(e) => handleEditCommissionChange("tuition_fee", e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-white/60">Rate (%)</label>
                          <input
                            type="number"
                            value={editCommissionForm.commission_rate}
                            onChange={(e) => handleEditCommissionChange("commission_rate", e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-white/60">Amount</label>
                          <input
                            type="number"
                            value={editCommissionForm.amount}
                            onChange={(e) => handleEditCommissionChange("amount", e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveEditCommission} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-green-700">Save</button>
                        <button onClick={() => setEditingCommissionId(null)} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-bold hover:bg-white/10">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm sm:text-base">Year {c.year} Commission</p>
                        <p className="text-white/60 text-xs sm:text-sm break-words">
                          Tuition: ${(c.tuition_fee ?? 0).toLocaleString()} | Rate: {((c.commission_rate ?? 0) * 100).toFixed(0)}% | Amount: ${c.amount.toLocaleString()} NZD{c.enrollment_date ? ` | Enrollment: ${c.enrollment_date}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {((student?.status ?? form.status) === "active") ? (
                          <>
                            {canEditDeleteCommission && (
                              <>
                                <button onClick={() => startEditCommission(c)}
                                  className="rounded-lg border border-white/20 px-3 py-1 text-xs font-bold hover:bg-white/10">Edit</button>
                                <button onClick={() => handleDeleteCommission(c.id)}
                                  className="rounded-lg border border-red-500/50 px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-500/20">Delete</button>
                              </>
                            )}
                            {!canEditDeleteCommission && (
                              <span className="rounded-full bg-gray-500/30 px-3 py-1 text-sm font-bold text-gray-400">Pending</span>
                            )}
                          </>
                        ) : ((student?.status ?? form.status) === "cancelled") ? (
                          <>
                            {c.status === "claimed" && (
                              <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm font-bold text-green-400">✅ Claimed</span>
                            )}
                            {c.status === "pending" && (
                              <span className="rounded-full bg-gray-500/30 px-3 py-1 text-sm font-bold text-gray-400">Pending</span>
                            )}
                            {canEditDeleteCommission && (
                              <>
                                <button onClick={() => startEditCommission(c)}
                                  className="rounded-lg border border-white/20 px-3 py-1 text-xs font-bold hover:bg-white/10">Edit</button>
                                <button onClick={() => handleDeleteCommission(c.id)}
                                  className="rounded-lg border border-red-500/50 px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-500/20">Delete</button>
                              </>
                            )}
                          </>
                        ) : ((student?.status ?? form.status) === "enrolled" && c.status === "pending") ? (
                          <>
                            {isAdmin && (
                              <button onClick={handleInvoiceSent} disabled={!!isStudentAction}
                                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                                {isStudentAction === "invoice" ? "..." : "Invoice Sent"}
                              </button>
                            )}
                            {canEditDeleteCommission && (
                              <>
                                <button onClick={() => startEditCommission(c)}
                                  className="rounded-lg border border-white/20 px-3 py-1 text-xs font-bold hover:bg-white/10">Edit</button>
                                <button onClick={() => handleDeleteCommission(c.id)}
                                  className="rounded-lg border border-red-500/50 px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-500/20">Delete</button>
                              </>
                            )}
                            {!isAdmin && !canEditDeleteCommission && (
                              <span className="rounded-full bg-gray-500/30 px-3 py-1 text-sm font-bold text-gray-400">Pending</span>
                            )}
                          </>
                        ) : ((student?.status ?? form.status) === "pending" && c.status === "pending") ? (
                          <>
                            {isAdmin && (
                              <>
                                <button onClick={() => handleClaim(c.id)} disabled={isClaiming === c.id}
                                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                                  {isClaiming === c.id ? "Claiming..." : "Claim"}
                                </button>
                                <button onClick={handleUndoToEnrolled} disabled={!!isStudentAction}
                                  className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                                  {isStudentAction === "undo-enrolled" ? "..." : "Undo"}
                                </button>
                              </>
                            )}
                            {canEditDeleteCommission && (
                              <>
                                <button onClick={() => startEditCommission(c)}
                                  className="rounded-lg border border-white/20 px-3 py-1 text-xs font-bold hover:bg-white/10">Edit</button>
                                <button onClick={() => handleDeleteCommission(c.id)}
                                  className="rounded-lg border border-red-500/50 px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-500/20">Delete</button>
                              </>
                            )}
                            {!isAdmin && !canEditDeleteCommission && (
                              <span className="rounded-full bg-gray-500/30 px-3 py-1 text-sm font-bold text-gray-400">Pending</span>
                            )}
                          </>
                        ) : c.status === "claimed" ? (
                          <>
                            <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm font-bold text-green-400">✅ Claimed</span>
                            {isAdmin && (
                              <button onClick={() => handleUnclaim(c.id)} disabled={isClaiming === c.id}
                                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                                Undo
                              </button>
                            )}
                            {canEditDeleteCommission && (
                              <>
                                <button onClick={() => startEditCommission(c)}
                                  className="rounded-lg border border-white/20 px-3 py-1 text-xs font-bold hover:bg-white/10">Edit</button>
                                <button onClick={() => handleDeleteCommission(c.id)}
                                  className="rounded-lg border border-red-500/50 px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-500/20">Delete</button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            {canEditDeleteCommission && (
                              <>
                                <button onClick={() => startEditCommission(c)}
                                  className="rounded-lg border border-white/20 px-3 py-1 text-xs font-bold hover:bg-white/10">Edit</button>
                                <button onClick={() => handleDeleteCommission(c.id)}
                                  className="rounded-lg border border-red-500/50 px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-500/20">Delete</button>
                              </>
                            )}
                            {!canEditDeleteCommission && (
                              <span className="rounded-full bg-gray-500/30 px-3 py-1 text-sm font-bold text-gray-400">Pending</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Commission Form */}
          {addForm.show && (
            <div className="mb-4 rounded-lg border border-white/20 bg-white/5 p-4">
              <h4 className="mb-3 font-semibold">Add Year {addForm.year} Commission</h4>
              <div className="flex flex-col gap-3">
                <div className="max-w-xs">
                  <label className="text-xs text-white/60">Enrollment Date</label>
                  <input
                    type="date"
                    value={addForm.enrollment_date}
                    onChange={(e) => handleAddFormChange("enrollment_date", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-xs text-white/60">Tuition Fee for this year</label>
                  <input
                    type="number"
                    value={addForm.tuition_fee}
                    onChange={(e) => handleAddFormChange("tuition_fee", e.target.value)}
                    placeholder="e.g. 20000"
                    className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Commission Rate (%)</label>
                  <input
                    type="number"
                    value={addForm.commission_rate}
                    onChange={(e) => handleAddFormChange("commission_rate", e.target.value)}
                    placeholder="e.g. 15"
                    step="0.1"
                    className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Amount</label>
                  <input
                    type="number"
                    value={addForm.amount}
                    onChange={(e) => handleAddFormChange("amount", e.target.value)}
                    placeholder="Auto"
                    className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
                  />
                </div>
                      <div className="flex flex-wrap items-end gap-2">
                  <button onClick={handleAddCommission} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Add</button>
                  <button onClick={() => setAddForm({ show: false, year: 0, enrollment_date: "", tuition_fee: "", commission_rate: "", amount: "", defaultRate: 0.1 })} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">Cancel</button>
                </div>
                </div>
              </div>
            </div>
          )}

          {availableYears.length > 0 && !addForm.show && (
            <div className="flex gap-3 flex-wrap">
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => handleAddCommissionClick(year)}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10"
                >
                  + Add Year {year}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Student Info Form */}
        <h3 className="text-lg font-bold mb-5 sm:text-xl">Student Information</h3>
        <form onSubmit={handleSave} className="flex flex-col gap-5 w-full">

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Full Name *</label>
            <input name="full_name" value={form.full_name} onChange={handleChange} required
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Student Number</label>
            <input name="student_number" value={form.student_number} onChange={handleChange} placeholder="e.g. ST123456"
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">School</label>
            <select name="school_id" value={form.school_id} onChange={handleChange}
              className="rounded-lg border border-white/20 bg-blue-900 px-4 py-3 text-white focus:border-blue-400 focus:outline-none w-full">
              <option value="" className="bg-blue-900 text-white">Select a school...</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id} className="bg-blue-900 text-white">{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Department *</label>
            <select name="department" value={form.department} onChange={handleChange} required disabled={!isAdmin}
              className="rounded-lg border border-white/20 bg-blue-900 px-4 py-3 text-white focus:border-blue-400 focus:outline-none w-full disabled:opacity-70 disabled:cursor-not-allowed">
              <option value="" className="bg-blue-900 text-white">Select a department...</option>
              <option value="china" className="bg-blue-900 text-white">China</option>
              <option value="thailand" className="bg-blue-900 text-white">Thailand</option>
              <option value="myanmar" className="bg-blue-900 text-white">Myanmar</option>
              <option value="korea_japan" className="bg-blue-900 text-white">Korea & Japan</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Status</label>
            {isAdmin ? (
              <select name="status" value={form.status} onChange={handleChange}
                className="rounded-lg border border-white/20 bg-blue-900 px-4 py-3 text-white focus:border-blue-400 focus:outline-none w-full">
                <option value="active" className="bg-blue-900 text-white">Active</option>
                <option value="enrolled" className="bg-blue-900 text-white">Enrolled</option>
                <option value="pending" className="bg-blue-900 text-white">Pending</option>
                <option value="claimed" className="bg-blue-900 text-white">Claimed</option>
                <option value="cancelled" className="bg-blue-900 text-white">Cancelled</option>
              </select>
            ) : (
              <span className={`inline-block rounded-full px-4 py-2 text-sm font-bold uppercase ${getStatusBadgeClass(form.status)}`}>
                {STATUS_LABELS[form.status] ?? form.status}
              </span>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Assigned Sales</label>
              <select
                name="assigned_sales_id"
                value={form.assigned_sales_id}
                onChange={handleChange}
                className="rounded-lg border border-white/20 bg-blue-900 px-4 py-3 text-white focus:border-blue-400 focus:outline-none w-full"
              >
                <option value="" className="bg-blue-900 text-white">— Not assigned —</option>
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id} className="bg-blue-900 text-white">
                    {u.full_name ?? u.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Any additional notes..." rows={3}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none w-full" />
          </div>

          {message && (
            <p className={message.type === "success" ? "text-green-400" : "text-red-400"}>
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="submit" disabled={isSaving}
              className="rounded-lg bg-blue-600 px-8 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <Link href="/students"
              className="rounded-lg border border-white/20 px-8 py-3 font-bold text-white hover:bg-white/10">
              Cancel
            </Link>
          </div>
        </form>

        {/* Attachments */}
        <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-bold mb-4 sm:text-xl">Attachments</h3>
          <div className="flex flex-col gap-3">
            {attachments.length === 0 ? (
              <p className="text-white/50 text-sm">No attachments yet.</p>
            ) : (
              <ul className="space-y-2">
                {attachments.map((f) => (
                  <li key={f.url} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-sm text-white/80 truncate flex-1 min-w-0">{displayFileName(f.name)}</span>
                    {f.createdAt && (
                      <span className="text-xs text-white/50">
                        {new Date(f.createdAt).toLocaleDateString()}
                      </span>
                    )}
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-white/20 px-3 py-1 text-xs font-bold hover:bg-white/10"
                    >
                      View / Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={handleUploadAttachment}
                disabled={isUploading}
              />
              <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                {isUploading ? "Uploading..." : "+ Upload"}
              </span>
            </label>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-bold mb-4 sm:text-xl">Activity Timeline</h3>
          {activityLogs.length === 0 ? (
            <p className="text-white/50 text-sm">No activity yet.</p>
          ) : (
            <div className="relative pl-4 border-l-2 border-white/20">
              {activityLogs.map((log) => (
                <div key={log.id} className="relative pb-6 last:pb-0">
                  <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-950" />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm text-white/90">
                      <span className="font-semibold text-white">{userNamesByUserId[log.user_id] ?? "Unknown"}</span>
                      {" "}
                      {ACTION_LABELS[log.action]?.(log.details) ?? log.action}
                    </p>
                    <p className="text-xs text-white/50">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="mt-10 pt-8 border-t border-white/10">
            <button
              type="button"
              onClick={handleDeleteStudent}
              disabled={isDeleting}
              className="rounded-lg bg-red-600 px-8 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete Student"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}