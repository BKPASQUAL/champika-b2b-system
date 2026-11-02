"use client";

// Per-invoice "checked" ticks on the Reconcile Delivery page.
// Ticks are saved in the browser per load, so they survive leaving the page
// to edit an invoice. Each tick remembers the invoice's amount, edit count and
// returns at the time it was ticked. If any of those change, the tick is
// removed and the change is shown until the invoice is ticked again.

import { useCallback, useEffect, useState } from "react";

export interface TickSnapshot {
  amount: number;
  edits: number; // number of invoice edit-history entries
  returnsSig: string; // returns on the invoice (ids + condition)
}

export interface TickChange {
  fromAmount: number;
  toAmount: number;
  edited: boolean;
  returnsChanged: boolean;
}

interface Stored {
  ticks: Record<string, TickSnapshot>;
  changes: Record<string, TickChange>;
}

const EMPTY: Stored = { ticks: {}, changes: {} };
const storageKey = (loadId: string) => `reconcile-ticks:${loadId}`;

function read(loadId: string): Stored {
  try {
    const raw = localStorage.getItem(storageKey(loadId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return { ticks: parsed.ticks || {}, changes: parsed.changes || {} };
  } catch {
    return EMPTY;
  }
}

function write(loadId: string, value: Stored) {
  try {
    localStorage.setItem(storageKey(loadId), JSON.stringify(value));
  } catch {
    /* storage unavailable — ticks just won't persist */
  }
}

export function clearReconcileTicks(loadId: string) {
  try {
    localStorage.removeItem(storageKey(loadId));
  } catch {
    /* ignore */
  }
}

/**
 * @param items current invoices with their snapshot; pass null while loading
 */
export function useReconcileTicks(loadId: string, items: { id: string; snapshot: TickSnapshot }[] | null) {
  const [state, setState] = useState<Stored>(EMPTY);

  // When invoices (re)load, compare each saved tick against the current data
  useEffect(() => {
    if (!items) return;
    const saved = read(loadId);
    const current = new Map(items.map((i) => [i.id, i.snapshot]));
    const ticks: Record<string, TickSnapshot> = {};
    const changes: Record<string, TickChange> = {};

    // Keep earlier changes that haven't been re-ticked yet
    Object.entries(saved.changes).forEach(([id, c]) => {
      if (current.has(id)) changes[id] = c;
    });

    Object.entries(saved.ticks).forEach(([id, snap]) => {
      const now = current.get(id);
      if (!now) return;
      const amountChanged = Math.abs(now.amount - snap.amount) > 0.005;
      const edited = now.edits !== snap.edits;
      const returnsChanged = now.returnsSig !== snap.returnsSig;
      if (amountChanged || edited || returnsChanged) {
        changes[id] = { fromAmount: snap.amount, toAmount: now.amount, edited, returnsChanged };
      } else {
        ticks[id] = snap;
      }
    });

    const next = { ticks, changes };
    write(loadId, next);
    setState(next);
  }, [loadId, items]);

  const update = useCallback(
    (fn: (prev: Stored) => Stored) => {
      setState((prev) => {
        const next = fn(prev);
        write(loadId, next);
        return next;
      });
    },
    [loadId]
  );

  const setTicked = useCallback(
    (id: string, snapshot: TickSnapshot, ticked: boolean) =>
      update((prev) => {
        const ticks = { ...prev.ticks };
        const changes = { ...prev.changes };
        if (ticked) {
          ticks[id] = snapshot;
          delete changes[id];
        } else {
          delete ticks[id];
        }
        return { ticks, changes };
      }),
    [update]
  );

  const setAll = useCallback(
    (list: { id: string; snapshot: TickSnapshot }[], ticked: boolean) =>
      update((prev) => {
        const ticks = { ...prev.ticks };
        const changes = { ...prev.changes };
        list.forEach(({ id, snapshot }) => {
          if (ticked) {
            ticks[id] = snapshot;
            delete changes[id];
          } else {
            delete ticks[id];
          }
        });
        return { ticks, changes };
      }),
    [update]
  );

  return {
    isTicked: (id: string) => !!state.ticks[id],
    changeFor: (id: string): TickChange | undefined => state.changes[id],
    setTicked,
    setAll,
  };
}
