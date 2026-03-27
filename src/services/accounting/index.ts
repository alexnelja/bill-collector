import { config } from "../../config";
import { IAccountingProvider, AccountingProvider } from "../../types";
import { QuickBooksProvider } from "./quickbooks";
import { XeroProvider } from "./xero";
import { logger } from "../../utils/logger";

let provider: IAccountingProvider | null = null;
let quickbooksProvider: QuickBooksProvider | null = null;
let xeroProvider: XeroProvider | null = null;

export function getAccountingProvider(
  override?: AccountingProvider
): IAccountingProvider {
  const name = override || config.accountingProvider;

  if (provider && provider.name === name) return provider;

  if (name === "quickbooks") {
    if (!quickbooksProvider) {
      quickbooksProvider = new QuickBooksProvider();
    }
    provider = quickbooksProvider;
  } else {
    if (!xeroProvider) {
      xeroProvider = new XeroProvider();
    }
    provider = xeroProvider;
  }

  logger.info(`Using accounting provider: ${name}`);
  return provider;
}

export function getQuickBooksProvider(): QuickBooksProvider {
  if (!quickbooksProvider) {
    quickbooksProvider = new QuickBooksProvider();
  }
  return quickbooksProvider;
}

export function getXeroProvider(): XeroProvider {
  if (!xeroProvider) {
    xeroProvider = new XeroProvider();
  }
  return xeroProvider;
}
