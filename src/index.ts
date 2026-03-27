import express from "express";
import { config } from "./config";
import { logger } from "./utils/logger";
import webhookRoutes from "./routes/webhooks";
import authRoutes from "./routes/auth";
import { startTelegramBot, stopTelegramBot } from "./services/channels/telegram";
import { startEmailListener, stopEmailListener } from "./services/channels/email";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(webhookRoutes);
app.use(authRoutes);

// Landing page
app.get("/", (_req, res) => {
  res.json({
    name: "Bill Collector",
    description:
      "AI-powered expense receipt scanner. Send photos or PDFs of receipts and invoices via WhatsApp, Telegram, email, or the API.",
    endpoints: {
      health: "GET /health",
      upload: "POST /api/upload (multipart/form-data, field: file)",
      whatsapp: "POST /webhook/whatsapp (Twilio webhook)",
      quickbooksAuth: "GET /auth/quickbooks",
      xeroAuth: "GET /auth/xero",
    },
    channels: {
      whatsapp: config.twilio.enabled ? "enabled" : "not configured",
      telegram: config.telegram.enabled ? "enabled" : "not configured",
      email: config.email.enabled ? "enabled" : "not configured",
    },
    accountingProvider: config.accountingProvider,
  });
});

// Start server
const server = app.listen(config.port, () => {
  logger.info(`Bill Collector running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Accounting provider: ${config.accountingProvider}`);

  // Start input channel listeners
  startTelegramBot();
  startEmailListener();

  if (config.twilio.enabled) {
    logger.info(
      `WhatsApp webhook ready at POST /webhook/whatsapp`
    );
  }
});

// Graceful shutdown
function shutdown() {
  logger.info("Shutting down...");
  stopTelegramBot();
  stopEmailListener();
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
