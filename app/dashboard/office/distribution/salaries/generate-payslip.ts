import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

/* ─── Types ────────────────────────────────────────────────────────────── */
export interface PayslipData {
  profiles?: { full_name?: string; email?: string };
  salary_month: string;
  payment_date?: string;
  working_days?: number;
  night_out_days?: number;
  basic_salary: number;
  auto_commissions: number;
  manual_commissions_added: number;
  manual_commissions_deducted: number;
  target_bonus_amount: number;
  other_deductions: number;
  lunch_allowance: number;
  night_out_allowance: number;
  net_salary: number;
  admin_approval_status: string;
  approved_at?: string;
}

const fmt = (n: number) =>
  `LKR ${(n ?? 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ─── Core PDF builder ─────────────────────────────────────────────────── */
export function buildPayslipPDF(salary: PayslipData): jsPDF {
  const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W      = doc.internal.pageSize.width;   // 210 mm
  const margin = 14;
  const colR   = W - margin;                    // right edge

  let y = 0;

  /* ── 1. Company header band ── */
  doc.setFillColor(30, 41, 59);   // slate-800
  doc.rect(0, 0, W, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("CHAMPIKA HARDWARE DISTRIBUTION", margin, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);  // slate-400
  doc.text("Champika Hardware · Distribution Division · Sri Lanka", margin, 17);

  // "PAY SLIP" label on right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(250, 204, 21);   // amber-400
  doc.text("PAY SLIP", colR, 16, { align: "right" });

  y = 34;

  /* ── 2. Meta row (month / employee / status) ── */
  doc.setDrawColor(226, 232, 240);  // slate-200
  doc.setLineWidth(0.2);
  doc.rect(margin, y, W - margin * 2, 22, "S");

  // Left: employee info
  doc.setTextColor(100, 116, 139);  // slate-500
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("EMPLOYEE", margin + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(salary.profiles?.full_name ?? "—", margin + 4, y + 13);
  if (salary.profiles?.email) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(salary.profiles.email, margin + 4, y + 18);
  }

  // Centre: pay period
  const cx = W / 2;
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("PAY PERIOD", cx, y + 6, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(salary.salary_month ?? "—", cx, y + 13, { align: "center" });
  if (salary.payment_date) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Released: ${new Date(salary.payment_date).toLocaleDateString("en-LK", { day: "numeric", month: "long", year: "numeric" })}`,
      cx, y + 18, { align: "center" }
    );
  }

  // Right: status
  const statusColor: Record<string, [number, number, number]> = {
    Approved: [22, 163, 74],   // green-600
    Rejected: [220, 38, 38],   // red-600
    Pending:  [217, 119, 6],   // amber-600
  };
  const sc = statusColor[salary.admin_approval_status] ?? [100, 116, 139];
  doc.setFillColor(...sc);
  doc.roundedRect(colR - 32, y + 5, 32, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(salary.admin_approval_status.toUpperCase(), colR - 16, y + 13, { align: "center" });

  y += 30;

  /* ── 3. Attendance strip ── */
  const halfW = (W - margin * 2) / 2 - 2;
  const drawAttendBox = (x: number, label: string, value: number, rgb: [number, number, number]) => {
    doc.setFillColor(rgb[0], rgb[1], rgb[2], 0.08);
    doc.setFillColor(248, 250, 252);
    doc.rect(x, y, halfW, 14, "F");
    doc.setDrawColor(...rgb);
    doc.setLineWidth(0.3);
    doc.rect(x, y, halfW, 14, "S");

    doc.setFillColor(...rgb);
    doc.rect(x, y, 3, 14, "F");

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(label.toUpperCase(), x + 6, y + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text(`${value} days`, x + 6, y + 11.5);
  };

  drawAttendBox(margin,              "Working Days",    salary.working_days ?? 0,    [59, 130, 246]);   // blue-500
  drawAttendBox(margin + halfW + 4,  "Night Out Days",  salary.night_out_days ?? 0,  [139, 92, 246]);   // violet-500

  y += 20;

  /* ── 4. Earnings table ── */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("EARNINGS", margin, y + 4);
  y += 7;

  const earningsRows: [string, string][] = [
    ["Basic Salary",                         fmt(salary.basic_salary)],
    ["Auto Commissions (from sales)",        fmt(salary.auto_commissions)],
  ];
  if (salary.manual_commissions_added > 0)
    earningsRows.push(["Manual Commission (Addition)",    fmt(salary.manual_commissions_added)]);
  if (salary.lunch_allowance > 0)
    earningsRows.push(["Lunch Allowance",                 fmt(salary.lunch_allowance)]);
  if (salary.night_out_allowance > 0)
    earningsRows.push(["Night Out Allowance",             fmt(salary.night_out_allowance)]);
  if (salary.target_bonus_amount > 0)
    earningsRows.push(["Target Bonus",                    fmt(salary.target_bonus_amount)]);

  const totalEarnings =
    (salary.basic_salary ?? 0) + (salary.auto_commissions ?? 0) +
    (salary.manual_commissions_added ?? 0) + (salary.lunch_allowance ?? 0) +
    (salary.night_out_allowance ?? 0) + (salary.target_bonus_amount ?? 0);

  autoTable(doc, {
    head: [["Earnings Component", "Amount (LKR)"]],
    body: [
      ...earningsRows,
      [{ content: "Total Earnings", styles: { fontStyle: "bold" } },
       { content: fmt(totalEarnings), styles: { fontStyle: "bold", textColor: [22, 163, 74] } }],
    ],
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42], lineColor: [226, 232, 240], lineWidth: 0.15 },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 45, halign: "right" },
    },
    bodyStyles: { valign: "middle" },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  /* ── 5. Deductions table ── */
  const totalDeductions = (salary.manual_commissions_deducted ?? 0) + (salary.other_deductions ?? 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("DEDUCTIONS", margin, y + 4);
  y += 7;

  const deductionRows: [string, string][] = [];
  if (salary.manual_commissions_deducted > 0)
    deductionRows.push(["Manual Commission (Deducted)", fmt(salary.manual_commissions_deducted)]);
  if (salary.other_deductions > 0)
    deductionRows.push(["Other Deductions", fmt(salary.other_deductions)]);

  if (deductionRows.length === 0)
    deductionRows.push(["No deductions applied", "—"]);

  autoTable(doc, {
    head: [["Deductions Component", "Amount (LKR)"]],
    body: [
      ...deductionRows,
      [{ content: "Total Deductions", styles: { fontStyle: "bold" } },
       { content: totalDeductions > 0 ? `− ${fmt(totalDeductions)}` : fmt(0), styles: { fontStyle: "bold", textColor: [220, 38, 38] } }],
    ],
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42], lineColor: [226, 232, 240], lineWidth: 0.15 },
    headStyles: { fillColor: [255, 241, 242], textColor: [127, 29, 29], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 45, halign: "right" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  /* ── 6. Net pay highlight ── */
  doc.setFillColor(15, 23, 42);   // slate-900
  doc.roundedRect(margin, y, W - margin * 2, 18, 3, 3, "F");

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("NET PAY", margin + 5, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${fmt(totalEarnings)}  −  ${fmt(totalDeductions)}`, margin + 5, y + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(250, 204, 21);  // amber-400
  doc.text(fmt(salary.net_salary), colR - 4, y + 12, { align: "right" });

  y += 24;

  /* ── 7. Signature row ── */
  const sigW = (W - margin * 2) / 3 - 4;

  const drawSig = (x: number, label: string) => {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(x, y + 12, x + sigW, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, x + sigW / 2, y + 16, { align: "center" });
  };

  drawSig(margin,                          "Prepared By");
  drawSig(margin + sigW + 4,               "Authorized Signature");
  drawSig(margin + (sigW + 4) * 2,         "Employee Acknowledgement");

  y += 22;

  /* ── 8. Footer ── */
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  const generated = `Generated on ${new Date().toLocaleDateString("en-LK", { day: "numeric", month: "long", year: "numeric" })} · Champika Hardware Distribution System`;
  doc.text(generated, W / 2, y + 4, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("This document is system-generated and is valid without a physical signature unless stated otherwise.", W / 2, y + 9, { align: "center" });

  return doc;
}

/* ─── Download ─────────────────────────────────────────────────────────── */
export async function downloadPayslip(salary: PayslipData) {
  try {
    const doc      = buildPayslipPDF(salary);
    const name     = (salary.profiles?.full_name ?? "Employee").replace(/\s+/g, "_");
    const month    = (salary.salary_month ?? "").replace("-", "_");
    doc.save(`Payslip_${name}_${month}.pdf`);
    toast.success("Payslip downloaded.");
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate payslip.");
  }
}

/* ─── Share (Web Share API → fallback download) ────────────────────────── */
export async function sharePayslip(salary: PayslipData) {
  try {
    const doc   = buildPayslipPDF(salary);
    const blob  = doc.output("blob");
    const name  = (salary.profiles?.full_name ?? "Employee").replace(/\s+/g, "_");
    const month = (salary.salary_month ?? "").replace("-", "_");
    const file  = new File([blob], `Payslip_${name}_${month}.pdf`, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `Pay Slip — ${salary.profiles?.full_name} (${salary.salary_month})`,
        text:  `Salary statement for ${salary.salary_month}.`,
        files: [file],
      });
      toast.success("Payslip shared.");
    } else {
      // Fallback: open in new tab for manual save / print
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.info("Opened payslip in new tab — save or print from there.");
    }
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      console.error(err);
      toast.error("Failed to share payslip.");
    }
  }
}
