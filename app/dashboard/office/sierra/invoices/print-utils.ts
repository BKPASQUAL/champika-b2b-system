import { printInvoice as _print, downloadInvoice as _download } from "@/app/lib/invoice-print";

export const printInvoice   = (id: string | any) => _print(id, "sierra");
export const downloadInvoice = (id: string | any) => _download(id, "sierra");
