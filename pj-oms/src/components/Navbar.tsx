"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasRole, hasAnyRole, formatRoles } from "@/lib/roles";
import { Bell } from "lucide-react";

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

type NavbarProps = {
  hasUnsavedChanges?: boolean;
};

// Top-level CRM links
const CRM_TOP_LINKS = [
  { href: "/crm", label: "CRM Dashboard" },
  { href: "/contacts", label: "Contacts" },
  { href: "/companies", label: "Companies" },
  { href: "/agents", label: "Agents" },
  { href: "/deals", label: "Deals" },
  { href: "/invoices", label: "Invoices" },
];

// Commission sub-menu
const COMMISSION_LINKS = [
  { href: "/dashboard", label: "Commission Dashboard" },
  { href: "/students", label: "Students" },
  { href: "/schools", label: "Schools" },
  { href: "/commission/invoices", label: "Commission Invoices" },
];

// Reports sub-menu (admin only)
const REPORTS_LINKS = [
  { href: "/reports", label: "Commission Reports" },
  { href: "/reports/staff-commission", label: "Staff Commission" },
  { href: "/reports/agent-commissions", label: "Agent Commissions" },
];

// Finance sub-menu (admin + accountant)
const FINANCE_LINKS = [
  { href: "/finance", label: "Financial Dashboard" },
  { href: "/finance/revenue", label: "Revenue Report" },
  { href: "/finance/ar", label: "Accounts Receivable" },
  { href: "/finance/refunds", label: "Refunds" },
  { href: "/finance/foreign-payments", label: "Foreign Payments" },
];

// Admin-only links
const ADMIN_LINKS = [
  { href: "/emails", label: "Emails" },
];

// Settings sub-menu (admin only)
const SETTINGS_LINKS = [
  { href: "/settings/contract-templates", label: "Contract Templates" },
  { href: "/settings/intake-templates", label: "Intake Form Templates" },
  { href: "/settings/price-list", label: "Price List" },
  { href: "/settings/xero", label: "Xero Connection" },
  { href: "/logs", label: "Logs" },
  { href: "/users", label: "Users" },
];

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function Navbar({ hasUnsavedChanges = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<{ full_name: string | null; role: string; roles: string[]; department: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifications, setNotifications] = useState<{
    id: string; title: string; message: string; type: string;
    link: string | null; is_read: boolean; created_at: string;
  }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const commissionRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const reportsRef = useRef<HTMLDivElement>(null);
  const financeRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifCount = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/notifications/count?user_id=${uid}`);
      if (res.ok) {
        const data = await res.json();
        setNotifCount(data.count ?? 0);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchNotifications = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/notifications?user_id=${uid}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role, roles, department")
        .eq("id", session.user.id)
        .single();
      if (data) setProfile(data);
      fetchNotifCount(session.user.id);
    }
    loadProfile();
  }, [fetchNotifCount]);

  // Poll unread count every 30s
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => fetchNotifCount(userId), 30000);
    return () => clearInterval(interval);
  }, [userId, fetchNotifCount]);

  // Close dropdowns when clicking outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (commissionRef.current && !commissionRef.current.contains(e.target as Node)) setCommissionOpen(false);
    if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    if (reportsRef.current && !reportsRef.current.contains(e.target as Node)) setReportsOpen(false);
    if (financeRef.current && !financeRef.current.contains(e.target as Node)) setFinanceOpen(false);
    if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
  }, []);
  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      if (!window.confirm("You have unsaved changes. Are you sure you want to leave?")) return;
      router.push(href);
    }
    setMenuOpen(false);
    setCommissionOpen(false);
    setSettingsOpen(false);
    setReportsOpen(false);
    setFinanceOpen(false);
    setNotifOpen(false);
  };

  const handleSignOut = async () => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Are you sure you want to leave?")) return;
    await supabase.auth.signOut();
    router.push("/admin");
  };

  const isAdmin = hasRole(profile, "admin");
  const isLia = hasRole(profile, "lia");
  const showLiaDashboard = isAdmin || isLia;
  // Show Commission if user has ANY non-lia role (admin/sales/accountant), even if also LIA
  const showCommission = hasAnyRole(profile, ["admin", "sales", "accountant", "copywriter"]);

  const showFinance = hasAnyRole(profile, ["admin", "accountant"]);
  const isCommissionActive = COMMISSION_LINKS.some(l => pathname === l.href || pathname.startsWith(l.href + "/"));
  const isReportsActive = REPORTS_LINKS.some(l => pathname === l.href || pathname.startsWith(l.href + "/"));
  const isFinanceActive = FINANCE_LINKS.some(l => pathname === l.href || pathname.startsWith(l.href + "/"));

  const linkClass = (href: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      pathname === href || pathname.startsWith(href + "/")
        ? "bg-white/10 text-white"
        : "text-white/70 hover:text-white hover:bg-white/5"
    }`;

  return (
    <nav className="bg-blue-950 border-b border-white/10 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">

        {/* Left: Title → links to CRM Dashboard */}
        <Link
          href="/crm"
          onClick={(e) => handleNavClick(e, "/crm")}
          className="text-sm font-bold text-white hover:text-white/90 shrink-0"
        >
          PJ OMS
        </Link>

        {/* Center: Nav links (desktop) */}
        <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">

          {/* CRM top-level links */}
          {CRM_TOP_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className={linkClass(link.href)}
            >
              {link.label}
            </Link>
          ))}

          {/* Commission dropdown (hidden for LIA) */}
          {showCommission && (
            <div className="relative" ref={commissionRef}>
              <button
                onClick={() => setCommissionOpen(!commissionOpen)}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isCommissionActive
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                Commission
                <svg
                  className={`w-3 h-3 transition-transform ${commissionOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {commissionOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 rounded-lg border border-white/10 bg-blue-900 shadow-xl z-50">
                  {COMMISSION_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        pathname === link.href || pathname.startsWith(link.href + "/")
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LIA Dashboard (lia + admin) */}
          {showLiaDashboard && (
            <Link
              href="/lia"
              onClick={(e) => handleNavClick(e, "/lia")}
              className={linkClass("/lia")}
            >
              LIA Dashboard
            </Link>
          )}

          {/* Finance dropdown (admin + accountant) */}
          {showFinance && (
            <div className="relative" ref={financeRef}>
              <button
                onClick={() => setFinanceOpen(!financeOpen)}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isFinanceActive
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                Finance
                <svg className={`w-3 h-3 transition-transform ${financeOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {financeOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 rounded-lg border border-white/10 bg-blue-900 shadow-xl z-50">
                  {FINANCE_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        pathname === link.href || pathname.startsWith(link.href + "/")
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reports dropdown (admin only) */}
          {isAdmin && (
            <div className="relative" ref={reportsRef}>
              <button
                onClick={() => setReportsOpen(!reportsOpen)}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isReportsActive
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                Reports
                <svg className={`w-3 h-3 transition-transform ${reportsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {reportsOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 rounded-lg border border-white/10 bg-blue-900 shadow-xl z-50">
                  {REPORTS_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        pathname === link.href || pathname.startsWith(link.href + "/")
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Admin-only links */}
          {isAdmin && ADMIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className={linkClass(link.href)}
            >
              {link.label}
            </Link>
          ))}

          {/* Settings dropdown (admin only) */}
          {isAdmin && (
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  SETTINGS_LINKS.some(l => pathname.startsWith(l.href))
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                Settings
                <svg className={`w-3 h-3 transition-transform ${settingsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {settingsOpen && (
                <div className="absolute top-full right-0 mt-1 w-52 rounded-lg border border-white/10 bg-blue-900 shadow-xl z-50">
                  {SETTINGS_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        pathname.startsWith(link.href)
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: User info + actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {profile && (
            <span className="hidden xl:inline text-white/60 text-sm truncate max-w-[200px]">
              {profile.full_name ?? "User"} · {formatRoles(profile.roles)}
              {profile.department && ` · ${DEPT_LABELS[profile.department] ?? profile.department}`}
            </span>
          )}

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                const opening = !notifOpen;
                setNotifOpen(opening);
                if (opening && userId) fetchNotifications(userId);
              }}
              className="relative rounded-lg p-2 hover:bg-white/10 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-white/70" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {notifCount > 99 ? "99+" : notifCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-white/10 bg-blue-900 shadow-2xl z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <h4 className="text-sm font-bold text-white">Notifications</h4>
                  {notifCount > 0 && (
                    <button
                      onClick={async () => {
                        if (!userId) return;
                        await fetch("/api/notifications/read-all", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ user_id: userId }),
                        });
                        setNotifCount(0);
                        setNotifications(n => n.map(x => ({ ...x, is_read: true })));
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-white/40">No notifications</p>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={async () => {
                          if (!n.is_read) {
                            await fetch(`/api/notifications/${n.id}/read`, { method: "PUT" });
                            setNotifCount(c => Math.max(0, c - 1));
                            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
                          }
                          setNotifOpen(false);
                          if (n.link) router.push(n.link);
                        }}
                        className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors flex gap-3 ${
                          !n.is_read ? "border-l-2 border-l-blue-400" : "border-l-2 border-l-transparent"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${!n.is_read ? "text-white" : "text-white/70"}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-xs text-white/30 mt-1">
                            {formatTimeAgo(n.created_at)}
                          </p>
                        </div>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                        )}
                      </button>
                    ))
                  )}
                </div>
                <div className="px-4 py-2.5 border-t border-white/10">
                  <Link
                    href="/notifications"
                    onClick={(e) => { handleNavClick(e, "/notifications"); setNotifOpen(false); }}
                    className="block text-center text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    View All Notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/profile"
            onClick={(e) => handleNavClick(e, "/profile")}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold hover:bg-white/10 whitespace-nowrap"
          >
            My Profile
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold hover:bg-white/10 whitespace-nowrap"
          >
            Sign Out
          </button>

          {/* Hamburger (mobile) */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden rounded-lg p-2 hover:bg-white/10"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden mt-4 pt-4 border-t border-white/10 flex flex-col gap-1">

          {/* CRM section */}
          <p className="px-4 py-1 text-xs font-bold text-white/40 uppercase tracking-wider">CRM</p>
          {CRM_TOP_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* LIA Dashboard (lia + admin) */}
          {showLiaDashboard && (
            <Link
              href="/lia"
              onClick={(e) => handleNavClick(e, "/lia")}
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                pathname === "/lia" ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              LIA Dashboard
            </Link>
          )}

          {/* Commission section (not for LIA) */}
          {showCommission && (
            <>
              <p className="mt-2 px-4 py-1 text-xs font-bold text-white/40 uppercase tracking-wider">Commission</p>
              {COMMISSION_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`rounded-lg px-4 py-3 text-sm font-medium ${
                    pathname === link.href || pathname.startsWith(link.href + "/")
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </>
          )}

          {/* Reports section (admin only) */}
          {isAdmin && (
            <>
              <p className="mt-2 px-4 py-1 text-xs font-bold text-white/40 uppercase tracking-wider">Reports</p>
              {REPORTS_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`rounded-lg px-4 py-3 text-sm font-medium ${
                    pathname === link.href || pathname.startsWith(link.href + "/")
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </>
          )}

          {/* Finance section (admin + accountant) */}
          {showFinance && (
            <>
              <p className="mt-2 px-4 py-1 text-xs font-bold text-white/40 uppercase tracking-wider">Finance</p>
              {FINANCE_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`rounded-lg px-4 py-3 text-sm font-medium ${
                    pathname === link.href || pathname.startsWith(link.href + "/")
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </>
          )}

          {/* Admin section */}
          {isAdmin && (
            <>
              <p className="mt-2 px-4 py-1 text-xs font-bold text-white/40 uppercase tracking-wider">Admin</p>
              {ADMIN_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`rounded-lg px-4 py-3 text-sm font-medium ${
                    pathname === link.href
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <p className="mt-2 px-4 py-1 text-xs font-bold text-white/40 uppercase tracking-wider">Settings</p>
              {SETTINGS_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`rounded-lg px-4 py-3 text-sm font-medium ${
                    pathname.startsWith(link.href)
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </>
          )}

          {/* User info (mobile) */}
          {profile && (
            <p className="mt-3 px-4 py-2 text-xs text-white/40">
              {profile.full_name ?? "User"} · {formatRoles(profile.roles)}
              {profile.department && ` · ${DEPT_LABELS[profile.department] ?? profile.department}`}
            </p>
          )}
        </div>
      )}
    </nav>
  );
}
