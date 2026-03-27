import { Router, Request, Response } from "express";
import { getQuickBooksProvider, getXeroProvider } from "../services/accounting";
import { config } from "../config";
import { logger } from "../utils/logger";

const router = Router();

// ── QuickBooks OAuth ────────────────────────────────────────────────────────
router.get("/auth/quickbooks", (_req: Request, res: Response) => {
  if (!config.quickbooks.enabled) {
    res.status(400).json({ error: "QuickBooks not configured" });
    return;
  }
  const provider = getQuickBooksProvider();
  const authUrl = provider.getAuthUrl();
  res.redirect(authUrl);
});

router.get("/auth/quickbooks/callback", async (req: Request, res: Response) => {
  try {
    const provider = getQuickBooksProvider();
    await provider.handleCallback(req.url);
    res.json({
      message: "QuickBooks connected successfully!",
      hint: "You can now send receipts and invoices for processing.",
    });
  } catch (error) {
    logger.error("QuickBooks OAuth callback error", { error });
    res.status(500).json({ error: "QuickBooks authentication failed" });
  }
});

// ── Xero OAuth ──────────────────────────────────────────────────────────────
router.get("/auth/xero", async (_req: Request, res: Response) => {
  if (!config.xero.enabled) {
    res.status(400).json({ error: "Xero not configured" });
    return;
  }
  const provider = getXeroProvider();
  const authUrl = await provider.getAuthUrl();
  res.redirect(authUrl);
});

router.get("/auth/xero/callback", async (req: Request, res: Response) => {
  try {
    const provider = getXeroProvider();
    await provider.handleCallback(req.url);
    res.json({
      message: "Xero connected successfully!",
      hint: "You can now send receipts and invoices for processing.",
    });
  } catch (error) {
    logger.error("Xero OAuth callback error", { error });
    res.status(500).json({ error: "Xero authentication failed" });
  }
});

export default router;
