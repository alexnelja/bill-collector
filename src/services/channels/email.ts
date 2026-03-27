import Imap from "imap";
import { simpleParser, ParsedMail, Attachment } from "mailparser";
import { v4 as uuidv4 } from "uuid";
import { config } from "../../config";
import { IncomingDocument } from "../../types";
import { processDocument } from "../../pipeline/processor";
import { logger } from "../../utils/logger";

let imapClient: Imap | null = null;
let pollTimer: NodeJS.Timeout | null = null;

/**
 * Start polling the configured IMAP mailbox for new emails with attachments.
 */
export function startEmailListener(): void {
  if (!config.email.enabled) {
    logger.info("Email listener not configured, skipping");
    return;
  }

  logger.info(
    `Starting email listener for ${config.email.user} (polling every ${config.email.pollIntervalMs}ms)`
  );

  checkForNewEmails();
  pollTimer = setInterval(checkForNewEmails, config.email.pollIntervalMs);
}

export function stopEmailListener(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (imapClient) {
    imapClient.end();
    imapClient = null;
  }
}

async function checkForNewEmails(): Promise<void> {
  try {
    const imap = new Imap({
      user: config.email.user,
      password: config.email.password,
      host: config.email.host,
      port: config.email.port,
      tls: config.email.tls,
      tlsOptions: { rejectUnauthorized: false },
    });

    await new Promise<void>((resolve, reject) => {
      imap.once("ready", () => {
        imap.openBox("INBOX", false, (err) => {
          if (err) return reject(err);

          // Search for unseen messages
          imap.search(["UNSEEN"], (searchErr, uids) => {
            if (searchErr) {
              imap.end();
              return reject(searchErr);
            }

            if (!uids || uids.length === 0) {
              imap.end();
              return resolve();
            }

            logger.info(`Found ${uids.length} unread email(s)`);

            const fetch = imap.fetch(uids, { bodies: "", markSeen: true });

            fetch.on("message", (msg) => {
              let rawEmail = "";

              msg.on("body", (stream) => {
                stream.on("data", (chunk) => {
                  rawEmail += chunk.toString("utf8");
                });
              });

              msg.once("end", () => {
                processEmail(rawEmail).catch((e) =>
                  logger.error("Failed to process email", { error: e })
                );
              });
            });

            fetch.once("end", () => {
              imap.end();
              resolve();
            });

            fetch.once("error", (fetchErr) => {
              imap.end();
              reject(fetchErr);
            });
          });
        });
      });

      imap.once("error", reject);
      imap.connect();
    });
  } catch (error) {
    logger.error("Email check failed", { error });
  }
}

async function processEmail(rawEmail: string): Promise<void> {
  const parsed: ParsedMail = await simpleParser(rawEmail);

  const senderEmail =
    parsed.from?.value?.[0]?.address || "unknown@unknown.com";

  logger.info(
    `Processing email from ${senderEmail}: "${parsed.subject}"`
  );

  // Find image/PDF attachments
  const validAttachments = (parsed.attachments || []).filter(
    (att: Attachment) =>
      att.contentType.startsWith("image/") ||
      att.contentType === "application/pdf"
  );

  if (validAttachments.length === 0) {
    logger.info("Email has no image/PDF attachments, skipping");
    return;
  }

  // Process each attachment as a separate document
  for (const attachment of validAttachments) {
    const doc: IncomingDocument = {
      id: uuidv4(),
      channel: "email",
      senderId: senderEmail,
      messageText: parsed.subject || undefined,
      file: {
        name: attachment.filename || `email-${Date.now()}`,
        mimeType: attachment.contentType,
        base64: attachment.content.toString("base64"),
      },
      receivedAt: new Date(),
    };

    const result = await processDocument(doc);

    if (result.status === "saved") {
      logger.info(
        `Email attachment "${attachment.filename}" processed successfully → #${result.accountingRecordId}`
      );
    } else {
      logger.error(
        `Email attachment "${attachment.filename}" processing failed: ${result.error}`
      );
    }
  }
}
