// A rep's return note with several items is saved as one inventory_returns row
// per item (RET-156005-1, RET-156005-2, ...), all tagged [NOTE:156005].
// These helpers put those rows back together so the note shows as one entry.

export function getReturnNoteCode(reason?: string | null): string | null {
  const m = (reason || "").match(/\[NOTE:([^\]]+)\]/);
  return m ? m[1].trim() : null;
}

/** Group return rows by customer + note code. Rows without a note code stay on their own. */
export function groupReturnsByNote<T extends { id: string; reason?: string | null; customer_id?: string | null; return_number?: string | null }>(
  rows: T[]
): { noteNo: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  rows.forEach((r) => {
    const code = getReturnNoteCode(r.reason);
    const key = code ? `${r.customer_id || ""}|${code}` : `id|${r.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });

  return [...groups.values()].map((items) => {
    items.sort((a, b) =>
      (a.return_number || "").localeCompare(b.return_number || "", undefined, { numeric: true })
    );
    const code = getReturnNoteCode(items[0].reason);
    const noteNo = items.length > 1 && code ? `RET-${code}` : items[0].return_number || `RET-${items[0].id.slice(0, 8)}`;
    return { noteNo, items };
  });
}
