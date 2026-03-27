import { v4 as uuidv4 } from "uuid";
import {
  IncomingDocument,
  ProcessingResult,
  CostCentreSuggestion,
  AccountingContact,
  AccountingTransaction,
} from "../types";
import { extractDocumentData } from "../services/ocr/extractor";
import { getAccountingProvider } from "../services/accounting";
import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * Main processing pipeline:
 * 1. OCR extraction via Claude Vision
 * 2. Contact matching against QuickBooks/Xero
 * 3. Cost centre suggestion from past transactions
 * 4. Save as Bill (invoice) or Expense (receipt)
 */
export async function processDocument(
  doc: IncomingDocument
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    id: doc.id || uuidv4(),
    status: "received",
    document: doc,
  };

  try {
    // ── Step 1: OCR Extraction ──────────────────────────────────────────
    result.status = "extracting";
    logger.info(`[${result.id}] Step 1: Extracting data from ${doc.file.mimeType}`);

    result.extractedData = await extractDocumentData(
      doc.file.base64,
      doc.file.mimeType,
      doc.messageText
    );
    result.status = "extracted";

    // ── Step 2: Contact Matching ────────────────────────────────────────
    result.status = "matching";
    const provider = getAccountingProvider();
    logger.info(
      `[${result.id}] Step 2: Matching vendor "${result.extractedData.vendorName}" in ${provider.name}`
    );

    const matchedContact = await provider.findContact(
      result.extractedData.vendorName
    );
    result.matchedContact = matchedContact || undefined;

    if (matchedContact) {
      logger.info(
        `[${result.id}] Matched to contact: ${matchedContact.name} (${matchedContact.id})`
      );
    } else {
      logger.info(
        `[${result.id}] No existing contact found for "${result.extractedData.vendorName}" - will create new`
      );
    }

    // ── Step 3: Cost Centre Suggestion ──────────────────────────────────
    let costCentre: string | undefined = config.defaultCostCentre || undefined;

    if (matchedContact) {
      const suggestion = await suggestCostCentre(
        provider,
        matchedContact
      );
      if (suggestion) {
        result.costCentreSuggestion = suggestion;
        costCentre = suggestion.costCentre;
        logger.info(
          `[${result.id}] Suggested cost centre: ${costCentre} (confidence: ${suggestion.confidence}, reason: ${suggestion.reason})`
        );
      }
    }

    result.status = "matched";

    // ── Step 4: Save to Accounting System ───────────────────────────────
    result.status = "saving";
    const docType = result.extractedData.documentType;

    if (docType === "invoice") {
      logger.info(
        `[${result.id}] Step 4: Creating Bill (unpaid invoice) in ${provider.name}`
      );
      result.accountingRecordId = await provider.createBill(
        result.extractedData,
        matchedContact || null,
        costCentre
      );
    } else {
      // receipt or unknown → treat as paid expense
      logger.info(
        `[${result.id}] Step 4: Creating Expense (paid receipt) in ${provider.name}`
      );
      result.accountingRecordId = await provider.createExpense(
        result.extractedData,
        matchedContact || null,
        costCentre
      );
    }

    result.status = "saved";
    result.processedAt = new Date();
    logger.info(
      `[${result.id}] Done! ${docType === "invoice" ? "Bill" : "Expense"} #${result.accountingRecordId} created`
    );

    return result;
  } catch (error) {
    result.status = "failed";
    result.error =
      error instanceof Error ? error.message : "Unknown error occurred";
    logger.error(`[${result.id}] Processing failed: ${result.error}`, {
      error,
    });
    return result;
  }
}

/**
 * Analyze past transactions for a contact to suggest the most likely cost centre.
 */
async function suggestCostCentre(
  provider: ReturnType<typeof getAccountingProvider>,
  contact: AccountingContact
): Promise<CostCentreSuggestion | null> {
  try {
    const transactions = await provider.getRecentTransactions(contact.id, 20);

    if (transactions.length === 0) return null;

    // Count cost centre occurrences
    const costCentreCount = new Map<string, number>();
    const accountCodeCount = new Map<string, number>();

    for (const txn of transactions) {
      if (txn.costCentre) {
        costCentreCount.set(
          txn.costCentre,
          (costCentreCount.get(txn.costCentre) || 0) + 1
        );
      }
      if (txn.accountCode) {
        accountCodeCount.set(
          txn.accountCode,
          (accountCodeCount.get(txn.accountCode) || 0) + 1
        );
      }
    }

    // Find the most common cost centre
    let topCostCentre = "";
    let topCount = 0;
    for (const [cc, count] of costCentreCount) {
      if (count > topCount) {
        topCostCentre = cc;
        topCount = count;
      }
    }

    // Find the most common account code
    let topAccountCode = "";
    let topAccCount = 0;
    for (const [ac, count] of accountCodeCount) {
      if (count > topAccCount) {
        topAccountCode = ac;
        topAccCount = count;
      }
    }

    if (!topCostCentre && !topAccountCode) return null;

    const confidence = topCount / transactions.length;

    return {
      costCentre: topCostCentre || config.defaultCostCentre,
      accountCode: topAccountCode,
      confidence,
      reason: `Based on ${topCount}/${transactions.length} past transactions for ${contact.name}`,
    };
  } catch (error) {
    logger.warn("Could not determine cost centre from past transactions", {
      error,
    });
    return null;
  }
}
