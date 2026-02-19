"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [count, setCount] = useState(0);
  const [inputName, setInputName] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const name = inputName.trim();
    if (!name) {
      setMessage({ type: "error", text: "请输入名字" });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const { error } = await supabase.from("visitor_names").insert({
        name: name,
      });

      if (error) {
        throw error;
      }

      setMessage({
        type: "success",
        text: `✅ 你的名字已保存！你好，${name}`,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "保存失败，请稍后重试";
      setMessage({
        type: "error",
        text: `❌ ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-blue-950">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center sm:gap-8 sm:px-6 sm:py-12">
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        <h1 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
          你是我的宝贝
        </h1>
        <p className="text-3xl font-bold text-white sm:text-4xl md:text-5xl">
          你已经点击了 {count} 次
        </p>
        <p className="text-lg text-white/90 sm:text-xl md:text-2xl">
          我永远爱你
        </p>
      </div>

      <button
        onClick={() => setCount(count + 1)}
        className="rounded-lg bg-blue-600 px-8 py-4 font-bold text-white hover:bg-blue-700"
      >
        点我计数
      </button>

      <div className="mt-6 flex w-full max-w-md flex-col items-center gap-4 sm:mt-10 sm:gap-5">
        <h2 className="text-base text-white/90 sm:text-lg">
          或者告诉我宝儿的名字
        </h2>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:gap-2">
          <input
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder="请输入你宝儿名字"
            className="w-full min-w-0 rounded-lg bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500"
          />
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="shrink-0 rounded-lg bg-blue-600 px-8 py-4 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "提交中..." : "提交"}
          </button>
        </div>
        {message && (
          <p
            className={`text-lg sm:text-xl md:text-2xl ${
              message.type === "success" ? "text-green-300" : "text-red-300"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
      </div>

      <div className="flex justify-center pb-8">
        <Link
          href="/admin"
          className="text-sm text-gray-400 underline hover:text-white"
        >
          管理员入口
        </Link>
      </div>
    </div>
  );
}
