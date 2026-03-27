# Workflow: Set Up BigCommerce Webhooks

<required_reading>
**Read these reference files NOW:**
1. references/webhooks.md
2. references/authentication.md
3. references/error-handling.md
</required_reading>

<process>

## Step 1: Identify Required Events

Ask the user:
- What events do you need to react to?
- What actions should trigger on each event?
- Single store or multi-storefront?

### Common Use Cases

| Use Case | Webhook Scopes |
|----------|---------------|
| Order sync to ERP | `store/order/created`, `store/order/statusUpdated` |
| Inventory sync | `store/product/inventory/updated` |
| Customer sync to CRM | `store/customer/created`, `store/customer/updated` |
| Shipping notifications | `store/shipment/created` |
| Abandoned cart recovery | `store/cart/abandoned` |
| Product feed updates | `store/product/created`, `store/product/updated` |

## Step 2: Set Up Webhook Endpoint

### Create the Handler

```typescript
// Example: Express.js webhook handler
import express from 'express';

const app = express();
app.use(express.json());

// Webhook endpoint
app.post('/webhooks/:event', async (req, res) => {
  const { scope, store_id, data, hash, created_at } = req.body;
  const event = req.params.event;

  // Validate webhook (optional but recommended)
  if (!validateWebhook(req)) {
    return res.status(401).send('Unauthorized');
  }

  // Respond immediately - critical for reliability
  res.status(200).send();

  // Process asynchronously
  try {
    await processWebhook(scope, data);
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Log for retry/monitoring
  }
});

function validateWebhook(req: express.Request): boolean {
  const secret = req.headers['x-webhook-secret'];
  return secret === process.env.WEBHOOK_SECRET;
}

async function processWebhook(scope: string, data: any) {
  switch (scope) {
    case 'store/order/created':
      await handleOrderCreated(data.id);
      break;
    case 'store/order/statusUpdated':
      await handleOrderStatusUpdated(data.id);
      break;
    case 'store/product/updated':
      await handleProductUpdated(data.id);
      break;
    // Add more handlers
  }
}
```

### Async Processing Pattern

```typescript
// Use a queue for reliable processing
import Bull from 'bull';

const webhookQueue = new Bull('webhooks', process.env.REDIS_URL);

// Handler - just queue the event
app.post('/webhooks/:event', async (req, res) => {
  const { scope, data } = req.body;

  // Respond immediately
  res.status(200).send();

  // Add to queue
  await webhookQueue.add({
    scope,
    data,
    receivedAt: new Date().toISOString()
  });
});

// Process queue
webhookQueue.process(async (job) => {
  const { scope, data } = job.data;
  await processWebhook(scope, data);
});
```

## Step 3: Deploy Endpoint

### Local Development with ngrok

```bash
# Start your server
npm run dev  # Running on port 3000

# In another terminal, start ngrok
ngrok http 3000

# Use the ngrok URL for webhook destination
# Example: https://abc123.ngrok.io/webhooks/order-created
```

### Production Deployment

Deploy your webhook handler to a reliable host:
- Vercel Serverless Functions
- AWS Lambda
- Google Cloud Functions
- Dedicated server

Ensure:
- HTTPS enabled
- High availability
- Low latency response

## Step 4: Register Webhooks

### Create Webhook via API

```bash
curl -X POST \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/hooks' \
  -H 'X-Auth-Token: {access_token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "scope": "store/order/created",
    "destination": "https://your-app.com/webhooks/order-created",
    "is_active": true,
    "headers": {
      "X-Webhook-Secret": "your-secret-key"
    }
  }'
```

### Register Multiple Webhooks

```typescript
// scripts/register-webhooks.ts
const webhooks = [
  { scope: 'store/order/created', path: '/webhooks/order-created' },
  { scope: 'store/order/statusUpdated', path: '/webhooks/order-updated' },
  { scope: 'store/product/updated', path: '/webhooks/product-updated' },
  { scope: 'store/customer/created', path: '/webhooks/customer-created' }
];

async function registerWebhooks() {
  const baseUrl = process.env.WEBHOOK_BASE_URL;
  const secret = process.env.WEBHOOK_SECRET;

  for (const webhook of webhooks) {
    try {
      const response = await fetch(
        `https://api.bigcommerce.com/stores/${storeHash}/v3/hooks`,
        {
          method: 'POST',
          headers: {
            'X-Auth-Token': accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            scope: webhook.scope,
            destination: `${baseUrl}${webhook.path}`,
            is_active: true,
            headers: {
              'X-Webhook-Secret': secret
            }
          })
        }
      );

      const data = await response.json();
      console.log(`Registered: ${webhook.scope}`, data.data.id);
    } catch (error) {
      console.error(`Failed: ${webhook.scope}`, error);
    }
  }
}

registerWebhooks();
```

### Channel-Specific Webhooks (MSF)

```bash
curl -X POST \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/hooks' \
  -H 'X-Auth-Token: {access_token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "scope": "store/order/created",
    "destination": "https://your-app.com/webhooks/eu-orders",
    "channel_id": 2,
    "is_active": true
  }'
```

## Step 5: Implement Handlers

### Order Created Handler

```typescript
async function handleOrderCreated(orderId: number) {
  // Fetch full order details
  const order = await bigcommerceClient.get(`/v2/orders/${orderId}`);

  // Sync to external system
  await externalSystem.createOrder({
    externalId: order.id,
    customerEmail: order.billing_address.email,
    total: order.total_inc_tax,
    items: order.products.map(p => ({
      sku: p.sku,
      quantity: p.quantity,
      price: p.price_inc_tax
    }))
  });

  console.log(`Order ${orderId} synced to external system`);
}
```

### Product Updated Handler

```typescript
async function handleProductUpdated(productId: number) {
  // Check if already processing (deduplication)
  const lockKey = `product-update-${productId}`;
  if (await isLocked(lockKey)) {
    return;
  }
  await acquireLock(lockKey, 60); // 60 second lock

  try {
    // Fetch current product data
    const product = await bigcommerceClient.get(
      `/v3/catalog/products/${productId}?include=variants,images`
    );

    // Update external catalog
    await externalCatalog.upsertProduct({
      id: product.data.id,
      sku: product.data.sku,
      name: product.data.name,
      price: product.data.price,
      inventory: product.data.inventory_level
    });
  } finally {
    await releaseLock(lockKey);
  }
}
```

### Idempotent Processing

```typescript
async function handleWebhookIdempotent(scope: string, data: any, hash: string) {
  // Check if already processed
  const processed = await db.webhookLog.findUnique({
    where: { hash }
  });

  if (processed) {
    console.log(`Webhook ${hash} already processed`);
    return;
  }

  // Process
  await processWebhook(scope, data);

  // Mark as processed
  await db.webhookLog.create({
    data: {
      hash,
      scope,
      dataId: data.id,
      processedAt: new Date()
    }
  });
}
```

## Step 6: Monitor and Maintain

### List Active Webhooks

```bash
curl -X GET \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/hooks' \
  -H 'X-Auth-Token: {access_token}'
```

### Check Webhook Status

```typescript
async function checkWebhookHealth() {
  const response = await bigcommerceClient.get('/v3/hooks');
  const webhooks = response.data;

  for (const webhook of webhooks) {
    if (!webhook.is_active) {
      console.warn(`Webhook ${webhook.id} (${webhook.scope}) is INACTIVE`);
      // Alert or auto-reactivate
    }
  }
}

// Run periodically
setInterval(checkWebhookHealth, 3600000); // Every hour
```

### Reactivate Deactivated Webhook

```bash
curl -X PUT \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/hooks/{webhook_id}' \
  -H 'X-Auth-Token: {access_token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "is_active": true
  }'
```

### Logging

```typescript
function logWebhook(req: express.Request, status: string) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    scope: req.body.scope,
    dataId: req.body.data?.id,
    storeId: req.body.store_id,
    status,
    processingTime: Date.now() - req.startTime
  }));
}
```

## Step 7: Test Webhooks

### Trigger Test Events

```bash
# Create a test product to trigger product/created
curl -X POST \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/catalog/products' \
  -H 'X-Auth-Token: {access_token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test Product",
    "type": "physical",
    "weight": 1,
    "price": 9.99
  }'

# Update it to trigger product/updated
# Delete it to trigger product/deleted
```

### Verify Receipt

Check ngrok web interface (http://localhost:4040) or your logging to confirm:
- Webhook received
- Payload correct
- Handler executed
- Response sent quickly

</process>

<success_criteria>
Webhooks properly configured when:

- [ ] All required events have registered webhooks
- [ ] Endpoints respond < 200ms
- [ ] Processing is asynchronous
- [ ] Idempotent handling prevents duplicates
- [ ] Secret validation in place
- [ ] Monitoring alerts on deactivation
- [ ] Error logging captures failures
- [ ] Retry logic handles transient failures
</success_criteria>

<anti_patterns>
Avoid:
- Synchronous processing before 200 response
- No deduplication of events
- Ignoring deactivated webhooks
- Missing secret validation
- No logging or monitoring
- Processing without fetching fresh data
</anti_patterns>
