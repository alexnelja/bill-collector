import { v4 as uuidv4 } from "uuid";
import twilio from "twilio";
import { config } from "../../config";
import { IncomingDocument } from "../../types";
import { processDocument } from "../../pipeline/processor";
import { processingQueue } from "../queue";
import { logger } from "../../utils/logger";
import { Request, Response } from "express";

const client = config.twilio.enabled
  ? twilio(config.twilio.accountSid, config.twilio.authToken)
  : null;

/**
 * Handle incoming WhatsApp messages via Twilio webhook.
 * Twilio sends media URLs for images/PDFs attached to messages.
 */
export async function handleWhatsAppWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const { From, Body, NumMedia, MediaUrl0, MediaContentType0 } = req.body;

  logger.info(`WhatsApp message from ${From}: "${Body}" (media: ${NumMedia})`);

  if (!NumMedia || parseInt(NumMedia, 10) === 0) {
    await sendWhatsAppReply(
      From,
      "Please send a photo or PDF of your receipt or invoice and I'll process it for you."
    );
    res.status(200).send("<Response></Response>");
    return;
  }

  // Acknowledge receipt immediately
  await sendWhatsAppReply(
    From,
    "Got it! Processing your document now..."
  );
  res.status(200).send("<Response></Response>");

  try {
    // Download the media from Twilio
    const mediaUrl = MediaUrl0;
    const mimeType = MediaContentType0 || "image/jpeg";

    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.twilio.accountSid}:${config.twilio.authToken}`
        ).toString("base64")}`,
      },
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString("base64");

    const doc: IncomingDocument = {
      id: uuidv4(),
      channel: "whatsapp",
      senderId: From,
      messageText: Body || undefined,
      file: {
        name: `whatsapp-${Date.now()}.${mimeType.split("/")[1]}`,
        mimeType,
        base64,
      },
      receivedAt: new Date(),
    };

    const result = await processingQueue.enqueue(() => processDocument(doc));

    if (result.status === "saved" && result.extractedData) {
      const d = result.extractedData;
      const typeLabel =
        d.documentType === "invoice" ? "Bill (unpaid)" : "Expense (paid)";
      await sendWhatsAppReply(
        From,
        `Done! Created ${typeLabel}:\n` +
          `Vendor: ${d.vendorName}\n` +
          `Amount: ${d.currency} ${d.totalAmount.toFixed(2)}\n` +
          `Date: ${d.date}\n` +
          (result.matchedContact
            ? `Matched to: ${result.matchedContact.name}\n`
            : "") +
          (result.costCentreSuggestion
            ? `Cost centre: ${result.costCentreSuggestion.costCentre}\n`
            : "") +
          `Ref: #${result.accountingRecordId}`
      );
    } else {
      await sendWhatsAppReply(
        From,
        `Sorry, I couldn't process that document. Error: ${result.error || "Unknown error"}`
      );
    }
  } catch (error) {
    logger.error("WhatsApp processing error", { error });
    await sendWhatsAppReply(
      From,
      "Sorry, something went wrong processing your document. Please try again."
    );
  }
}

async function sendWhatsAppReply(to: string, body: string): Promise<void> {
  if (!client) {
    logger.warn("Twilio client not configured, skipping reply");
    return;
  }
  try {
    await client.messages.create({
      from: config.twilio.whatsappNumber,
      to,
      body,
    });
  } catch (error) {
    logger.error("Failed to send WhatsApp reply", { error });
  }
}
