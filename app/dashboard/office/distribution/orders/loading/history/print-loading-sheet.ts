// app/dashboard/office/distribution/orders/loading/history/print-loading-sheet.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Fetch Load Details
const fetchLoadDetails = async (loadId: string) => {
  const res = await fetch(`/api/orders/loading/history/${loadId}`);
  if (!res.ok) throw new Error("Failed to fetch load details");
  return await res.json();
};

export const printLoadingSheet = async (loadId: string) => {
  try {
    const data = await fetchLoadDetails(loadId);
    const doc = generatePDF(data);
    doc.autoPrint();
    doc.output("dataurlnewwindow");
  } catch (error) {
    console.error("Print Error:", error);
    alert("Failed to print loading sheet.");
  }
};

export const downloadLoadingSheet = async (loadId: string) => {
  try {
    const data = await fetchLoadDetails(loadId);
    const doc = generatePDF(data);
    doc.save(`Loading_Sheet_${data.loadId}.pdf`);
  } catch (error) {
    console.error("Download Error:", error);
    alert("Failed to download loading sheet.");
  }
};

const generatePDF = (data: any) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text("LOADING SHEET", 105, 15, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Load ID: ${data.loadId}`, 14, 25);
  doc.text(`Date: ${new Date(data.loadingDate).toLocaleDateString()}`, 14, 30);
  doc.text(`Lorry: ${data.lorryNumber}`, 140, 25);
  doc.text(`Driver: ${data.driverName}`, 140, 30);

  // Table
  const tableColumn = ["#", "Order ID", "Shop Name", "Route", "Amount (LKR)"];
  const tableRows: any[] = [];

  data.orders.forEach((order: any, index: number) => {
    const rowData = [
      index + 1,
      order.orderId,
      order.shopName,
      order.route,
      order.totalAmount.toLocaleString(),
    ];
    tableRows.push(rowData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 35,
    theme: "grid",
    headStyles: { fillColor: [22, 163, 74] }, // Green color
    foot: [["", "", "", "Total", data.totalAmount.toLocaleString()]],
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
  });

  return doc;
};
