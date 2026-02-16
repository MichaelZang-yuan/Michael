"use client";

import { useState } from "react";

export default function Home() {
  const [count, setCount] = useState(0);
  const [inputName, setInputName] = useState("");
  const [submittedName, setSubmittedName] = useState("");

  const handleSubmit = () => {
    setSubmittedName(inputName);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-blue-950 px-4 py-8 text-center sm:gap-8 sm:px-6 sm:py-12">
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
            className="shrink-0 rounded-lg bg-blue-600 px-8 py-4 font-bold text-white hover:bg-blue-700"
          >
            提交
          </button>
        </div>
        {submittedName && (
          <p className="text-lg text-white sm:text-xl md:text-2xl">
            你好，{submittedName}！欢迎来到我的网站 😊
          </p>
        )}
      </div>
    </div>
  );
}
