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

export default function AdminPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVisitors() {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("visitor_names")
          .select("id, name, created_at")
          .order("created_at", { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setVisitors(data ?? []);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "加载数据失败，请稍后重试";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    fetchVisitors();
  }, []);

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
        ) : error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
            <p className="text-lg text-red-300">❌ {error}</p>
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
