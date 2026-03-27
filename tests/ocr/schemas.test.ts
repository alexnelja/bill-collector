import { parseOcrOutput } from "../../src/services/ocr/schemas";

describe("parseOcrOutput", () => {
  it("parses a valid invoice payload", () => {
    const raw = {
      documentType: "invoice",
      vendorName: "Acme Corp",
      documentNumber: "INV-001",
      date: "2026-03-15",
      dueDate: "2026-04-15",
      currency: "USD",
      subtotal: 100,
      taxAmount: 15,
      totalAmount: 115,
      taxRate: 15,
      lineItems: [
        {
          description: "Widget",
          quantity: 2,
          unitPrice: 50,
          amount: 100,
          taxAmount: 15,
        },
      ],
      paymentMethod: null,
      notes: "PO-1234",
      confidence: 0.95,
    };
    const result = parseOcrOutput(raw);
    expect(result.documentType).toBe("invoice");
    expect(result.totalAmount).toBe(115);
    expect(result.lineItems).toHaveLength(1);
  });

  it("coerces string amounts to numbers", () => {
    const raw = {
      documentType: "receipt",
      vendorName: "Coffee Shop",
      date: "2026-03-20",
      currency: "ZAR",
      subtotal: "43.48",
      taxAmount: "6.52",
      totalAmount: "50.00",
      lineItems: [],
      confidence: "0.88",
    };
    const result = parseOcrOutput(raw);
    expect(result.totalAmount).toBe(50);
    expect(result.confidence).toBe(0.88);
  });

  it("defaults missing optional fields", () => {
    const raw = {
      documentType: "receipt",
      vendorName: "Store",
      date: "2026-01-01",
      currency: "GBP",
      subtotal: 10,
      taxAmount: 0,
      totalAmount: 10,
      lineItems: [],
      confidence: 0.7,
    };
    const result = parseOcrOutput(raw);
    expect(result.dueDate).toBeUndefined();
    expect(result.paymentMethod).toBeUndefined();
  });

  it("rejects completely invalid input", () => {
    expect(() => parseOcrOutput({ garbage: true })).toThrow();
  });

  it("handles unknown document type gracefully", () => {
    const raw = {
      documentType: "statement",
      vendorName: "Bank",
      date: "2026-01-01",
      currency: "USD",
      subtotal: 0,
      taxAmount: 0,
      totalAmount: 0,
      lineItems: [],
      confidence: 0.5,
    };
    const result = parseOcrOutput(raw);
    expect(result.documentType).toBe("unknown");
  });
});
