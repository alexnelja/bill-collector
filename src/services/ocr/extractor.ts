import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config";
import { ExtractedData, DocumentType, LineItem } from "../../types";
import { logger } from "../../utils/logger";

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const EXTRACTION_PROMPT = `You are an expert accounting document processor. Analyze this image of a financial document (invoice, bill, receipt, or expense slip) and extract all relevant data.

Classify the document:
- "invoice": A bill/invoice received from a supplier that needs to be PAID (has "Invoice", "Tax Invoice", "Bill To", payment terms, due date, bank details)
- "receipt": Proof of a payment already MADE (has "Receipt", "Paid", "Thank you", transaction reference, payment method used)

Extract the following into JSON:

{
  "documentType": "invoice" | "receipt",
  "vendorName": "Name of the vendor/supplier/merchant",
  "documentNumber": "Invoice or receipt number",
  "date": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD or null",
  "currency": "3-letter ISO currency code (e.g. USD, ZAR, GBP, EUR)",
  "subtotal": 0.00,
  "taxAmount": 0.00,
  "totalAmount": 0.00,
  "taxRate": 15,
  "lineItems": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": 0.00,
      "amount": 0.00,
      "taxAmount": 0.00
    }
  ],
  "paymentMethod": "cash/card/EFT/etc or null",
  "notes": "Any relevant notes, PO numbers, or references",
  "confidence": 0.95
}

Rules:
- If you cannot determine a field, use null or omit it
- Amounts must be numbers, not strings
- If only a total is visible with no line items, create a single line item with the total
- Detect the currency from symbols ($, R, £, €) or text on the document
- The confidence score should reflect how clearly you could read the document (0.0 to 1.0)
- Return ONLY valid JSON, no markdown formatting or code blocks`;

export async function extractDocumentData(
  base64Content: string,
  mimeType: string,
  messageText?: string
): Promise<ExtractedData> {
  logger.info("Starting OCR extraction with Claude Vision");

  const mediaType = mimeType as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp"
    | "application/pdf";

  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

  if (mediaType === "application/pdf") {
    contentBlocks.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64Content,
      },
    });
  } else {
    contentBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Content,
      },
    });
  }

  if (messageText) {
    contentBlocks.push({
      type: "text",
      text: `The sender included this message: "${messageText}". Use it as additional context.`,
    });
  }

  contentBlocks.push({
    type: "text",
    text: EXTRACTION_PROMPT,
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: contentBlocks,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude Vision");
  }

  let jsonText = textBlock.text.trim();
  // Strip markdown code fences if present
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonText);

  const extracted: ExtractedData = {
    documentType: validateDocumentType(parsed.documentType),
    vendorName: parsed.vendorName || "Unknown Vendor",
    documentNumber: parsed.documentNumber || undefined,
    date: parsed.date || new Date().toISOString().split("T")[0],
    dueDate: parsed.dueDate || undefined,
    currency: parsed.currency || "USD",
    subtotal: Number(parsed.subtotal) || 0,
    taxAmount: Number(parsed.taxAmount) || 0,
    totalAmount: Number(parsed.totalAmount) || 0,
    taxRate: parsed.taxRate != null ? Number(parsed.taxRate) : undefined,
    lineItems: parseLineItems(parsed.lineItems),
    paymentMethod: parsed.paymentMethod || undefined,
    notes: parsed.notes || undefined,
    confidence: Number(parsed.confidence) || 0.5,
  };

  // If total is 0 but we have line items, sum them up
  if (extracted.totalAmount === 0 && extracted.lineItems.length > 0) {
    extracted.totalAmount = extracted.lineItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );
  }

  logger.info(
    `Extracted: ${extracted.documentType} from "${extracted.vendorName}" for ${extracted.currency} ${extracted.totalAmount} (confidence: ${extracted.confidence})`
  );

  return extracted;
}

function validateDocumentType(type: string): DocumentType {
  if (type === "invoice" || type === "receipt") return type;
  return "unknown";
}

function parseLineItems(items: unknown): LineItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item: Record<string, unknown>) => ({
    description: String(item.description || ""),
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice) || 0,
    amount: Number(item.amount) || 0,
    taxAmount: item.taxAmount != null ? Number(item.taxAmount) : undefined,
  }));
}
