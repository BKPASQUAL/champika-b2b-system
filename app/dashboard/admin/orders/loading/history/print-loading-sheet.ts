import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

// Shared function to generate the PDF content
const generatePDFContent = async (loadId: string) => {
  // 1. Fetch Data
  const res = await fetch(`/api/orders/loading/history/${loadId}`);
  if (!res.ok) throw new Error("Failed to load loading sheet details");
  const data = await res.json();

  // 2. Initialize PDF
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;

  // --- Header ---
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("DELIVERY DISPATCH NOTE", pageWidth / 2, 15, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // Top Info Grid
  let startY = 25;
  doc.setFont("helvetica", "bold");
  doc.text(`Load Ref: ${data.loadId}`, margin, startY);
  doc.text(
    `Date: ${new Date(data.loadingDate).toLocaleDateString()}`,
    pageWidth - margin,
    startY,
    { align: "right" }
  );

  startY += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Lorry No: ${data.lorryNumber}`, margin, startY);
  doc.text(`Driver: ${data.driverName}`, pageWidth - margin, startY, {
    align: "right",
  });

  // --- Table ---
  const tableColumn = [
    "#",
    "Order #",
    "Shop Details",
    "Address",
    "Amount",
    "Stamp & Signature",
  ];
  const tableRows = data.orders.map((order: any, index: number) => [
    index + 1,
    order.orderId,
    `${order.customer.shopName}\n${order.customer.phone || ""}`,
    order.customer.address || "-",
    order.totalAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 }),
    "",
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: startY + 6,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      lineColor: [150, 150, 150],
      lineWidth: 0.1,
      valign: "middle",
      textColor: 0,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0.1,
      lineColor: [100, 100, 100],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 22, fontStyle: "bold" },
      2: { cellWidth: 45 },
      3: { cellWidth: 45 },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: "auto", minCellHeight: 15 },
    },
  });

  // --- Footer / Signatures ---
  let currentY = (doc as any).lastAutoTable.finalY + 10;
  const requiredSpace = 40;

  if (currentY + requiredSpace > pageHeight - margin) {
    doc.addPage();
    currentY = 20;
  }

  // Totals
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Total Orders: ${data.totalOrders}`, margin, currentY);
  doc.text(
    `Total Value: LKR ${data.totalAmount.toLocaleString("en-LK", {
      minimumFractionDigits: 2,
    })}`,
    pageWidth - margin,
    currentY,
    { align: "right" }
  );

  // Signatures Grid (3 Columns)
  currentY += 15;
  const colWidth = (pageWidth - margin * 2) / 3;

  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  let xPos = margin;

  // 1. Dispatcher
  doc.line(xPos, currentY, xPos + colWidth - 5, currentY);
  doc.text("Authorized Dispatcher", xPos, currentY + 4);

  // 2. Driver
  xPos += colWidth;
  doc.line(xPos, currentY, xPos + colWidth - 5, currentY);
  doc.text("Responsible Person (Driver)", xPos, currentY + 4);
  doc.setFont("helvetica", "bold");
  doc.text(`(${data.driverName})`, xPos, currentY + 8);
  doc.setFont("helvetica", "normal");

  // 3. Sales Rep
  xPos += colWidth;
  doc.line(xPos, currentY, xPos + colWidth - 5, currentY);
  doc.text("Sales Representative", xPos, currentY + 4);

  return { doc, loadId: data.loadId };
};

// Function 1: Download File
export const downloadLoadingSheet = async (loadId: string) => {
  try {
    const { doc, loadId: id } = await generatePDFContent(loadId);
    doc.save(`Dispatch_Sheet_${id}.pdf`);
    toast.success("PDF Downloaded");
  } catch (error) {
    console.error(error);
    toast.error("Failed to generate PDF");
  }
};

// Function 2: Print Directly (Stay on Page)
export const printLoadingSheet = async (loadId: string) => {
  try {
    const { doc } = await generatePDFContent(loadId);

    // Use autoPrint to embed JS in PDF, then load in iframe
    doc.autoPrint();
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);

    // Create invisible iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    iframe.src = blobUrl;

    // Append to body to trigger load
    document.body.appendChild(iframe);

    // Once loaded, the autoPrint script inside PDF should trigger,
    // but we can also force focus/print for better compatibility
    iframe.onload = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    };

    // Optional: Remove iframe after a delay (e.g. 1 minute) to cleanup memory
    // We delay significantly to ensure print dialog has opened
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(blobUrl);
    }, 60000);
  } catch (error) {
    console.error(error);
    toast.error("Failed to print");
  }
};
