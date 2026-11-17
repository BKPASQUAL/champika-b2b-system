import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COMPANY_NAME = "Champika Hardware";

type RGB = [number, number, number];
const C = {
  brand: [30, 41, 59] as RGB,
  white: [255, 255, 255] as RGB,
  body: [40, 40, 40] as RGB,
  muted: [110, 110, 110] as RGB,
  border: [220, 220, 220] as RGB,
  totalBg: [241, 245, 249] as RGB,
  blue: [29, 78, 216] as RGB,
  green: [21, 128, 61] as RGB,
  red: [185, 28, 28] as RGB,
  orange: [194, 65, 12] as RGB,
  purple: [109, 40, 217] as RGB,
  slate: [30, 41, 59] as RGB,
  emerald: [4, 120, 87] as RGB,
};

const n = (v: any) => Number(v) || 0;
const money = (v: number) =>
  (Math.round(n(v)) || 0).toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = (v: number) => `${n(v).toFixed(1)}%`;
const shortName = (name: string) =>
  name.replace("Champika Hardware - ", "CH ").replace(" Agency", "");
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

type ReportInput = {
  current: any;
  businesses: any[];
  periodLabel: string;
  isOverall: boolean;
};

export function generateBusinessReportPdf(opts: ReportInput) {
  const doc = buildBusinessReportPdf(opts);
  const safe = `${opts.current.name}-${opts.periodLabel}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  doc.save(`Business-Report-${safe}.pdf`);
}

/** Builds the report at the largest text size that still fits on one A4 page. */
export function buildBusinessReportPdf(opts: ReportInput): jsPDF {
  const sizes: [number, number][] = [[7.8, 1.3], [7.2, 1.0], [6.6, 0.8], [6, 0.6], [5.4, 0.5]];
  let doc: jsPDF | null = null;
  for (const [fontSize, pad] of sizes) {
    doc = render(opts, fontSize, pad);
    if (doc.getNumberOfPages() === 1) return doc;
  }
  return doc!;
}

function render({ current, businesses, periodLabel, isOverall }: ReportInput, fontSize: number, cellPadding: number): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const sectionGap = fontSize > 7 ? 5 : 3.5;

  // ── Header ────────────────────────────────────────────────
  doc.setFillColor(...C.brand);
  doc.rect(0, 0, W, 20, "F");
  doc.setTextColor(...C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${COMPANY_NAME} - Business Report`, M, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${current.name}  |  ${periodLabel}`, M, 15);
  doc.setFontSize(7.5);
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, W - M, 15, { align: "right" });

  // ── KPI boxes: Total Sales · Total Purchases · Realized Net Profit ──
  const gross = current.totalGrossProfit !== undefined ? current.totalGrossProfit : current.totalProfit;
  const kpis: { label: string; value: number; subs: { text: string; color?: RGB }[]; color: RGB }[] = [
    {
      label: "Total Sales",
      value: current.totalRevenue,
      color: C.blue,
      subs: [
        { text: `${money(current.totalUnits)} units sold` },
        ...(n(current.totalReturns) > 0
          ? [{ text: `Returns -LKR ${money(current.totalReturns)} (${n(current.returnCount)})`, color: C.red }]
          : []),
      ],
    },
    {
      label: "Total Purchases",
      value: current.totalPurchases,
      color: C.purple,
      subs: [{ text: `${n(current.purchaseCount)} purchase bills` }],
    },
    {
      label: "Realized Net Profit",
      value: current.netProfit,
      color: C.slate,
      subs: [{ text: `${pct(current.netMargin)} net margin` }],
    },
  ];
  const cols = kpis.length;
  const gap = 4;
  const boxW = (W - M * 2 - gap * (cols - 1)) / cols;
  const boxH = 25;
  let y = 25;
  kpis.forEach((k, i) => {
    const x = M + i * (boxW + gap);
    doc.setDrawColor(...C.border);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "FD");
    doc.setFillColor(...k.color);
    doc.rect(x, y, 1.4, boxH, "F");
    doc.setTextColor(...k.color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(k.label, x + 4.5, y + 5.5);
    doc.setFontSize(15);
    doc.setTextColor(...(k.value < 0 ? C.red : k.color));
    doc.text(`LKR ${money(k.value)}`, x + 4.5, y + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    k.subs.forEach((s, j) => {
      doc.setTextColor(...(s.color || C.muted));
      doc.text(s.text, x + 4.5, y + 17.3 + j * 3);
    });
  });
  y += boxH + 1;

  const tableStyles = {
    theme: "grid" as const,
    margin: { left: M, right: M, bottom: 10 },
    styles: { fontSize, cellPadding, textColor: C.body, lineColor: C.border, lineWidth: 0.1 },
    headStyles: { fillColor: C.brand, textColor: C.white, fontStyle: "bold" as const, halign: "right" as const },
    footStyles: { fillColor: C.totalBg, textColor: C.body, fontStyle: "bold" as const, halign: "right" as const },
  };
  /** Columns before `textCols` are left-aligned text; negative numbers turn red. */
  const cellStyler = (textCols: number) => (data: any) => {
    if (data.column.index < textCols) data.cell.styles.halign = "left";
    if (data.section === "body" && typeof data.cell.raw === "string" && /^-\d/.test(data.cell.raw)) {
      data.cell.styles.textColor = C.red;
    }
  };
  const rightCols = (from: number, to: number) =>
    Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, { halign: "right" as const }]));
  const title = (text: string) => {
    y += sectionGap;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.body);
    doc.text(text, M, y);
    y += 1.5;
  };
  const after = () => {
    y = (doc as any).lastAutoTable.finalY;
  };

  // ── Business breakdown (Overall) ──────────────────────────
  const bizRows = isOverall ? businesses.filter((b) => n(b.totalRevenue) !== 0 || n(b.totalPurchases) !== 0) : [];
  if (bizRows.length > 0) {
    title("By Business");
    autoTable(doc, {
      ...tableStyles,
      startY: y,
      head: [["Business", "Purchases", "Sales", "Gross Profit", "Loss", "Pending Claims", "Net Profit", "Net %", "Due"]],
      body: bizRows.map((b) => [
        shortName(b.name),
        money(b.totalPurchases),
        money(b.totalRevenue),
        money(b.totalGrossProfit ?? b.totalProfit),
        money(b.totalLoss),
        money(b.pendingClaimCost),
        money(b.netProfit),
        pct(b.netMargin),
        money(b.dueAmount),
      ]),
      foot: [[
        "Total",
        money(current.totalPurchases),
        money(current.totalRevenue),
        money(gross),
        money(current.totalLoss),
        money(current.pendingClaimCost),
        money(current.netProfit),
        pct(current.netMargin),
        money(current.dueAmount),
      ]],
      columnStyles: rightCols(1, 8),
      didParseCell: cellStyler(1),
    });
    after();
  }

  // ── Monthly breakdown ─────────────────────────────────────
  const months: any[] = current.months || [];
  title("Monthly Purchases, Sales & Profit");
  const mt = months.reduce(
    (s, m) => ({
      purchase: s.purchase + n(m.purchaseAmount),
      sales: s.sales + n(m.salesAmount),
      profit: s.profit + n(m.profit),
      pending: s.pending + n(m.pendingClaimCost),
      net: s.net + n(m.netProfit ?? n(m.profit) - n(m.pendingClaimCost)),
      noCost: s.noCost + n(m.noCostSales),
      collected: s.collected + n(m.collectedAmount),
      due: s.due + n(m.dueAmount),
    }),
    { purchase: 0, sales: 0, profit: 0, pending: 0, net: 0, noCost: 0, collected: 0, due: 0 }
  );
  autoTable(doc, {
    ...tableStyles,
    startY: y,
    head: [["Month", "Purchases", "Sales", "Profit", "Pending Claims", "Realized Net Profit", "Net %", "Collected", "Due"]],
    body:
      months.length > 0
        ? months.map((m) => {
            const net = m.netProfit ?? n(m.profit) - n(m.pendingClaimCost);
            const costed = n(m.salesAmount) - n(m.noCostSales);
            return [
              m.monthLabel || m.month,
              money(m.purchaseAmount),
              money(m.salesAmount),
              money(m.profit),
              money(m.pendingClaimCost),
              money(net),
              pct(m.netMargin ?? (costed > 0 ? (net / costed) * 100 : 0)),
              money(m.collectedAmount),
              money(m.dueAmount),
            ];
          })
        : [[{ content: "No activity in this period", colSpan: 9, styles: { halign: "center" } }]],
    foot: [[
      "Total",
      money(mt.purchase),
      money(mt.sales),
      money(mt.profit),
      money(mt.pending),
      money(mt.net),
      pct(mt.sales - mt.noCost > 0 ? (mt.net / (mt.sales - mt.noCost)) * 100 : 0),
      money(mt.collected),
      money(mt.due),
    ]],
    columnStyles: { ...rightCols(1, 8), 5: { halign: "right", fontStyle: "bold" } },
    didParseCell: cellStyler(1),
  });
  after();

  // ── Top 5 best-selling products with average profit ──────
  // Which business sold the most of each product (Overall view)
  const productBiz: Record<string, { name: string; revenue: number }> = {};
  if (isOverall) {
    businesses.forEach((b) =>
      (b.products || []).forEach((p: any) => {
        if (!productBiz[p.id] || n(p.revenue) > productBiz[p.id].revenue) {
          productBiz[p.id] = { name: shortName(b.name), revenue: n(p.revenue) };
        }
      })
    );
  }
  const topProducts = [...(current.products || [])]
    .filter((p: any) => n(p.revenue) > 0)
    .sort((a: any, b: any) => n(b.revenue) - n(a.revenue))
    .slice(0, 5);
  const productRow = (p: any) => {
    const costedUnits = n(p.unitsSold) - n(p.noCostUnits);
    const costedRevenue = n(p.revenue) - n(p.noCostRevenue);
    return {
      units: n(p.unitsSold),
      revenue: n(p.revenue),
      profit: n(p.profit),
      margin: costedRevenue > 0 ? (n(p.profit) / costedRevenue) * 100 : 0,
      perUnit: costedUnits > 0 ? n(p.profit) / costedUnits : 0,
      costedUnits,
      costedRevenue,
    };
  };
  title("Top 5 Best-Selling Products");
  const pt = topProducts.reduce(
    (s, p) => {
      const r = productRow(p);
      return {
        units: s.units + r.units,
        revenue: s.revenue + r.revenue,
        profit: s.profit + r.profit,
        costedUnits: s.costedUnits + r.costedUnits,
        costedRevenue: s.costedRevenue + r.costedRevenue,
      };
    },
    { units: 0, revenue: 0, profit: 0, costedUnits: 0, costedRevenue: 0 }
  );
  const prodHead = isOverall
    ? ["#", "Product", "Business", "Units", "Sales", "Profit", "Avg Margin", "Avg Profit / Unit", "Share of Sales"]
    : ["#", "Product", "Units", "Sales", "Profit", "Avg Margin", "Avg Profit / Unit", "Share of Sales"];
  const textCols = isOverall ? 3 : 2;
  autoTable(doc, {
    ...tableStyles,
    startY: y,
    head: [prodHead],
    body:
      topProducts.length > 0
        ? topProducts.map((p: any, i: number) => {
            const r = productRow(p);
            const cells = [
              String(i + 1),
              clip(p.name || p.sku || "-", 42),
              ...(isOverall ? [productBiz[p.id]?.name || "-"] : []),
              money(r.units),
              money(r.revenue),
              money(r.profit),
              pct(r.margin),
              money(r.perUnit),
              pct(n(current.totalRevenue) > 0 ? (r.revenue / n(current.totalRevenue)) * 100 : 0),
            ];
            return cells;
          })
        : [[{ content: "No products sold in this period", colSpan: prodHead.length, styles: { halign: "center" } }]],
    foot: [[
      { content: "Top 5 Total", colSpan: textCols },
      money(pt.units),
      money(pt.revenue),
      money(pt.profit),
      pct(pt.costedRevenue > 0 ? (pt.profit / pt.costedRevenue) * 100 : 0),
      money(pt.costedUnits > 0 ? pt.profit / pt.costedUnits : 0),
      pct(n(current.totalRevenue) > 0 ? (pt.revenue / n(current.totalRevenue)) * 100 : 0),
    ]],
    columnStyles: { 0: { cellWidth: 6 }, ...rightCols(textCols, prodHead.length - 1) },
    didParseCell: (data: any) => {
      cellStyler(textCols)(data);
      if (data.section === "foot" && data.column.index === 0) data.cell.styles.halign = "left";
    },
  });
  after();

  // ── Top 5 suppliers by purchases ──────────────────────────
  const suppliers: any[] = current.suppliers || [];
  const topSuppliers = suppliers.slice(0, 5);
  const totalPurch = n(current.totalPurchases);
  const sumOf = (list: any[]) =>
    list.reduce(
      (s, x) => ({ count: s.count + n(x.count), amount: s.amount + n(x.amount), paid: s.paid + n(x.paid) }),
      { count: 0, amount: 0, paid: 0 }
    );
  const top = sumOf(topSuppliers);
  const all = sumOf(suppliers);
  const share = (v: number) => pct(totalPurch > 0 ? (v / totalPurch) * 100 : 0);
  title("Top 5 Suppliers by Purchases");
  autoTable(doc, {
    ...tableStyles,
    startY: y,
    head: [["#", "Supplier", "Bills", "Purchase Amount", "Paid", "Balance", "Share"]],
    body:
      topSuppliers.length > 0
        ? topSuppliers.map((s, i) => [
            String(i + 1),
            clip(s.name, 50),
            String(n(s.count)),
            money(s.amount),
            money(s.paid),
            money(n(s.amount) - n(s.paid)),
            share(s.amount),
          ])
        : [[{ content: "No purchase bills in this period", colSpan: 7, styles: { halign: "center" } }]],
    foot: [
      [{ content: "Top 5 Total", colSpan: 2 }, String(top.count), money(top.amount), money(top.paid), money(top.amount - top.paid), share(top.amount)],
      ...(suppliers.length > topSuppliers.length
        ? [[{ content: `All Suppliers (${suppliers.length})`, colSpan: 2 }, String(all.count), money(all.amount), money(all.paid), money(all.amount - all.paid), share(all.amount)]]
        : []),
    ],
    columnStyles: { 0: { cellWidth: 6 }, ...rightCols(2, 6) },
    didParseCell: (data: any) => {
      cellStyler(2)(data);
      if (data.section === "foot" && data.column.index === 0) data.cell.styles.halign = "left";
    },
  });

  // ── Footer ────────────────────────────────────────────────
  doc.setPage(1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text(
    "Purchases = purchase bills (net of extra discount, cancelled excluded) by bill date. Profit = sales minus FIFO cost, after losses. Realized Net Profit = Profit - Pending Claims. Avg Profit/Unit counts only units with a cost.",
    M,
    H - 6,
    { maxWidth: W - M * 2 }
  );

  return doc;
}
