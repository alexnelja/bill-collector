import QuickBooks from "node-quickbooks";
import OAuthClient from "intuit-oauth";
import Fuse from "fuse.js";
import { config } from "../../config";
import {
  IAccountingProvider,
  AccountingContact,
  AccountingTransaction,
  ExtractedData,
} from "../../types";
import { logger } from "../../utils/logger";

export class QuickBooksProvider implements IAccountingProvider {
  readonly name = "quickbooks" as const;
  private qbo: QuickBooks | null = null;
  private oauthClient: OAuthClient;

  constructor() {
    this.oauthClient = new OAuthClient({
      clientId: config.quickbooks.clientId,
      clientSecret: config.quickbooks.clientSecret,
      environment: config.quickbooks.environment === "sandbox" ? "sandbox" : "production",
      redirectUri: config.quickbooks.redirectUri,
    });

    if (config.quickbooks.accessToken && config.quickbooks.realmId) {
      this.initQBO(
        config.quickbooks.accessToken,
        config.quickbooks.refreshToken,
        config.quickbooks.realmId
      );
    }
  }

  private initQBO(accessToken: string, refreshToken: string, realmId: string) {
    this.qbo = new QuickBooks(
      config.quickbooks.clientId,
      config.quickbooks.clientSecret,
      accessToken,
      false, // no token secret for OAuth2
      realmId,
      config.quickbooks.environment === "sandbox",
      true, // debug
      null, // minor version
      "2.0", // oauth version
      refreshToken
    );
  }

  /** Generate OAuth authorization URL */
  getAuthUrl(): string {
    return this.oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: "quickbooks",
    });
  }

  /** Handle OAuth callback and initialize QBO client */
  async handleCallback(url: string): Promise<void> {
    const authResponse = await this.oauthClient.createToken(url);
    const token = authResponse.getJson();
    this.initQBO(
      token.access_token,
      token.refresh_token,
      (authResponse as unknown as Record<string, string>).realmId || config.quickbooks.realmId
    );
    logger.info("QuickBooks OAuth completed successfully");
  }

  private ensureConnected(): QuickBooks {
    if (!this.qbo) {
      throw new Error(
        "QuickBooks not connected. Complete OAuth flow at /auth/quickbooks"
      );
    }
    return this.qbo;
  }

  async findContact(vendorName: string): Promise<AccountingContact | null> {
    const qbo = this.ensureConnected();
    const vendors = await this.listContacts();

    if (vendors.length === 0) return null;

    // Fuzzy match vendor name
    const fuse = new Fuse(vendors, {
      keys: ["name"],
      threshold: 0.4,
      includeScore: true,
    });

    const results = fuse.search(vendorName);
    if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.4) {
      logger.info(
        `Matched vendor "${vendorName}" to QBO contact "${results[0].item.name}" (score: ${results[0].score})`
      );
      return results[0].item;
    }

    return null;
  }

  async listContacts(): Promise<AccountingContact[]> {
    const qbo = this.ensureConnected();

    return new Promise((resolve, reject) => {
      qbo.findVendors(
        { fetchAll: true },
        (err: Error | null, data: unknown) => {
          if (err) return reject(err);
          const vendors = data as { QueryResponse?: { Vendor?: Array<Record<string, unknown>> } };
          const list = vendors?.QueryResponse?.Vendor || [];
          resolve(
            list.map((v: Record<string, unknown>) => ({
              id: String(v.Id),
              name: String(v.DisplayName || v.CompanyName || ""),
              email:
                v.PrimaryEmailAddr
                  ? String((v.PrimaryEmailAddr as Record<string, unknown>).Address || "")
                  : undefined,
              phone:
                v.PrimaryPhone
                  ? String((v.PrimaryPhone as Record<string, unknown>).FreeFormNumber || "")
                  : undefined,
              taxNumber: v.TaxIdentifier ? String(v.TaxIdentifier) : undefined,
              raw: v,
            }))
          );
        }
      );
    });
  }

  async getRecentTransactions(
    contactId: string,
    limit = 10
  ): Promise<AccountingTransaction[]> {
    const qbo = this.ensureConnected();

    return new Promise((resolve, reject) => {
      qbo.findBills(
        {
          VendorRef: contactId,
          desc: "TxnDate",
          limit,
        },
        (err: Error | null, raw: unknown) => {
          if (err) return reject(err);
          const data = raw as { QueryResponse?: { Bill?: Array<Record<string, unknown>> } };
          const bills = data?.QueryResponse?.Bill || [];
          resolve(
            bills.map((b: Record<string, unknown>) => {
              const lines = (b.Line as Array<Record<string, unknown>>) || [];
              const firstLine = lines[0] || {};
              const detail =
                (firstLine.AccountBasedExpenseLineDetail as Record<string, unknown>) || {};
              const accountRef = (detail.AccountRef as Record<string, unknown>) || {};
              const classRef = (detail.ClassRef as Record<string, unknown>) || {};

              return {
                id: String(b.Id),
                contactId,
                contactName: String(
                  (b.VendorRef as Record<string, unknown>)?.name || ""
                ),
                date: String(b.TxnDate),
                amount: Number(b.TotalAmt) || 0,
                currency: String(
                  (b.CurrencyRef as Record<string, unknown>)?.value || "USD"
                ),
                accountCode: accountRef.value
                  ? String(accountRef.value)
                  : undefined,
                costCentre: classRef.value
                  ? String(classRef.value)
                  : undefined,
                description: firstLine.Description
                  ? String(firstLine.Description)
                  : undefined,
                type: "bill" as const,
              };
            })
          );
        }
      );
    });
  }

  async createBill(
    data: ExtractedData,
    contact: AccountingContact | null,
    costCentre?: string
  ): Promise<string> {
    const qbo = this.ensureConnected();

    const lineItems = data.lineItems.map((item) => {
      const line: Record<string, unknown> = {
        DetailType: "AccountBasedExpenseLineDetail",
        Amount: item.amount,
        Description: item.description,
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: item.accountCode || "7" }, // Default expense account
          BillableStatus: "NotBillable",
          TaxCodeRef: { value: "TAX" },
        },
      };
      if (costCentre) {
        (
          line.AccountBasedExpenseLineDetail as Record<string, unknown>
        ).ClassRef = { value: costCentre };
      }
      return line;
    });

    const bill: Record<string, unknown> = {
      Line: lineItems,
      TxnDate: data.date,
      DueDate: data.dueDate || data.date,
      DocNumber: data.documentNumber,
      PrivateNote: data.notes,
      CurrencyRef: { value: data.currency },
    };

    if (contact) {
      bill.VendorRef = { value: contact.id, name: contact.name };
    }

    return new Promise((resolve, reject) => {
      qbo.createBill(
        bill,
        (err: Error | null, raw: unknown) => {
          if (err) return reject(err);
          const created = raw as Record<string, unknown>;
          const id = String(created.Id);
          logger.info(`Created QBO Bill #${id} for ${data.vendorName}`);
          resolve(id);
        }
      );
    });
  }

  async createExpense(
    data: ExtractedData,
    contact: AccountingContact | null,
    costCentre?: string,
    paymentAccountId = "35" // Default bank/cash account
  ): Promise<string> {
    const qbo = this.ensureConnected();

    const lineItems = data.lineItems.map((item) => {
      const line: Record<string, unknown> = {
        DetailType: "AccountBasedExpenseLineDetail",
        Amount: item.amount,
        Description: item.description,
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: item.accountCode || "7" },
          BillableStatus: "NotBillable",
          TaxCodeRef: { value: "TAX" },
        },
      };
      if (costCentre) {
        (
          line.AccountBasedExpenseLineDetail as Record<string, unknown>
        ).ClassRef = { value: costCentre };
      }
      return line;
    });

    const purchase: Record<string, unknown> = {
      PaymentType: "Cash",
      Line: lineItems,
      TxnDate: data.date,
      DocNumber: data.documentNumber,
      PrivateNote: data.notes,
      CurrencyRef: { value: data.currency },
      AccountRef: { value: paymentAccountId },
    };

    if (contact) {
      purchase.EntityRef = {
        value: contact.id,
        name: contact.name,
        type: "Vendor",
      };
    }

    return new Promise((resolve, reject) => {
      qbo.createPurchase(
        purchase,
        (err: Error | null, raw: unknown) => {
          if (err) return reject(err);
          const created = raw as Record<string, unknown>;
          const id = String(created.Id);
          logger.info(`Created QBO Expense #${id} for ${data.vendorName}`);
          resolve(id);
        }
      );
    });
  }
}
