import { XeroClient, Invoice, LineItem as XeroLineItem, Contact, Invoices, Payment, Account, BankTransaction, LineAmountTypes } from "xero-node";
import Fuse from "fuse.js";
import { config } from "../../config";
import {
  IAccountingProvider,
  AccountingContact,
  AccountingTransaction,
  ExtractedData,
} from "../../types";
import { logger } from "../../utils/logger";

export class XeroProvider implements IAccountingProvider {
  readonly name = "xero" as const;
  private xero: XeroClient;
  private tenantId: string;

  constructor() {
    this.xero = new XeroClient({
      clientId: config.xero.clientId,
      clientSecret: config.xero.clientSecret,
      redirectUris: [config.xero.redirectUri],
      scopes: [
        "openid",
        "profile",
        "email",
        "accounting.transactions",
        "accounting.contacts",
        "accounting.settings",
        "offline_access",
      ],
    });

    this.tenantId = config.xero.tenantId;

    if (config.xero.accessToken) {
      this.xero.setTokenSet({
        access_token: config.xero.accessToken,
        refresh_token: config.xero.refreshToken,
        token_type: "Bearer",
      });
    }
  }

  /** Generate OAuth authorization URL */
  async getAuthUrl(): Promise<string> {
    const consentUrl = await this.xero.buildConsentUrl();
    return consentUrl;
  }

  /** Handle OAuth callback */
  async handleCallback(url: string): Promise<void> {
    await this.xero.apiCallback(url);
    await this.xero.updateTenants();
    const tenants = this.xero.tenants;
    if (tenants.length > 0) {
      this.tenantId = tenants[0].tenantId;
    }
    logger.info("Xero OAuth completed successfully");
  }

  async findContact(vendorName: string): Promise<AccountingContact | null> {
    const contacts = await this.listContacts();
    if (contacts.length === 0) return null;

    const fuse = new Fuse(contacts, {
      keys: ["name"],
      threshold: 0.4,
      includeScore: true,
    });

    const results = fuse.search(vendorName);
    if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.4) {
      logger.info(
        `Matched vendor "${vendorName}" to Xero contact "${results[0].item.name}" (score: ${results[0].score})`
      );
      return results[0].item;
    }

    return null;
  }

  async listContacts(): Promise<AccountingContact[]> {
    const response = await this.xero.accountingApi.getContacts(
      this.tenantId,
      undefined,
      'IsSupplier==true'
    );

    const contacts = response.body.contacts || [];
    return contacts.map((c) => ({
      id: c.contactID || "",
      name: c.name || "",
      email: c.emailAddress || undefined,
      phone: c.phones?.[0]?.phoneNumber || undefined,
      taxNumber: c.taxNumber || undefined,
      raw: c,
    }));
  }

  async getRecentTransactions(
    contactId: string,
    limit = 10
  ): Promise<AccountingTransaction[]> {
    const response = await this.xero.accountingApi.getInvoices(
      this.tenantId,
      undefined,
      `Contact.ContactID=guid("${contactId}")`,
      "Date DESC",
      undefined,
      undefined,
      undefined,
      undefined,
      limit,
      undefined,
      undefined,
      undefined,
      ["ACCPAY"] as unknown as boolean // Bills only (type filter)
    );

    const invoices = response.body.invoices || [];
    return invoices.map((inv) => {
      const firstLine = inv.lineItems?.[0];
      return {
        id: inv.invoiceID || "",
        contactId,
        contactName: inv.contact?.name || "",
        date: inv.date ? new Date(inv.date).toISOString().split("T")[0] : "",
        amount: inv.total || 0,
        currency: inv.currencyCode?.toString() || "USD",
        accountCode: firstLine?.accountCode || undefined,
        costCentre: firstLine?.tracking?.[0]?.option || undefined,
        description: firstLine?.description || undefined,
        type: "bill" as const,
      };
    });
  }

  async createBill(
    data: ExtractedData,
    contact: AccountingContact | null,
    costCentre?: string
  ): Promise<string> {
    const lineItems: XeroLineItem[] = data.lineItems.map((item) => {
      const line: XeroLineItem = {
        description: item.description,
        quantity: item.quantity,
        unitAmount: item.unitPrice,
        accountCode: item.accountCode || "400", // Default expense account
        taxAmount: item.taxAmount,
      };

      if (costCentre) {
        line.tracking = [
          {
            trackingCategoryID: costCentre,
            option: costCentre,
          } as unknown as import("xero-node").LineItemTracking,
        ];
      }

      return line;
    });

    const invoiceData: Invoice = {
      type: Invoice.TypeEnum.ACCPAY,
      contact: contact
        ? ({ contactID: contact.id, name: contact.name } as Contact)
        : ({ name: data.vendorName } as Contact),
      date: data.date,
      dueDate: data.dueDate || data.date,
      invoiceNumber: data.documentNumber,
      lineItems,
      currencyCode: data.currency as unknown as import("xero-node").CurrencyCode,
      status: Invoice.StatusEnum.AUTHORISED,
      lineAmountTypes: LineAmountTypes.Inclusive,
      reference: data.notes,
    };

    const response = await this.xero.accountingApi.createInvoices(
      this.tenantId,
      { invoices: [invoiceData] }
    );

    const created = response.body.invoices?.[0];
    const id = created?.invoiceID || "";
    logger.info(`Created Xero Bill ${id} for ${data.vendorName}`);
    return id;
  }

  async createExpense(
    data: ExtractedData,
    contact: AccountingContact | null,
    costCentre?: string,
    paymentAccountId?: string
  ): Promise<string> {
    // In Xero, a paid receipt is a bank transaction (spend money)
    const lineItems: XeroLineItem[] = data.lineItems.map((item) => {
      const line: XeroLineItem = {
        description: item.description,
        quantity: item.quantity,
        unitAmount: item.unitPrice,
        accountCode: item.accountCode || "400",
        taxAmount: item.taxAmount,
      };

      if (costCentre) {
        line.tracking = [
          {
            trackingCategoryID: costCentre,
            option: costCentre,
          } as unknown as import("xero-node").LineItemTracking,
        ];
      }

      return line;
    });

    const bankTransaction: BankTransaction = {
      type: BankTransaction.TypeEnum.SPEND,
      contact: contact
        ? ({ contactID: contact.id, name: contact.name } as Contact)
        : ({ name: data.vendorName } as Contact),
      date: data.date,
      lineItems,
      bankAccount: {
        accountID: paymentAccountId || "",
      } as Account,
      reference: data.documentNumber || data.notes,
      currencyCode: data.currency as unknown as import("xero-node").CurrencyCode,
      lineAmountTypes: LineAmountTypes.Inclusive,
    };

    const response = await this.xero.accountingApi.createBankTransactions(
      this.tenantId,
      { bankTransactions: [bankTransaction] }
    );

    const created = response.body.bankTransactions?.[0];
    const id = created?.bankTransactionID || "";
    logger.info(`Created Xero Expense ${id} for ${data.vendorName}`);
    return id;
  }
}
