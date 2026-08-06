import {
  printQuotation as _print,
  printHalfPageQuotation as _printHalf,
  downloadQuotation as _download
} from "@/app/lib/quotation-print";

export const printQuotation = (id: string | any, showBranding: boolean = true) => _print(id, "retail", showBranding);
export const printHalfPageQuotation = (id: string | any, showBranding: boolean = true) => _printHalf(id, "retail", showBranding);
export const downloadQuotation = (id: string | any, showBranding: boolean = true) => _download(id, "retail", showBranding);
