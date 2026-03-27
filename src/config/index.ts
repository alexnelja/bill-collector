import dotenv from "dotenv";
import { AccountingProvider } from "../types";

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue = ""): string {
  return process.env[key] || defaultValue;
}

export const config = {
  port: parseInt(optional("PORT", "3000"), 10),
  nodeEnv: optional("NODE_ENV", "development"),
  logLevel: optional("LOG_LEVEL", "info"),

  anthropic: {
    apiKey: required("ANTHROPIC_API_KEY"),
  },

  twilio: {
    accountSid: optional("TWILIO_ACCOUNT_SID"),
    authToken: optional("TWILIO_AUTH_TOKEN"),
    whatsappNumber: optional("TWILIO_WHATSAPP_NUMBER"),
    get enabled() {
      return !!(this.accountSid && this.authToken);
    },
  },

  telegram: {
    botToken: optional("TELEGRAM_BOT_TOKEN"),
    get enabled() {
      return !!this.botToken;
    },
  },

  email: {
    host: optional("EMAIL_IMAP_HOST", "imap.gmail.com"),
    port: parseInt(optional("EMAIL_IMAP_PORT", "993"), 10),
    user: optional("EMAIL_IMAP_USER"),
    password: optional("EMAIL_IMAP_PASSWORD"),
    tls: optional("EMAIL_IMAP_TLS", "true") === "true",
    pollIntervalMs: parseInt(optional("EMAIL_POLL_INTERVAL_MS", "30000"), 10),
    get enabled() {
      return !!(this.user && this.password);
    },
  },

  quickbooks: {
    clientId: optional("QBO_CLIENT_ID"),
    clientSecret: optional("QBO_CLIENT_SECRET"),
    redirectUri: optional(
      "QBO_REDIRECT_URI",
      "http://localhost:3000/auth/quickbooks/callback"
    ),
    environment: optional("QBO_ENVIRONMENT", "sandbox") as
      | "sandbox"
      | "production",
    realmId: optional("QBO_REALM_ID"),
    accessToken: optional("QBO_ACCESS_TOKEN"),
    refreshToken: optional("QBO_REFRESH_TOKEN"),
    get enabled() {
      return !!(this.clientId && this.clientSecret);
    },
  },

  xero: {
    clientId: optional("XERO_CLIENT_ID"),
    clientSecret: optional("XERO_CLIENT_SECRET"),
    redirectUri: optional(
      "XERO_REDIRECT_URI",
      "http://localhost:3000/auth/xero/callback"
    ),
    tenantId: optional("XERO_TENANT_ID"),
    accessToken: optional("XERO_ACCESS_TOKEN"),
    refreshToken: optional("XERO_REFRESH_TOKEN"),
    get enabled() {
      return !!(this.clientId && this.clientSecret);
    },
  },

  accountingProvider: optional("ACCOUNTING_PROVIDER", "quickbooks") as AccountingProvider,
  defaultCostCentre: optional("DEFAULT_COST_CENTRE"),
} as const;
