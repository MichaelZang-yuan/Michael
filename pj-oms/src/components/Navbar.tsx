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

type NavbarProps = { hasUnsavedChanges?: boolean };

type NavLink = { href: string; label: string };

const CRM_LINKS: NavLink[] = [
  { href: "/crm", label: "CRM Dashboard" },
  { href: "/contacts", label: "Contacts" },
  { href: "/companies", label: "Companies" },
  { href: "/agents", label: "Agents" },
  { href: "/deals", label: "Deals" },
  { href: "/invoices", label: "Invoices" },
];

const STUDENT_SERVICE_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Student Service Dashboard" },
  { href: "/students", label: "Students" },
  { href: "/schools", label: "Schools" },
];

const FINANCE_LINKS: NavLink[] = [
  { href: "/finance", label: "Financial Dashboard" },
  { href: "/finance/revenue", label: "Revenue Report" },
  { href: "/finance/ar", label: "Accounts Receivable" },
  { href: "/finance/refunds", label: "Refunds" },
  { href: "/finance/foreign-payments", label: "Foreign Payments" },
];

const REPORTS_LINKS: NavLink[] = [
  { href: "/reports", label: "Commission Reports" },
  { href: "/reports/staff-commission", label: "Staff Commission" },
];

const SETTINGS_LINKS: NavLink[] = [
  { href: "/settings/contract-templates", label: "Contract Templates" },
  { href: "/settings/intake-templates", label: "Intake Form Templates" },
  { href: "/settings/xero", label: "Xero Connection" },
  { href: "/settings/price-list", label: "Price List" },
  { href: "/emails", label: "Emails" },
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

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function isGroupActive(pathname: string, links: NavLink[]) {
  return links.some((l) => isActive(pathname, l.href));
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export default function Navbar({ hasUnsavedChanges = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<{
    full_name: string | null; role: string; roles: string[]; department: string;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDD, setOpenDD] = useState<string | null>(null);
  const [mobileDD, setMobileDD] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifications, setNotifications] = useState<{
    id: string; title: string; message: string; type: string;
    link: string | null; is_read: boolean; created_at: string;
  }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifCount = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/notifications/count?user_id=${uid}`);
      if (res.ok) { const d = await res.json(); setNotifCount(d.count ?? 0); }
    } catch { /* ignore */ }
  }, []);

  const fetchNotifications = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/notifications?user_id=${uid}&limit=10`);
      if (res.ok) { const d = await res.json(); setNotifications(d.notifications ?? []); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const { data } = await supabase
        .from("profiles").select("full_name, role, roles, department")
        .eq("id", session.user.id).single();
      if (data) setProfile(data);
      fetchNotifCount(session.user.id);
    }
    load();
  }, [fetchNotifCount]);

  useEffect(() => {
    if (!userId) return;
    const iv = setInterval(() => fetchNotifCount(userId), 30000);
    return () => clearInterval(iv);
  }, [userId, fetchNotifCount]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (desktopNavRef.current && !desktopNavRef.current.contains(target)) {
        setOpenDD(null);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const nav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      if (!window.confirm("You have unsaved changes. Are you sure you want to leave?")) return;
      router.push(href);
    }
    setMenuOpen(false); setOpenDD(null); setNotifOpen(false);
  };

  const handleSignOut = async () => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Are you sure you want to leave?")) return;
    await supabase.auth.signOut();
    router.push("/admin");
  };

  const toggle = (name: string) => {
    setOpenDD((p) => (p === name ? null : name));
    setNotifOpen(false);
  };

  const admin = hasRole(profile, "admin");
  const lia = hasRole(profile, "lia");
  const showLia = admin || lia;
  const showSS = hasAnyRole(profile, ["admin", "sales", "accountant", "copywriter"]);
  const showFin = hasAnyRole(profile, ["admin", "accountant"]);

  /* ─── Desktop dropdown ─── */
  const dd = (name: string, label: string, links: NavLink[], right = false) => (
    <div className="relative">
      <button
        onClick={() => toggle(name)}
        className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isGroupActive(pathname, links)
            ? "bg-white/10 text-white"
            : "text-white/70 hover:text-white hover:bg-white/5"
        }`}
      >
        {label}
        <Chevron open={openDD === name} />
      </button>
      {openDD === name && (
        <div
          className={`absolute top-full ${right ? "right-0" : "left-0"} mt-1 w-56 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-blue-900 shadow-xl z-50`}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={(e) => nav(e, l.href)}
              className={`block px-4 py-2.5 text-sm font-medium transition-colors first:rounded-t-lg last:rounded-b-lg ${
                isActive(pathname, l.href)
                  ? "bg-blue-50 text-blue-700 dark:bg-white/10 dark:text-white"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  /* ─── Mobile section ─── */
  const mob = (name: string, label: string, links: NavLink[]) => (
    <>
      <button
        onClick={() => setMobileDD((p) => (p === name ? null : name))}
        className={`flex items-center justify-between w-full rounded-lg px-4 py-3 text-sm font-bold ${
          isGroupActive(pathname, links)
            ? "bg-white/10 text-white"
            : "text-white/70 hover:text-white hover:bg-white/5"
        }`}
      >
        {label}
        <Chevron open={mobileDD === name} />
      </button>
      {mobileDD === name && (
        <div className="ml-4 flex flex-col gap-0.5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={(e) => nav(e, l.href)}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
                isActive(pathname, l.href)
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );

  return (
    <nav className="bg-blue-950 border-b border-blue-900 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/crm"
          onClick={(e) => nav(e, "/crm")}
          className="text-sm font-bold text-white hover:text-white/90 shrink-0"
        >
          PJ OMS
        </Link>

        {/* Desktop nav */}
        <div ref={desktopNavRef} className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {dd("crm", "CRM", CRM_LINKS)}
          {showSS && dd("ss", "Student Service", STUDENT_SERVICE_LINKS)}
          {showLia && (
            <Link
              href="/lia"
              onClick={(e) => nav(e, "/lia")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(pathname, "/lia")
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              LIA Dashboard
            </Link>
          )}
          {showFin && dd("fin", "Finance", FINANCE_LINKS)}
          {admin && dd("rep", "Reports", REPORTS_LINKS)}
          {admin && dd("set", "Settings", SETTINGS_LINKS, true)}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {profile && (
            <span className="hidden xl:inline text-white/60 text-sm truncate max-w-[200px]">
              {profile.full_name ?? "User"} · {formatRoles(profile.roles)}
              {profile.department && ` · ${DEPT_LABELS[profile.department] ?? profile.department}`}
            </span>
          )}

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                const opening = !notifOpen;
                setNotifOpen(opening);
                setOpenDD(null);
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
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-blue-900 shadow-2xl z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h4>
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
                        setNotifications((n) => n.map((x) => ({ ...x, is_read: true })));
                      }}
                      className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-400 dark:text-white/40">No notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={async () => {
                          if (!n.is_read) {
                            await fetch(`/api/notifications/${n.id}/read`, { method: "PUT" });
                            setNotifCount((c) => Math.max(0, c - 1));
                            setNotifications((prev) =>
                              prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
                            );
                          }
                          setNotifOpen(false);
                          if (n.link) router.push(n.link);
                        }}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex gap-3 ${
                          !n.is_read
                            ? "border-l-2 border-l-blue-500 dark:border-l-blue-400"
                            : "border-l-2 border-l-transparent"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-semibold truncate ${
                              !n.is_read
                                ? "text-gray-900 dark:text-white"
                                : "text-gray-500 dark:text-white/70"
                            }`}
                          >
                            {n.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
                            {formatTimeAgo(n.created_at)}
                          </p>
                        </div>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0 mt-1.5" />
                        )}
                      </button>
                    ))
                  )}
                </div>
                <div className="px-4 py-2.5 border-t border-gray-200 dark:border-white/10">
                  <Link
                    href="/notifications"
                    onClick={(e) => {
                      nav(e, "/notifications");
                      setNotifOpen(false);
                    }}
                    className="block text-center text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    View All Notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/profile"
            onClick={(e) => nav(e, "/profile")}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 whitespace-nowrap"
          >
            My Profile
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 whitespace-nowrap"
          >
            Sign Out
          </button>

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => {
              const next = !menuOpen;
              setMenuOpen(next);
              setOpenDD(null);
              if (!next) setMobileDD(null);
            }}
            className="lg:hidden rounded-lg p-2 hover:bg-white/10 text-white"
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
          {mob("crm", "CRM", CRM_LINKS)}
          {showSS && mob("ss", "Student Service", STUDENT_SERVICE_LINKS)}
          {showLia && (
            <Link
              href="/lia"
              onClick={(e) => nav(e, "/lia")}
              className={`rounded-lg px-4 py-3 text-sm font-bold ${
                pathname === "/lia"
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              LIA Dashboard
            </Link>
          )}
          {showFin && mob("fin", "Finance", FINANCE_LINKS)}
          {admin && mob("rep", "Reports", REPORTS_LINKS)}
          {admin && mob("set", "Settings", SETTINGS_LINKS)}

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
