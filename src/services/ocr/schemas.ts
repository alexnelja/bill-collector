import { z } from "zod";
import { ExtractedData, DocumentType } from "../../types";

const lineItemSchema = z.object({
  description: z.string().default(""),
  quantity: z.coerce.number().default(1),
  unitPrice: z.coerce.number().default(0),
  amount: z.coerce.number().default(0),
  taxAmount: z.coerce.number().optional(),
  accountCode: z.string().optional(),
});

const ocrOutputSchema = z.object({
  documentType: z.string().transform((val): DocumentType => {
    if (val === "invoice" || val === "receipt") return val;
    return "unknown";
  }),
  vendorName: z.string().min(1).catch("Unknown Vendor"),
  documentNumber: z.string().optional().nullable().transform((v) => v ?? undefined),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .catch(new Date().toISOString().split("T")[0]),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  currency: z.string().length(3).catch("USD"),
  subtotal: z.coerce.number().default(0),
  taxAmount: z.coerce.number().default(0),
  totalAmount: z.coerce.number().default(0),
  taxRate: z.coerce.number().optional(),
  lineItems: z.array(lineItemSchema).default([]),
  paymentMethod: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  notes: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
});

export function parseOcrOutput(raw: unknown): ExtractedData {
  return ocrOutputSchema.parse(raw);
}
