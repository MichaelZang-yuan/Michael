"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 如果已经登录，直接跳到 Dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push("/dashboard");
      }
    });
  }, [router]);

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
      router.push("/dashboard");
    }

    setIsLoggingIn(false);
  };

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