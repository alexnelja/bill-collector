import { Router, Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { handleWhatsAppWebhook } from "../services/channels/whatsapp";
import { processDocument } from "../pipeline/processor";
import { processingQueue } from "../services/queue";
import { IncomingDocument } from "../types";
import { logger } from "../utils/logger";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── WhatsApp (Twilio) Webhook ───────────────────────────────────────────────
router.post("/webhook/whatsapp", handleWhatsAppWebhook);

// ── Direct API Upload ───────────────────────────────────────────────────────
// POST /api/upload - Upload a file directly via the REST API
router.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided. Send a file in the 'file' field." });
      return;
    }

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];

    if (!validTypes.includes(file.mimetype)) {
      res.status(400).json({
        error: `Unsupported file type: ${file.mimetype}. Accepted: ${validTypes.join(", ")}`,
      });
      return;
    }

    const doc: IncomingDocument = {
      id: uuidv4(),
      channel: "api",
      senderId: req.body.sender || "api-user",
      messageText: req.body.message || undefined,
      file: {
        name: file.originalname,
        mimeType: file.mimetype,
        base64: file.buffer.toString("base64"),
      },
      receivedAt: new Date(),
    };

    logger.info(`API upload: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);

    const result = await processingQueue.enqueue(() => processDocument(doc));

    res.status(result.status === "saved" ? 200 : 422).json({
      id: result.id,
      status: result.status,
      documentType: result.extractedData?.documentType,
      vendor: result.extractedData?.vendorName,
      amount: result.extractedData?.totalAmount,
      currency: result.extractedData?.currency,
      date: result.extractedData?.date,
      matchedContact: result.matchedContact?.name || null,
      costCentre: result.costCentreSuggestion?.costCentre || null,
      accountingRecordId: result.accountingRecordId || null,
      error: result.error || null,
    });
  } catch (error) {
    logger.error("API upload error", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Health Check ────────────────────────────────────────────────────────────
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "bill-collector",
    timestamp: new Date().toISOString(),
  });
});

export default router;
