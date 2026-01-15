// app/dashboard/office/wireman/invoices/print-utils.ts
export const printInvoice = async (invoiceId: string) => {
    // ✅ Updated path for Wireman
    const url = `/dashboard/office/wireman/invoices/${invoiceId}`;
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
        printWindow.focus();
    } else {
        alert("Please allow popups to print invoices");
    }
};