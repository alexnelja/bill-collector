import { Router, Request, Response } from "express";
import { historyStore } from "../services/history";
import { InputChannel } from "../types";

const router = Router();

router.get("/api/history", (req: Request, res: Response) => {
  const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = Math.min(parseInt(limitParam as string, 10) || 50, 200);
  const channelParam = Array.isArray(req.query.channel) ? req.query.channel[0] : req.query.channel;
  const channel = channelParam as InputChannel | undefined;

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
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = historyStore.getById(id as string);
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
