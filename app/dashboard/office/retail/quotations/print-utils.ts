import {
  printQuotation as _print,
  printHalfPageQuotation as _printHalf,
  downloadQuotation as _download
} from "@/app/lib/quotation-print";

export const printQuotation = (id: string | any) => _print(id, "retail");
export const printHalfPageQuotation = (id: string | any) => _printHalf(id, "retail");
export const downloadQuotation = (id: string | any) => _download(id, "retail");
