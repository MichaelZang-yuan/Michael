"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  accountant: "Accountant",
  sales: "Sales",
};

type NavbarProps = {
  hasUnsavedChanges?: boolean;
};

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/students", label: "Students" },
  { href: "/schools", label: "Schools" },
  { href: "/users", label: "Users", adminOnly: true },
];

export default function Navbar({ hasUnsavedChanges = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<{ full_name: string | null; role: string; department: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name, role, department")
        .eq("id", session.user.id)
        .single();

      if (data) setProfile(data);
    }
    loadProfile();
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      if (!window.confirm("You have unsaved changes. Are you sure you want to leave?")) return;
      router.push(href);
    }
    setMenuOpen(false);
  };

  const handleSignOut = async () => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
      return;
    }
    await supabase.auth.signOut();
    router.push("/admin");
  };

  const isAdmin = profile?.role === "admin";
  const visibleLinks = NAV_LINKS.filter((l) => !l.adminOnly || isAdmin);

  return (
    <nav className="bg-blue-950 border-b border-white/10 px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        {/* Left: Title */}
        <Link
          href="/dashboard"
          onClick={(e) => handleNavClick(e, "/dashboard")}
          className="text-base font-bold sm:text-xl text-white hover:text-white/90 shrink-0"
        >
          PJ Commission Management System
        </Link>

        {/* Center: Nav links (desktop) */}
        <div className="hidden md:flex items-center gap-2">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: User info + actions */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {profile && (
            <span className="hidden sm:inline text-white/60 text-sm truncate max-w-[200px]">
              {profile.full_name ?? "User"} · {ROLE_LABELS[profile.role] ?? profile.role}
              {profile.department && ` · ${DEPT_LABELS[profile.department] ?? profile.department}`}
            </span>
          )}
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
            className="md:hidden rounded-lg p-2 hover:bg-white/10"
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
        <div className="md:hidden mt-4 pt-4 border-t border-white/10 flex flex-col gap-1">
          {visibleLinks.map((link) => (
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
        </div>
      )}
    </nav>
  );
}
