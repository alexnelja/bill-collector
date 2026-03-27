# Bill Collector

AI-powered expense receipt scanner that captures bills and receipts from WhatsApp, Telegram, or email, extracts data via Claude Vision OCR, matches vendors and cost centres against your accounting system, and saves them as bills or expenses in QuickBooks Online or Xero.

## How It Works

```
Photo/PDF ──► WhatsApp (Twilio)  ──┐
Photo/PDF ──► Telegram Bot       ──┼──► Claude Vision OCR ──► Contact Matching ──► Cost Centre ──► QuickBooks / Xero
Photo/PDF ──► Email (IMAP)       ──┤                              (fuzzy)          (from history)
Photo/PDF ──► REST API           ──┘
```

1. **Receive** - Documents arrive via any channel (WhatsApp, Telegram, Email, or direct API upload)
2. **Extract** - Claude Vision analyzes the image/PDF and extracts vendor, date, amounts, line items, currency, tax
3. **Classify** - AI determines if it's an **invoice** (unpaid bill) or **receipt** (already paid)
4. **Match** - Fuzzy-matches the vendor name against your existing QuickBooks/Xero contacts
5. **Allocate** - Looks at past transactions for that vendor to suggest the correct cost centre/tracking category
6. **Save** - Creates the record in your accounting system:
   - **Invoice** → saved as an unpaid **Bill**
   - **Receipt** → saved as a paid **Expense** allocated to the correct cost centre

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/alexnelja/bill-collector.git
cd bill-collector
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required:
- `ANTHROPIC_API_KEY` - For Claude Vision OCR

At least one input channel:
- **WhatsApp**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- **Telegram**: `TELEGRAM_BOT_TOKEN`
- **Email**: `EMAIL_IMAP_USER`, `EMAIL_IMAP_PASSWORD`

At least one accounting provider:
- **QuickBooks**: `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`
- **Xero**: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`

### 3. Connect your accounting system

```bash
npm run dev
```

Then visit:
- QuickBooks: `http://localhost:3000/auth/quickbooks`
- Xero: `http://localhost:3000/auth/xero`

### 4. Start sending documents

- **WhatsApp**: Send a photo/PDF to your Twilio WhatsApp number
- **Telegram**: Send a photo/PDF to your bot
- **Email**: Forward receipts/invoices to your configured email
- **API**: `curl -F file=@receipt.jpg http://localhost:3000/api/upload`

## API

### Upload a document

```bash
curl -X POST http://localhost:3000/api/upload \
  -F file=@invoice.pdf \
  -F sender=user@example.com \
  -F message="Office supplies"
```

Response:
```json
{
  "id": "a1b2c3d4-...",
  "status": "saved",
  "documentType": "invoice",
  "vendor": "Acme Corp",
  "amount": 1500.00,
  "currency": "USD",
  "date": "2026-03-27",
  "matchedContact": "Acme Corporation",
  "costCentre": "Office",
  "accountingRecordId": "12345"
}
```

### Health check

```bash
curl http://localhost:3000/health
```

## Docker

```bash
docker compose up --build
```

## Project Structure

```
src/
├── index.ts                    # Express server entry point
├── config/index.ts             # Environment configuration
├── types/index.ts              # TypeScript type definitions
├── utils/logger.ts             # Winston logger
├── pipeline/processor.ts       # Main processing pipeline (OCR → match → save)
├── services/
│   ├── ocr/extractor.ts        # Claude Vision OCR extraction
│   ├── accounting/
│   │   ├── index.ts            # Provider factory
│   │   ├── quickbooks.ts       # QuickBooks Online integration
│   │   └── xero.ts             # Xero integration
│   └── channels/
│       ├── whatsapp.ts         # Twilio WhatsApp handler
│       ├── telegram.ts         # Telegram bot handler
│       └── email.ts            # IMAP email listener
└── routes/
    ├── webhooks.ts             # Webhook & API routes
    └── auth.ts                 # OAuth routes for QB/Xero
```

## Supported Document Types

- JPEG, PNG, GIF, WebP images
- PDF files
- Invoices, tax invoices, bills, receipts, till slips, expense reports

## Classification Logic

| Document has...                                    | Classified as | Saved as                    |
| -------------------------------------------------- | ------------- | --------------------------- |
| "Invoice", due date, payment terms, bank details   | Invoice       | Unpaid **Bill**             |
| "Receipt", "Paid", payment method, transaction ref | Receipt       | Paid **Expense**            |
| Ambiguous                                          | Receipt       | Paid **Expense** (default)  |

## License

MIT
