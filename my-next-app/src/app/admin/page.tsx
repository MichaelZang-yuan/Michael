"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Visitor = {
  id: string;
  name: string;
  created_at: string;
};

type Profile = {
  full_name: string;
  role: string;
  department: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  accountant: "Accountant",
  sales: "Sales",
};

const DEPT_LABELS: Record<string, string> = {
  china: "China",
  thailand: "Thailand",
  myanmar: "Myanmar",
  korea_japan: "Korea & Japan",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-NZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        fetchProfile(session.user.id);
      }
    });
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, role, department")
      .eq("id", userId)
      .single();
    if (data) setProfile(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError("Invalid email or password");
    } else if (data.user) {
      setIsAuthenticated(true);
      fetchProfile(data.user.id);
    }

    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setProfile(null);
    setVisitors([]);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchVisitors() {
      setIsLoading(true);
      const { data } = await supabase
        .from("visitor_names")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });
      setVisitors(data ?? []);
      setIsLoading(false);
    }

    fetchVisitors();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-950 px-4">
        <form
          onSubmit={handleLogin}
          className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-white/20 bg-white/5 p-8 shadow-lg"
        >
          <h1 className="text-center text-2xl font-bold text-white">
            Commission Management System
          </h1>
          <p className="text-center text-white/60 text-sm">Please sign in to continue</p>

          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoggingIn ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Commission Management System</h1>
            {profile && (
              <p className="mt-1 text-white/60">
                👋 {profile.full_name} ·{" "}
                <span className="text-blue-400">{ROLE_LABELS[profile.role]}</span>
                {" · "}
                {DEPT_LABELS[profile.department]}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white hover:bg-blue-700"
            >
              Home
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/20 px-5 py-2.5 font-bold text-white hover:bg-white/10"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Visitor list */}
        {isLoading ? (
          <p className="text-center text-white/60 py-20">Loading...</p>
        ) : (
          <>
            <p className="mb-6 text-white/90">
              Total <span className="font-bold text-white">{visitors.length}</span> records
            </p>
            <div className="overflow-x-auto rounded-lg border border-white/20">
              <table className="w-full min-w-[400px] border-collapse">
                <thead>
                  <tr className="border-b border-white/20 bg-white/5">
                    <th className="px-6 py-4 text-left font-semibold">Name</th>
                    <th className="px-6 py-4 text-left font-semibold">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.map((visitor) => (
                    <tr key={visitor.id} className="border-b border-white/10 hover:bg-white/5 last:border-b-0">
                      <td className="px-6 py-3">{visitor.name}</td>
                      <td className="px-6 py-3 text-white/70">{formatDate(visitor.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visitors.length === 0 && (
              <p className="mt-6 text-center text-white/60">No records found</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}