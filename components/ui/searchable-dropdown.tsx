"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableDropdownProps {
  options: { id: string; name: string; info?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onSelectCallback?: () => void;
}

export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  searchInputRef,
  onSelectCallback,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRefToUse = searchInputRef || internalInputRef;
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(search.toLowerCase()) ||
    (option.info && option.info.toLowerCase().includes(search.toLowerCase())),
  );

  const selectedOption = options.find((o) => o.id === value);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < filteredOptions.length - 1 ? prev + 1 : prev;
        itemRefs.current[next]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : prev;
        itemRefs.current[next]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        onChange(filteredOptions[highlightedIndex].id);
        setIsOpen(false);
        setSearch("");
        if (onSelectCallback) onSelectCallback();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div className="relative">
        <div
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            disabled ? "opacity-50 pointer-events-none" : "cursor-text",
          )}
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
              setTimeout(() => {
                if (inputRefToUse.current) {
                  inputRefToUse.current.focus();
                }
              }, 0);
            }
          }}
        >
          {isOpen ? (
            <input
              ref={inputRefToUse as React.RefObject<HTMLInputElement>}
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <span
              className={
                selectedOption ? "text-foreground" : "text-muted-foreground"
              }
            >
              {selectedOption ? selectedOption.name : placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option, index) => (
                <div
                  key={option.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                    value === option.id && "bg-accent text-accent-foreground",
                    highlightedIndex === index
                      ? "bg-red-100 text-red-900" // Highlight color
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                    setSearch("");
                    if (onSelectCallback) onSelectCallback();
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.name}</span>
                    {option.info && (
                      <span className="text-xs text-muted-foreground">
                        {option.info}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
