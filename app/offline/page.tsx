"use client";

export default function OfflineFallback() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-blue-50 px-4 text-center">
      <div className="mb-8 rounded-full bg-blue-100 p-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 1l22 22" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
      <h1 className="mb-4 text-3xl font-bold text-slate-800">You're Offline</h1>
      <p className="mb-8 max-w-md text-slate-600">
        It seems you've lost your internet connection. Finora Farm requires
        an active network connection to sync your dashboard and data.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95"
      >
        Try Again
      </button>
    </div>
  );
}
