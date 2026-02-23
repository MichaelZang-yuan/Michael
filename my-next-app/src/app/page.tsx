"use client";

import Link from "next/link";

export default function Home() {
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

      </div>

      <div className="flex justify-center pb-8">
        <Link href="/admin" className="text-sm text-white/30 underline hover:text-white">
          Admin
        </Link>
      </div>
    </div>
  );
}
