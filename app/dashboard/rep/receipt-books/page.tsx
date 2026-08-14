"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { useReceiptBooks } from "@/hooks/useReceiptBooks";

export default function RepReceiptBooksPage() {
  const currentUser = getUserBusinessContext();
  const { receiptBooks, activeBook, loading, refetch } = useReceiptBooks(currentUser?.id || undefined);

  return (
    <div className="space-y-6 p-2 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 text-white shadow">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Receipt Books</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              View your assigned active receipt books and serial range progress
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={refetch} className="flex items-center gap-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Active Book Highlight Card */}
      {activeBook ? (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-purple-600 text-white font-semibold">Active Receipt Book</Badge>
              <span className="text-xs font-mono text-purple-700">Book #{activeBook.book_number}</span>
            </div>
            <CardTitle className="text-xl text-purple-950 mt-1">
              Next Receipt: <span className="font-mono text-purple-700 font-bold">#{activeBook.current_number}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Serial Range: {activeBook.start_number} to {activeBook.end_number}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {(() => {
              const total = Math.max(1, activeBook.end_number - activeBook.start_number + 1);
              const used = Math.min(total, Math.max(0, activeBook.current_number - activeBook.start_number));
              const progress = Math.round((used / total) * 100);
              return (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium text-purple-900">
                    <span>Receipt Usage</span>
                    <span>{used} of {total} issued ({progress}%)</span>
                  </div>
                  <Progress value={progress} className="h-2.5 bg-purple-100" />
                </div>
              );
            })()}
          </CardContent>
        </Card>
      ) : !loading ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-6 text-center text-amber-900 space-y-1">
            <AlertCircle className="h-8 w-8 text-amber-600 mx-auto mb-2" />
            <p className="font-semibold text-sm">No Active Receipt Book Currently Assigned</p>
            <p className="text-xs text-amber-700">Please contact your administrator or manager to issue a receipt book range.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* All Assigned Receipt Books Table */}
      <Card className="border-slate-200">
        <CardHeader className="py-4">
          <CardTitle className="text-base">Assigned Receipt Books History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading assigned books…
            </div>
          ) : receiptBooks.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              No receipt books assigned yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book #</TableHead>
                  <TableHead>Start #</TableHead>
                  <TableHead>End #</TableHead>
                  <TableHead>Next / Current #</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiptBooks.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-bold font-mono">#{b.book_number}</TableCell>
                    <TableCell className="font-mono">{b.start_number}</TableCell>
                    <TableCell className="font-mono">{b.end_number}</TableCell>
                    <TableCell className="font-mono font-bold text-purple-700">#{b.current_number}</TableCell>
                    <TableCell>
                      {b.status === "Active" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
                      ) : b.status === "Completed" ? (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Completed</Badge>
                      ) : (
                        <Badge variant="outline">{b.status}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
