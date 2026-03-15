// app/dashboard/office/sierra/invoices/print-utils.ts
export const printInvoice = async (invoiceId: string) => {
    // ✅ Updated path for Sierra
    const url = `/dashboard/office/sierra/invoices/${invoiceId}`;
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
        printWindow.focus();
    } else {
        alert("Please allow popups to print invoices");
    }
};
