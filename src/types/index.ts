// =============================================================================
// Core domain types for the Bill Collector system
// =============================================================================

/** The source channel that sent the document */
export type InputChannel = "whatsapp" | "telegram" | "email" | "api";

/** Whether the document is an invoice (unpaid bill) or a receipt (already paid) */
export type DocumentType = "invoice" | "receipt" | "unknown";

/** Accounting system to sync with */
export type AccountingProvider = "quickbooks" | "xero";

/** Status of a processed document */
export type ProcessingStatus =
  | "received"
  | "extracting"
  | "extracted"
  | "matching"
  | "matched"
  | "saving"
  | "saved"
  | "failed";

// -----------------------------------------------------------------------------
// Extracted data from OCR
// -----------------------------------------------------------------------------

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxAmount?: number;
  accountCode?: string;
}

export interface ExtractedData {
  /** "invoice" or "receipt" */
  documentType: DocumentType;
  /** Vendor / supplier name */
  vendorName: string;
  /** Invoice or receipt number */
  documentNumber?: string;
  /** Date on the document (ISO string) */
  date: string;
  /** Due date if applicable (ISO string) */
  dueDate?: string;
  /** Currency code (e.g. "USD", "ZAR", "GBP") */
  currency: string;
  /** Subtotal before tax */
  subtotal: number;
  /** Tax / VAT amount */
  taxAmount: number;
  /** Total amount including tax */
  totalAmount: number;
  /** Individual line items */
  lineItems: LineItem[];
  /** Tax rate percentage detected */
  taxRate?: number;
  /** Payment method noted on receipt */
  paymentMethod?: string;
  /** Any notes or description */
  notes?: string;
  /** Raw OCR text for reference */
  rawText?: string;
  /** Confidence score 0-1 */
  confidence: number;
}

// -----------------------------------------------------------------------------
// Accounting contacts & transactions
// -----------------------------------------------------------------------------

export interface AccountingContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  taxNumber?: string;
  /** Provider-specific raw data */
  raw?: unknown;
}

export interface AccountingTransaction {
  id: string;
  contactId: string;
  contactName: string;
  date: string;
  amount: number;
  currency: string;
  accountCode?: string;
  costCentre?: string;
  description?: string;
  type: "bill" | "expense" | "payment";
}

export interface CostCentreSuggestion {
  costCentre: string;
  accountCode: string;
  confidence: number;
  reason: string;
}

// -----------------------------------------------------------------------------
// Incoming document from any channel
// -----------------------------------------------------------------------------

export interface IncomingDocument {
  /** Unique ID for this processing job */
  id: string;
  /** Which channel it came from */
  channel: InputChannel;
  /** Sender identifier (phone number, telegram user ID, email address) */
  senderId: string;
  /** Optional text message accompanying the document */
  messageText?: string;
  /** The file to process */
  file: {
    /** Original filename */
    name: string;
    /** MIME type */
    mimeType: string;
    /** File content as base64 */
    base64: string;
  };
  /** When the document was received */
  receivedAt: Date;
}

// -----------------------------------------------------------------------------
// Processing result
// -----------------------------------------------------------------------------

export interface ProcessingResult {
  id: string;
  status: ProcessingStatus;
  document: IncomingDocument;
  extractedData?: ExtractedData;
  matchedContact?: AccountingContact;
  costCentreSuggestion?: CostCentreSuggestion;
  /** ID of the created bill/expense in the accounting system */
  accountingRecordId?: string;
  error?: string;
  processedAt?: Date;
}

// -----------------------------------------------------------------------------
// Accounting provider interface
// -----------------------------------------------------------------------------

export interface IAccountingProvider {
  readonly name: AccountingProvider;

  /** Search for contacts matching a vendor name */
  findContact(vendorName: string): Promise<AccountingContact | null>;

  /** Get all contacts */
  listContacts(): Promise<AccountingContact[]>;

  /** Get recent transactions for a contact to determine cost centre */
  getRecentTransactions(
    contactId: string,
    limit?: number
  ): Promise<AccountingTransaction[]>;

  /** Create a new bill (unpaid invoice) */
  createBill(
    data: ExtractedData,
    contact: AccountingContact | null,
    costCentre?: string
  ): Promise<string>;

  /** Create an expense / receipt (marked as paid) */
  createExpense(
    data: ExtractedData,
    contact: AccountingContact | null,
    costCentre?: string,
    paymentAccountId?: string
  ): Promise<string>;
}
