import { printInvoice as _print, printBulkInvoices as _bulk, downloadInvoice as _download, generateInvoiceHTML as _gen } from "@/app/lib/invoice-print";

export const printInvoice     = (id: string | any) => _print(id, "retail");
export const printBulkInvoices = (ids: string[])   => _bulk(ids, "retail");
export const downloadInvoice   = (id: string | any) => _download(id, "retail");
export const generateInvoiceHTML = (inv: any)       => _gen(inv, "retail");
