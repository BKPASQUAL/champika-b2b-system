"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReceiptBooks } from "@/hooks/useReceiptBooks";

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
  const { activeBook } = useReceiptBooks(userId, businessId);

  return (
    <div className={`space-y-2 ${className}`}>
      {!hideLabel && (
        <Label>
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value, activeBook?.id)}
      />
    </div>
  );
}
