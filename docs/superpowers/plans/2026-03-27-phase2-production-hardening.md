# Bill Collector Phase 2 — Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Zod validation, image preprocessing, duplicate detection, processing queue, notification replies, processing history API, and a comprehensive test suite to make Bill Collector production-ready.

**Architecture:** Six independent enhancements layered onto the existing pipeline. Each task produces working, testable code. Zod validates OCR output. Sharp resizes images before sending to Claude. A content-hash deduplicator prevents double-processing. p-queue throttles concurrent jobs. A history store tracks all processed documents. Tests cover each layer.

**Tech Stack:** TypeScript, Zod, Sharp, Jest, existing Express/Claude/QB/Xero stack

---

### Task 1: Zod Validation for OCR Output

**Files:**
- Create: `src/services/ocr/schemas.ts`
- Modify: `src/services/ocr/extractor.ts`
- Create: `tests/ocr/schemas.test.ts`

- [ ] **Step 1: Install zod**

```bash
npm install zod
```

- [ ] **Step 2: Write the failing test for schema validation**

Create `tests/ocr/schemas.test.ts`:

```typescript
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
        { description: "Widget", quantity: 2, unitPrice: 50, amount: 100, taxAmount: 15 },
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
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/ocr/schemas.test.ts --no-cache`
Expected: FAIL — `Cannot find module '../../src/services/ocr/schemas'`

- [ ] **Step 4: Implement the Zod schema**

Create `src/services/ocr/schemas.ts`:

```typescript
import { z } from "zod";
import { ExtractedData, DocumentType, LineItem } from "../../types";

const lineItemSchema = z.object({
  description: z.string().default(""),
  quantity: z.coerce.number().default(1),
  unitPrice: z.coerce.number().default(0),
  amount: z.coerce.number().default(0),
  taxAmount: z.coerce.number().optional(),
  accountCode: z.string().optional(),
});

const ocrOutputSchema = z.object({
  documentType: z.enum(["invoice", "receipt"]).catch("unknown" as never).pipe(
    z.union([z.literal("invoice"), z.literal("receipt"), z.literal("unknown")])
  ).or(z.string().transform((val): DocumentType => {
    if (val === "invoice" || val === "receipt") return val;
    return "unknown";
  })),
  vendorName: z.string().min(1).catch("Unknown Vendor"),
  documentNumber: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).catch(new Date().toISOString().split("T")[0]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().transform(v => v ?? undefined),
  currency: z.string().length(3).catch("USD"),
  subtotal: z.coerce.number().default(0),
  taxAmount: z.coerce.number().default(0),
  totalAmount: z.coerce.number().default(0),
  taxRate: z.coerce.number().optional(),
  lineItems: z.array(lineItemSchema).default([]),
  paymentMethod: z.string().optional().nullable().transform(v => v ?? undefined),
  notes: z.string().optional().nullable().transform(v => v ?? undefined),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
});

export function parseOcrOutput(raw: unknown): ExtractedData {
  return ocrOutputSchema.parse(raw);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/ocr/schemas.test.ts --no-cache`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Wire schema into extractor**

In `src/services/ocr/extractor.ts`, replace the manual field parsing (lines 119-136) with:

```typescript
// Replace: const parsed = JSON.parse(jsonText); ... const extracted: ExtractedData = { ... };
// With:
import { parseOcrOutput } from "./schemas";

const parsed = JSON.parse(jsonText);
const extracted = parseOcrOutput(parsed);
```

Remove the `validateDocumentType` function (no longer needed, Zod handles it). Keep `parseLineItems` only if `parseOcrOutput` doesn't cover it (it does via the schema).

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/services/ocr/schemas.ts tests/ocr/schemas.test.ts src/services/ocr/extractor.ts
git commit -m "feat: add Zod validation for OCR output"
```

---

### Task 2: Image Preprocessing with Sharp

**Files:**
- Create: `src/services/ocr/preprocess.ts`
- Modify: `src/services/ocr/extractor.ts`
- Create: `tests/ocr/preprocess.test.ts`

- [ ] **Step 1: Install sharp**

```bash
npm install sharp
npm install --save-dev @types/sharp
```

- [ ] **Step 2: Write the failing test**

Create `tests/ocr/preprocess.test.ts`:

```typescript
import { preprocessImage } from "../../src/services/ocr/preprocess";
import sharp from "sharp";

describe("preprocessImage", () => {
  it("passes through PDFs unchanged", async () => {
    const pdfBase64 = Buffer.from("fake-pdf").toString("base64");
    const result = await preprocessImage(pdfBase64, "application/pdf");
    expect(result.base64).toBe(pdfBase64);
    expect(result.mimeType).toBe("application/pdf");
  });

  it("resizes a large image to max 1568px", async () => {
    // Create a 3000x2000 test image
    const largeImg = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).jpeg().toBuffer();

    const result = await preprocessImage(largeImg.toString("base64"), "image/jpeg");
    const metadata = await sharp(Buffer.from(result.base64, "base64")).metadata();

    expect(metadata.width).toBeLessThanOrEqual(1568);
    expect(metadata.height).toBeLessThanOrEqual(1568);
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("does not upscale small images", async () => {
    const smallImg = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).jpeg().toBuffer();

    const result = await preprocessImage(smallImg.toString("base64"), "image/jpeg");
    const metadata = await sharp(Buffer.from(result.base64, "base64")).metadata();

    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(300);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/ocr/preprocess.test.ts --no-cache`
Expected: FAIL — `Cannot find module`

- [ ] **Step 4: Implement preprocessImage**

Create `src/services/ocr/preprocess.ts`:

```typescript
import sharp from "sharp";
import { logger } from "../../utils/logger";

const MAX_DIMENSION = 1568;

interface PreprocessResult {
  base64: string;
  mimeType: string;
}

export async function preprocessImage(
  base64: string,
  mimeType: string
): Promise<PreprocessResult> {
  if (mimeType === "application/pdf") {
    return { base64, mimeType };
  }

  const buffer = Buffer.from(base64, "base64");
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    logger.debug(`Image ${width}x${height} within limits, no resize needed`);
    return { base64, mimeType };
  }

  logger.info(`Resizing image from ${width}x${height} to fit ${MAX_DIMENSION}px`);

  const resized = await sharp(buffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return {
    base64: resized.toString("base64"),
    mimeType: "image/jpeg",
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/ocr/preprocess.test.ts --no-cache`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Wire preprocessing into extractor**

In `src/services/ocr/extractor.ts`, add at the top of `extractDocumentData`:

```typescript
import { preprocessImage } from "./preprocess";

// Inside extractDocumentData, before building contentBlocks:
const preprocessed = await preprocessImage(base64Content, mimeType);
const processedBase64 = preprocessed.base64;
const processedMimeType = preprocessed.mimeType;
// Then use processedBase64 and processedMimeType instead of base64Content and mimeType
```

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/services/ocr/preprocess.ts tests/ocr/preprocess.test.ts src/services/ocr/extractor.ts
git commit -m "feat: add image preprocessing with Sharp for optimal OCR"
```

---

### Task 3: Duplicate Detection

**Files:**
- Create: `src/services/dedup.ts`
- Modify: `src/pipeline/processor.ts`
- Create: `tests/dedup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/dedup.test.ts`:

```typescript
import { DuplicateDetector } from "../src/services/dedup";

describe("DuplicateDetector", () => {
  let detector: DuplicateDetector;

  beforeEach(() => {
    detector = new DuplicateDetector();
  });

  it("returns false for first occurrence", () => {
    expect(detector.isDuplicate("abc123", "image/jpeg")).toBe(false);
  });

  it("returns true for same content submitted twice", () => {
    detector.isDuplicate("abc123", "image/jpeg");
    expect(detector.isDuplicate("abc123", "image/jpeg")).toBe(true);
  });

  it("returns false for different content", () => {
    detector.isDuplicate("abc123", "image/jpeg");
    expect(detector.isDuplicate("def456", "image/jpeg")).toBe(false);
  });

  it("stores the result ID for duplicates", () => {
    detector.recordProcessed("hash1", "result-001");
    expect(detector.getPreviousResultId("hash1")).toBe("result-001");
    expect(detector.getPreviousResultId("unknown")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/dedup.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement DuplicateDetector**

Create `src/services/dedup.ts`:

```typescript
import crypto from "crypto";

export class DuplicateDetector {
  private seen = new Map<string, { resultId?: string; timestamp: Date }>();

  computeHash(base64Content: string, mimeType: string): string {
    return crypto.createHash("sha256").update(base64Content).update(mimeType).digest("hex");
  }

  isDuplicate(base64Content: string, mimeType: string): boolean {
    const hash = this.computeHash(base64Content, mimeType);
    return this.seen.has(hash);
  }

  recordProcessed(hash: string, resultId: string): void {
    this.seen.set(hash, { resultId, timestamp: new Date() });
  }

  getPreviousResultId(hash: string): string | undefined {
    return this.seen.get(hash)?.resultId;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/dedup.test.ts --no-cache`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Wire into pipeline**

In `src/pipeline/processor.ts`, add duplicate check before OCR step:

```typescript
import { DuplicateDetector } from "../services/dedup";

const dedup = new DuplicateDetector();

// At start of processDocument, before Step 1:
const contentHash = dedup.computeHash(doc.file.base64, doc.file.mimeType);
if (dedup.isDuplicate(doc.file.base64, doc.file.mimeType)) {
  const prevId = dedup.getPreviousResultId(contentHash);
  logger.warn(`[${result.id}] Duplicate document detected (previously processed as ${prevId})`);
  result.status = "failed";
  result.error = `Duplicate document — previously processed as ${prevId}`;
  return result;
}

// After successful save (after result.status = "saved"):
dedup.recordProcessed(contentHash, result.accountingRecordId || result.id);
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/services/dedup.ts tests/dedup.test.ts src/pipeline/processor.ts
git commit -m "feat: add duplicate document detection via content hashing"
```

---

### Task 4: Processing Queue with p-queue

**Files:**
- Create: `src/services/queue.ts`
- Modify: `src/services/channels/whatsapp.ts`
- Modify: `src/services/channels/telegram.ts`
- Modify: `src/routes/webhooks.ts`
- Create: `tests/queue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/queue.test.ts`:

```typescript
import { ProcessingQueue } from "../src/services/queue";

describe("ProcessingQueue", () => {
  it("processes jobs sequentially with concurrency 1", async () => {
    const queue = new ProcessingQueue(1);
    const order: number[] = [];

    await Promise.all([
      queue.enqueue(async () => { order.push(1); }),
      queue.enqueue(async () => { order.push(2); }),
      queue.enqueue(async () => { order.push(3); }),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });

  it("reports pending count", async () => {
    const queue = new ProcessingQueue(1);
    expect(queue.pending).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/queue.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement ProcessingQueue**

Create `src/services/queue.ts`:

```typescript
import PQueue from "p-queue";
import { logger } from "../utils/logger";

export class ProcessingQueue {
  private queue: PQueue;

  constructor(concurrency = 3) {
    this.queue = new PQueue({ concurrency });
    this.queue.on("error", (error) => {
      logger.error("Queue processing error", { error });
    });
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return this.queue.add(fn) as Promise<T>;
  }

  get pending(): number {
    return this.queue.pending;
  }

  get size(): number {
    return this.queue.size;
  }
}

export const processingQueue = new ProcessingQueue(3);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/queue.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Wire queue into channel handlers**

In `src/routes/webhooks.ts`, wrap the `processDocument` call inside the API upload route:

```typescript
import { processingQueue } from "../services/queue";

// Replace: const result = await processDocument(doc);
// With:
const result = await processingQueue.enqueue(() => processDocument(doc));
```

Apply the same pattern in `src/services/channels/whatsapp.ts` and `src/services/channels/telegram.ts`.

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/services/queue.ts tests/queue.test.ts src/routes/webhooks.ts src/services/channels/whatsapp.ts src/services/channels/telegram.ts
git commit -m "feat: add processing queue with concurrency control"
```

---

### Task 5: Processing History Store

**Files:**
- Create: `src/services/history.ts`
- Modify: `src/pipeline/processor.ts`
- Create: `src/routes/history.ts`
- Modify: `src/index.ts`
- Create: `tests/history.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/history.test.ts`:

```typescript
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
      document: { ...mockResult.document, id: "test-002", channel: "whatsapp" },
    });
    const apiOnly = store.listByChannel("api", 10);
    expect(apiOnly).toHaveLength(1);
    expect(apiOnly[0].id).toBe("test-001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/history.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement HistoryStore**

Create `src/services/history.ts`:

```typescript
import { ProcessingResult, InputChannel } from "../types";

export class HistoryStore {
  private results = new Map<string, ProcessingResult>();

  save(result: ProcessingResult): void {
    this.results.set(result.id, result);
  }

  getById(id: string): ProcessingResult | undefined {
    return this.results.get(id);
  }

  listRecent(limit: number): ProcessingResult[] {
    const all = Array.from(this.results.values());
    all.sort((a, b) => {
      const aTime = a.processedAt?.getTime() || a.document.receivedAt.getTime();
      const bTime = b.processedAt?.getTime() || b.document.receivedAt.getTime();
      return bTime - aTime;
    });
    return all.slice(0, limit);
  }

  listByChannel(channel: InputChannel, limit: number): ProcessingResult[] {
    return this.listRecent(limit).filter((r) => r.document.channel === channel);
  }
}

export const historyStore = new HistoryStore();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/history.test.ts --no-cache`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Wire into pipeline**

In `src/pipeline/processor.ts`, save results to history:

```typescript
import { historyStore } from "../services/history";

// At end of processDocument, just before `return result`:
historyStore.save(result);
```

(Add this in both the success and catch paths.)

- [ ] **Step 6: Create history API routes**

Create `src/routes/history.ts`:

```typescript
import { Router, Request, Response } from "express";
import { historyStore } from "../services/history";
import { InputChannel } from "../types";

const router = Router();

router.get("/api/history", (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
  const channel = req.query.channel as InputChannel | undefined;

  const results = channel
    ? historyStore.listByChannel(channel, limit)
    : historyStore.listRecent(limit);

  res.json(
    results.map((r) => ({
      id: r.id,
      status: r.status,
      channel: r.document.channel,
      sender: r.document.senderId,
      documentType: r.extractedData?.documentType,
      vendor: r.extractedData?.vendorName,
      amount: r.extractedData?.totalAmount,
      currency: r.extractedData?.currency,
      date: r.extractedData?.date,
      matchedContact: r.matchedContact?.name || null,
      costCentre: r.costCentreSuggestion?.costCentre || null,
      accountingRecordId: r.accountingRecordId || null,
      error: r.error || null,
      processedAt: r.processedAt,
    }))
  );
});

router.get("/api/history/:id", (req: Request, res: Response) => {
  const result = historyStore.getById(req.params.id);
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    id: result.id,
    status: result.status,
    channel: result.document.channel,
    sender: result.document.senderId,
    fileName: result.document.file.name,
    extractedData: result.extractedData,
    matchedContact: result.matchedContact,
    costCentreSuggestion: result.costCentreSuggestion,
    accountingRecordId: result.accountingRecordId,
    error: result.error,
    receivedAt: result.document.receivedAt,
    processedAt: result.processedAt,
  });
});

export default router;
```

- [ ] **Step 7: Register history routes in index.ts**

In `src/index.ts`:

```typescript
import historyRoutes from "./routes/history";
// After: app.use(authRoutes);
app.use(historyRoutes);
```

- [ ] **Step 8: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/services/history.ts tests/history.test.ts src/routes/history.ts src/pipeline/processor.ts src/index.ts
git commit -m "feat: add processing history store with REST API"
```

---

### Task 6: Jest Configuration and Test Runner Setup

**Files:**
- Create: `jest.config.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Create jest.config.ts**

Create `jest.config.ts`:

```typescript
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["src/**/*.ts", "!src/types/**"],
  coverageDirectory: "coverage",
};

export default config;
```

- [ ] **Step 2: Verify all tests pass**

Run: `npx jest --verbose`
Expected: All tests from Tasks 1-5 pass

- [ ] **Step 3: Commit**

```bash
git add jest.config.ts
git commit -m "chore: add Jest configuration for TypeScript tests"
```

---

### Task 7: Final Build Verification and Push

- [ ] **Step 1: Full type check**

```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 2: Run all tests**

```bash
npx jest --verbose --coverage
```
Expected: All pass, coverage report generated

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: Clean build in `dist/`

- [ ] **Step 4: Push**

```bash
git push -u origin claude/expense-receipt-scanner-lqrkA
```
