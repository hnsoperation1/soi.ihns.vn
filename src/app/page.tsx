"use client";

import { useEffect, useState } from "react";

type FormatKey = "en" | "vi-short" | "en-long";

const STYLE_LABELS: Record<FormatKey, string> = {
  en: "Kiểu 1 (ngắn gọn, ---)",
  "vi-short": "Kiểu 2 (tiếng Việt, dài dòng)",
  "en-long": "Kiểu 2 (tiếng Anh, dài dòng)",
};

const STYLE_ORDER: FormatKey[] = ["en", "vi-short", "en-long"];

const AGENT_URL = "http://127.0.0.1:17345";

async function pingAgent(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`${AGENT_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export default function Home() {
  const [code, setCode] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formats, setFormats] = useState<Record<FormatKey, string> | null>(null);
  const [copiedKey, setCopiedKey] = useState<FormatKey | null>(null);
  // null = chưa dò xong, true/false = đã biết có Trợ lý cục bộ hay không
  const [agentAvailable, setAgentAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    pingAgent().then(setAgentAvailable);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFormats(null);

    // Re-check right before submitting too — the agent may have been started/stopped since
    // the page loaded (e.g. employee just launched it after seeing the "not detected" notice).
    const useAgent = agentAvailable ?? (await pingAgent());
    if (useAgent !== agentAvailable) setAgentAvailable(useAgent);

    try {
      const res = await fetch(useAgent ? `${AGENT_URL}/lookup` : "/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, lastName, firstName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Có lỗi xảy ra.");
        return;
      }
      setFormats(data.formats);
    } catch {
      setError("Không kết nối được tới máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(key: FormatKey, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      setError("Không copy được, vui lòng bôi đen và copy thủ công.");
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Tra cứu vé Vietjet</h1>
      <p className="mt-1 text-sm text-gray-500">
        Nhập thông tin giống form &quot;Chuyến bay của tôi&quot; trên vietjetair.com.
      </p>
      {agentAvailable === true && (
        <p className="mt-2 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
          ● Đang dùng Trợ lý cục bộ (nhanh)
        </p>
      )}
      {agentAvailable === false && (
        <p className="mt-2 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          ● Đang dùng máy chủ đám mây (có thể chậm hơn)
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Mã đặt chỗ</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            placeholder="2G9YTB"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Họ</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value.toUpperCase())}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            placeholder="TRAN"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Tên đệm và tên</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value.toUpperCase())}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            placeholder="CONG TRUONG"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Đang tra cứu..." : "Tìm kiếm"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {formats && (
        <div className="mt-6 space-y-4">
          {STYLE_ORDER.map((key) => (
            <div key={key} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{STYLE_LABELS[key]}</span>
                <button
                  onClick={() => handleCopy(key, formats[key])}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50"
                >
                  {copiedKey === key ? "Đã copy" : "Copy"}
                </button>
              </div>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">
                {formats[key]}
              </pre>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
