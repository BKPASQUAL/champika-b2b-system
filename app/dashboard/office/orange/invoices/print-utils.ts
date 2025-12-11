export const printInvoice = async (invoiceId: string) => {
    const url = `/dashboard/office/orange/invoices/${invoiceId}`;
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
        printWindow.focus();
    } else {
        alert("Please allow popups to print invoices");
    }
};