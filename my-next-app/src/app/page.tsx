"use client";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-blue-950 text-center">
      <h1 className="text-5xl font-bold text-white md:text-6xl">
        你是我的宝贝
      </h1>
      <p className="text-xl text-white/90 md:text-2xl">
        我永远爱你
      </p>
      <button
        onClick={() => alert("但是你的脚丫子很臭！")}
        className="rounded-lg bg-blue-600 px-8 py-4 font-bold text-white hover:bg-blue-700"
      >
        点击我
      </button>
    </div>
  );
}
