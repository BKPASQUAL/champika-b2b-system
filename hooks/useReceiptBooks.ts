"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export interface ReceiptBook {
  id: string;
  book_number: string;
  start_number: number;
  end_number: number;
  current_number: number;
  assigned_to_user_id: string | null;
  assigned_to_user_name: string | null;
  business_id: string | null;
  status: "Active" | "Completed" | "Cancelled";
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
}

export interface ReceiptBookAudit {
  id: string;
  receipt_book_id: string | null;
  action_type: "CREATED" | "ASSIGNED" | "EDITED" | "RECEIPT_ISSUED" | "STATUS_CHANGED" | "CANCELLED" | "COMPLETED";
  book_number: string | null;
  start_number_old: number | null;
  start_number_new: number | null;
  end_number_old: number | null;
  end_number_new: number | null;
  assigned_to_old_name: string | null;
  assigned_to_new_name: string | null;
  receipt_number: string | null;
  performed_by_name: string | null;
  performed_by_email: string | null;
  notes: string | null;
  created_at: string;
}

export function useReceiptBooks(userId?: string, businessId?: string) {
  const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBook, setActiveBook] = useState<ReceiptBook | null>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userId) params.append("userId", userId);
      if (businessId) params.append("businessId", businessId);
      params.append("status", "Active");

      const res = await fetch(`/api/receipt-books?${params.toString()}`);
      if (res.ok) {
        const data: ReceiptBook[] = await res.json();
        setReceiptBooks(data);

        // Active book for the user
        const currentActive = data.find((b) => b.status === "Active" && b.current_number <= b.end_number) || data[0] || null;
        setActiveBook(currentActive);
      } else {
        toast.error("Failed to load assigned receipt books");
      }
    } catch {
      toast.error("Error fetching receipt books");
    } finally {
      setLoading(false);
    }
  }, [userId, businessId]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const suggestNextReceiptNumber = (book?: ReceiptBook | null): string => {
    const target = book || activeBook;
    if (!target) return "";
    return String(target.current_number);
  };

  const isReceiptNumberValid = (receiptNo: string, book?: ReceiptBook | null): { valid: boolean; reason?: string } => {
    const target = book || activeBook;
    if (!target) {
      return { valid: true }; // Allowed if no strict book assigned
    }
    const num = parseInt(receiptNo, 10);
    if (isNaN(num)) {
      return { valid: false, reason: "Receipt number must be a valid number" };
    }
    if (num < target.start_number || num > target.end_number) {
      return {
        valid: false,
        reason: `Receipt number #${num} is outside assigned book range (${target.start_number} - ${target.end_number})`,
      };
    }
    return { valid: true };
  };

  return {
    receiptBooks,
    activeBook,
    loading,
    refetch: fetchBooks,
    suggestNextReceiptNumber,
    isReceiptNumberValid,
  };
}
