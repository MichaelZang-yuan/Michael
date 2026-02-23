"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [inputName, setInputName] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const name = inputName.trim();
    if (!name) {
      setMessage({ type: "error", text: "Please enter your name" });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const { error } = await supabase.from("visitor_names").insert({ name });

      if (error) throw error;

      setMessage({
        type: "success",
        text: `✅ Welcome, ${name}! Your name has been saved.`,
      });
      setInputName("");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Something went wrong, please try again";
      setMessage({ type: "error", text: `❌ ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-blue-950">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center">

        {/* Hero */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
            PJ Commission Management System
          </h1>
          <p className="text-lg text-white/60 sm:text-xl max-w-lg">
            Track student enrolments, manage commissions, and stay on top of claims — all in one place.
          </p>
        </div>

        {/* Sign in button */}
        <Link
          href="/admin"
          className="rounded-lg bg-blue-600 px-10 py-4 text-lg font-bold text-white hover:bg-blue-700"
        >
          Sign In
        </Link>

        {/* Visitor sign-in form */}
        <div className="mt-4 flex w-full max-w-md flex-col items-center gap-4">
          <h2 className="text-white/60 text-sm uppercase tracking-widest">
            Visitor Sign-in
          </h2>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:gap-2">
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="Enter your name"
              className="w-full min-w-0 rounded-lg bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500"
            />
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="shrink-0 rounded-lg bg-blue-600 px-8 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Submit"}
            </button>
          </div>
          {message && (
            <p className={`text-lg ${message.type === "success" ? "text-green-300" : "text-red-300"}`}>
              {message.text}
            </p>
          )}
        </div>

      </div>

      <div className="flex justify-center pb-8">
        <Link href="/admin" className="text-sm text-white/30 underline hover:text-white">
          Admin
        </Link>
      </div>
    </div>
  );
}