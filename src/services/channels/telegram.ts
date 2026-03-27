import TelegramBot from "node-telegram-bot-api";
import { v4 as uuidv4 } from "uuid";
import { config } from "../../config";
import { IncomingDocument } from "../../types";
import { processDocument } from "../../pipeline/processor";
import { logger } from "../../utils/logger";

let bot: TelegramBot | null = null;

/**
 * Start the Telegram bot to listen for photos and documents.
 */
export function startTelegramBot(): void {
  if (!config.telegram.enabled) {
    logger.info("Telegram bot not configured, skipping");
    return;
  }

  bot = new TelegramBot(config.telegram.botToken, { polling: true });

  bot.onText(/\/start/, (msg) => {
    bot!.sendMessage(
      msg.chat.id,
      "Welcome to Bill Collector!\n\n" +
        "Send me a photo or PDF of a receipt or invoice and I'll:\n" +
        "1. Extract all the details using AI\n" +
        "2. Match the vendor to your contacts\n" +
        "3. Save it as a bill or expense\n\n" +
        "Just snap a photo or forward a document!"
    );
  });

  bot.on("photo", async (msg) => {
    await handleTelegramMedia(msg, "photo");
  });

  bot.on("document", async (msg) => {
    if (!msg.document) return;
    const mime = msg.document.mime_type || "";
    if (
      mime.startsWith("image/") ||
      mime === "application/pdf"
    ) {
      await handleTelegramMedia(msg, "document");
    } else {
      bot!.sendMessage(
        msg.chat.id,
        "Please send an image or PDF file."
      );
    }
  });

  logger.info("Telegram bot started and listening for messages");
}

async function handleTelegramMedia(
  msg: TelegramBot.Message,
  type: "photo" | "document"
): Promise<void> {
  const chatId = msg.chat.id;

  if (!bot) return;

  await bot.sendMessage(chatId, "Processing your document...");

  try {
    let fileId: string;
    let mimeType: string;

    if (type === "photo" && msg.photo) {
      // Get the highest resolution photo
      const photo = msg.photo[msg.photo.length - 1];
      fileId = photo.file_id;
      mimeType = "image/jpeg";
    } else if (type === "document" && msg.document) {
      fileId = msg.document.file_id;
      mimeType = msg.document.mime_type || "application/octet-stream";
    } else {
      return;
    }

    // Download file from Telegram
    const fileBuffer = await bot.downloadFile(fileId, "/tmp");
    const fs = await import("fs");
    const fileContent = fs.readFileSync(fileBuffer as unknown as string);
    const base64 = fileContent.toString("base64");

    // Clean up temp file
    try {
      fs.unlinkSync(fileBuffer as unknown as string);
    } catch {
      // ignore cleanup errors
    }

    const doc: IncomingDocument = {
      id: uuidv4(),
      channel: "telegram",
      senderId: String(msg.from?.id || chatId),
      messageText: msg.caption || undefined,
      file: {
        name: msg.document?.file_name || `telegram-${Date.now()}.jpg`,
        mimeType,
        base64,
      },
      receivedAt: new Date(),
    };

    const result = await processDocument(doc);

    if (result.status === "saved" && result.extractedData) {
      const d = result.extractedData;
      const typeLabel =
        d.documentType === "invoice" ? "Bill (unpaid)" : "Expense (paid)";
      await bot.sendMessage(
        chatId,
        `Done! Created ${typeLabel}:\n\n` +
          `Vendor: ${d.vendorName}\n` +
          `Amount: ${d.currency} ${d.totalAmount.toFixed(2)}\n` +
          `Date: ${d.date}\n` +
          (result.matchedContact
            ? `Matched to: ${result.matchedContact.name}\n`
            : `New vendor (not matched)\n`) +
          (result.costCentreSuggestion
            ? `Cost centre: ${result.costCentreSuggestion.costCentre}\n`
            : "") +
          `\nRef: #${result.accountingRecordId}`
      );
    } else {
      await bot.sendMessage(
        chatId,
        `Sorry, couldn't process that document.\nError: ${result.error || "Unknown error"}`
      );
    }
  } catch (error) {
    logger.error("Telegram processing error", { error });
    await bot.sendMessage(
      chatId,
      "Sorry, something went wrong. Please try again."
    );
  }
}

export function stopTelegramBot(): void {
  if (bot) {
    bot.stopPolling();
    bot = null;
  }
}
