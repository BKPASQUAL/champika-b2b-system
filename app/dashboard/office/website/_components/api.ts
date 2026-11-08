// Small fetch helper for the website portal pages.
export async function webApi<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers || {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Session expired — please log out and log in again.");
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export const rs = (n: number | null | undefined) =>
  `Rs ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
