"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Visitor = {
  id: string;
  name: string;
  created_at: string;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const ADMIN_PASSWORD = "admin123";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPassword("");
    } else {
      setError("密码错误");
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchVisitors() {
      try {
        setIsLoading(true);
        setFetchError(null);

        const { data, error: err } = await supabase
          .from("visitor_names")
          .select("id, name, created_at")
          .order("created_at", { ascending: false });

        if (err) {
          throw err;
        }

        setVisitors(data ?? []);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "加载数据失败，请稍后重试";
        setFetchError(errorMessage);
      } finally {
        setIsLoading(false);
      }
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
            访问者管理
          </h1>
          <p className="text-center text-white/80">请输入密码以继续</p>
          <div className="flex flex-col gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            />
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
          >
            进入
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold sm:text-4xl">访问者管理</h1>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
          >
            返回主页
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-xl text-white/80">加载中...</p>
          </div>
        ) : fetchError ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
            <p className="text-lg text-red-300">❌ {fetchError}</p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-lg text-white/90">
              共 <span className="font-bold text-white">{visitors.length}</span> 条记录
            </p>

            <div className="overflow-x-auto rounded-lg border border-white/20">
              <table className="w-full min-w-[400px] border-collapse">
                <thead>
                  <tr className="border-b border-white/20 bg-white/5">
                    <th className="px-4 py-4 text-left font-semibold sm:px-6">
                      ID
                    </th>
                    <th className="px-4 py-4 text-left font-semibold sm:px-6">
                      名字
                    </th>
                    <th className="px-4 py-4 text-left font-semibold sm:px-6">
                      创建时间
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.map((visitor) => (
                    <tr
                      key={visitor.id}
                      className="border-b border-white/10 transition-colors hover:bg-white/5 last:border-b-0"
                    >
                      <td className="px-4 py-3 font-mono text-sm text-white/80 sm:px-6">
                        {String(visitor.id)}
                      </td>
                      <td className="px-4 py-3 sm:px-6">{visitor.name}</td>
                      <td className="px-4 py-3 text-white/90 sm:px-6">
                        {formatDate(visitor.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {visitors.length === 0 && (
              <p className="mt-6 text-center text-white/60">
                暂无访问者记录
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
