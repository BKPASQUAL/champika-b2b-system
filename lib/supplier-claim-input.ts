// Shared input rules for supplier monthly claim bills (create + edit).

import { z } from "zod";

export const claimItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  costBefore: z.number().optional().nullable(),
});

export const claimSchema = z.object({
  businessId: z.string().min(1, "Business is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  claimNo: z.string().min(1, "Claim bill number is required"),
  claimDate: z.string().min(1),
  periodFrom: z.string().min(1, "Period is required"),
  periodTo: z.string().min(1, "Period is required"),
  discountPercent: z.number().min(0).max(100),
  // Exact discount amount printed on the claim bill (overrides % × gross if given)
  discountAmount: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(claimItemSchema).min(1, "Add at least one item"),
});

export type ClaimInput = z.infer<typeof claimSchema>;

// Header values + item rows, with the document discount spread over the lines by value.
export function buildClaimRows(val: ClaimInput, claimBillId?: string) {
  const lines = val.items.map((i) => ({ ...i, gross: i.quantity * i.unitPrice }));
  const grossTotal = lines.reduce((s, l) => s + l.gross, 0);
  const discountAmount =
    val.discountAmount != null && val.discountAmount > 0
      ? val.discountAmount
      : (grossTotal * val.discountPercent) / 100;

  const header = {
    claim_no: val.claimNo,
    business_id: val.businessId,
    supplier_id: val.supplierId,
    claim_date: val.claimDate,
    period_from: val.periodFrom,
    period_to: val.periodTo,
    gross_total: grossTotal,
    discount_percent: val.discountPercent,
    discount_amount: discountAmount,
    notes: val.notes || null,
  };

  const itemRows = (billId: string) =>
    lines.map((l) => {
      const share = grossTotal > 0 ? (l.gross / grossTotal) * discountAmount : 0;
      return {
        claim_bill_id: billId,
        product_id: l.productId,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        gross_value: l.gross,
        discount_amount: share,
        discount_per_unit: l.quantity > 0 ? share / l.quantity : 0,
        cost_before: l.costBefore ?? null,
      };
    });

  return { header, itemRows, grossTotal, discountAmount, claimBillId };
}
