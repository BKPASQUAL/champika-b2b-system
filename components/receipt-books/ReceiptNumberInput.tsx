"use client";

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReceiptBooks } from "@/hooks/useReceiptBooks";
import { BookOpen, AlertTriangle, Sparkles } from "lucide-react";

interface ReceiptNumberInputProps {
  value: string;
  onChange: (receiptNo: string, bookId?: string) => void;
  userId?: string;
  businessId?: string;
  required?: boolean;
  className?: string;
  label?: string;
  placeholder?: string;
  hideLabel?: boolean;
}

export function ReceiptNumberInput({
  value,
  onChange,
  userId,
  businessId,
  required = true,
  className = "",
  label = "Receipt Number",
  placeholder = "e.g. 1001",
  hideLabel = false,
}: ReceiptNumberInputProps) {
  const { receiptBooks, activeBook, suggestNextReceiptNumber, isReceiptNumberValid } =
    useReceiptBooks(userId, businessId);

  const [selectedBookId, setSelectedBookId] = useState<string>("");

  const currentBook = receiptBooks.find((b) => b.id === selectedBookId) || activeBook;

  // Auto-set selectedBookId when activeBook loads
  useEffect(() => {
    if (activeBook && !selectedBookId) {
      setSelectedBookId(activeBook.id);
    }
  }, [activeBook, selectedBookId]);

  // Auto-suggest value if value is empty when book loads
  useEffect(() => {
    if (currentBook && !value) {
      const nextNum = suggestNextReceiptNumber(currentBook);
      if (nextNum) {
        onChange(nextNum, currentBook.id);
      }
    }
  }, [currentBook]);

  const validation = value ? isReceiptNumberValid(value, currentBook) : { valid: true };

  const handleBookSelect = (bookId: string) => {
    setSelectedBookId(bookId);
    const book = receiptBooks.find((b) => b.id === bookId);
    if (book) {
      const nextNum = suggestNextReceiptNumber(book);
      onChange(nextNum, book.id);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {!hideLabel && (
        <div className="flex items-center justify-between">
          <Label>
            {label} {required && <span className="text-red-500">*</span>}
          </Label>
          {currentBook && (
            <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200 gap-1 font-normal">
              <BookOpen className="w-3 h-3 text-blue-500" /> Book #{currentBook.book_number} ({currentBook.start_number}-{currentBook.end_number})
            </Badge>
          )}
        </div>
      )}

      {/* Manual Book Selector if multiple books or manual adjust requested */}
      {receiptBooks.length > 1 && (
        <div className="text-xs space-y-1">
          <span className="text-muted-foreground font-medium">Select Assigned Book:</span>
          <Select value={selectedBookId || activeBook?.id || ""} onValueChange={handleBookSelect}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select Book" />
            </SelectTrigger>
            <SelectContent>
              {receiptBooks.map((book) => (
                <SelectItem key={book.id} value={book.id} className="text-xs">
                  Book #{book.book_number} ({book.start_number} - {book.end_number}) — Next: {book.current_number}
                  {book.assigned_to_user_name ? ` [Assigned: ${book.assigned_to_user_name}]` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value, currentBook?.id)}
          className={!validation.valid ? "border-red-500 focus-visible:ring-red-500" : ""}
        />

        {currentBook && value !== suggestNextReceiptNumber(currentBook) && (
          <button
            type="button"
            onClick={() => onChange(suggestNextReceiptNumber(currentBook), currentBook.id)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-medium flex items-center gap-1 transition-colors"
            title="Auto-fill next receipt number from active book"
          >
            <Sparkles className="w-3 h-3 text-blue-600" /> Auto-fill ({suggestNextReceiptNumber(currentBook)})
          </button>
        )}
      </div>

      {!validation.valid && validation.reason && (
        <p className="text-[11px] text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {validation.reason}
        </p>
      )}

      {hideLabel && currentBook && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
          <span>Book #{currentBook.book_number} ({currentBook.start_number}–{currentBook.end_number})</span>
          <span>Next: <strong className="text-blue-700">{currentBook.current_number}</strong></span>
        </div>
      )}
    </div>
  );
}

