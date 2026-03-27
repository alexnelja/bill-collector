import { HistoryStore } from "../src/services/history";
import { ProcessingResult } from "../src/types";

describe("HistoryStore", () => {
  let store: HistoryStore;

  beforeEach(() => {
    store = new HistoryStore();
  });

  const mockResult: ProcessingResult = {
    id: "test-001",
    status: "saved",
    document: {
      id: "test-001",
      channel: "api",
      senderId: "user@test.com",
      file: { name: "receipt.jpg", mimeType: "image/jpeg", base64: "" },
      receivedAt: new Date(),
    },
    extractedData: {
      documentType: "receipt",
      vendorName: "Test Store",
      date: "2026-03-27",
      currency: "USD",
      subtotal: 100,
      taxAmount: 15,
      totalAmount: 115,
      lineItems: [],
      confidence: 0.95,
    },
    processedAt: new Date(),
  };

  it("stores and retrieves a result by ID", () => {
    store.save(mockResult);
    expect(store.getById("test-001")).toEqual(mockResult);
  });

  it("returns undefined for unknown ID", () => {
    expect(store.getById("nope")).toBeUndefined();
  });

  it("lists recent results", () => {
    store.save(mockResult);
    store.save({ ...mockResult, id: "test-002" });
    const recent = store.listRecent(10);
    expect(recent).toHaveLength(2);
  });

  it("filters by channel", () => {
    store.save(mockResult);
    store.save({
      ...mockResult,
      id: "test-002",
      document: {
        ...mockResult.document,
        id: "test-002",
        channel: "whatsapp",
      },
    });
    const apiOnly = store.listByChannel("api", 10);
    expect(apiOnly).toHaveLength(1);
    expect(apiOnly[0].id).toBe("test-001");
  });
});
