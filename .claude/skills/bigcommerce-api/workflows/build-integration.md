# Workflow: Build a BigCommerce Integration

<required_reading>
**Read these reference files NOW:**
1. references/authentication.md
2. references/rate-limits-pagination.md
3. references/webhooks.md
4. references/error-handling.md
</required_reading>

<process>

## Step 1: Define Integration Requirements

Ask the user:
- What external system are you connecting? (ERP, CRM, PIM, etc.)
- What data flows are needed? (one-way or bidirectional)
- What entities are involved? (products, orders, customers, inventory)
- Real-time or batch synchronization?
- Single store or multi-store?

## Step 2: Create API Credentials

For single-store integrations:

```
1. Go to BigCommerce Control Panel
2. Settings → Store-level API accounts
3. Create API Account
4. Select required OAuth scopes:
   - Products: read or modify
   - Orders: read or modify
   - Customers: read or modify
   - Content: read or modify (for webhooks)
5. Save credentials securely:
   - Store Hash
   - Access Token
   - Client ID
   - Client Secret
```

Store credentials in environment variables, never in code.

## Step 3: Set Up Project Structure

```
integration-project/
├── src/
│   ├── bigcommerce/
│   │   ├── client.ts       # API client with auth, retry logic
│   │   ├── products.ts     # Product operations
│   │   ├── orders.ts       # Order operations
│   │   ├── customers.ts    # Customer operations
│   │   └── webhooks.ts     # Webhook handlers
│   ├── external/
│   │   └── [system].ts     # External system client
│   ├── sync/
│   │   ├── products.ts     # Product sync logic
│   │   ├── orders.ts       # Order sync logic
│   │   └── inventory.ts    # Inventory sync logic
│   └── index.ts
├── .env.example
├── package.json
└── README.md
```

## Step 4: Implement API Client

```typescript
// src/bigcommerce/client.ts
import axios, { AxiosInstance } from 'axios';

interface BigCommerceConfig {
  storeHash: string;
  accessToken: string;
}

export class BigCommerceClient {
  private client: AxiosInstance;
  private rateLimitRemaining: number = 20000;

  constructor(config: BigCommerceConfig) {
    this.client = axios.create({
      baseURL: `https://api.bigcommerce.com/stores/${config.storeHash}`,
      headers: {
        'X-Auth-Token': config.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Response interceptor for rate limit tracking
    this.client.interceptors.response.use(
      (response) => {
        this.rateLimitRemaining = parseInt(
          response.headers['x-rate-limit-requests-left'] || '20000'
        );
        return response;
      },
      async (error) => {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(
            error.response.headers['x-retry-after'] || '60'
          );
          await this.sleep(retryAfter * 1000);
          return this.client.request(error.config);
        }
        throw error;
      }
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async get<T>(endpoint: string, params?: object): Promise<T> {
    const response = await this.client.get(endpoint, { params });
    return response.data;
  }

  async post<T>(endpoint: string, data: object): Promise<T> {
    const response = await this.client.post(endpoint, data);
    return response.data;
  }

  async put<T>(endpoint: string, data: object): Promise<T> {
    const response = await this.client.put(endpoint, data);
    return response.data;
  }

  async delete(endpoint: string): Promise<void> {
    await this.client.delete(endpoint);
  }

  getRateLimitRemaining(): number {
    return this.rateLimitRemaining;
  }
}
```

## Step 5: Implement Data Operations

Based on required entities, implement operations:

**Products (if needed):**
```typescript
// src/bigcommerce/products.ts
export class ProductsService {
  constructor(private client: BigCommerceClient) {}

  async getAll(options?: { page?: number; limit?: number }) {
    return this.client.get('/v3/catalog/products', {
      page: options?.page || 1,
      limit: options?.limit || 100,
      include: 'variants,images'
    });
  }

  async create(product: CreateProductInput) {
    return this.client.post('/v3/catalog/products', product);
  }

  async update(id: number, product: UpdateProductInput) {
    return this.client.put(`/v3/catalog/products/${id}`, product);
  }

  async batchUpdate(products: UpdateProductInput[]) {
    return this.client.put('/v3/catalog/products', products);
  }
}
```

**Orders (if needed):**
```typescript
// src/bigcommerce/orders.ts
export class OrdersService {
  constructor(private client: BigCommerceClient) {}

  async getAll(options?: { status_id?: number; min_date_created?: string }) {
    return this.client.get('/v2/orders', options);
  }

  async getById(id: number) {
    return this.client.get(`/v2/orders/${id}`);
  }

  async updateStatus(id: number, statusId: number) {
    return this.client.put(`/v2/orders/${id}`, { status_id: statusId });
  }
}
```

## Step 6: Set Up Webhooks (for real-time sync)

```typescript
// src/bigcommerce/webhooks.ts
export class WebhooksService {
  constructor(private client: BigCommerceClient) {}

  async create(scope: string, destination: string, headers?: object) {
    return this.client.post('/v3/hooks', {
      scope,
      destination,
      is_active: true,
      headers
    });
  }

  async list() {
    return this.client.get('/v3/hooks');
  }

  async delete(id: number) {
    return this.client.delete(`/v3/hooks/${id}`);
  }
}

// Webhook handler (Express example)
app.post('/webhooks/:event', async (req, res) => {
  const { scope, data, store_id } = req.body;

  // Respond immediately
  res.status(200).send();

  // Process asynchronously
  switch (scope) {
    case 'store/order/created':
      await syncOrder(data.id);
      break;
    case 'store/product/updated':
      await syncProduct(data.id);
      break;
  }
});
```

## Step 7: Implement Sync Logic

```typescript
// src/sync/products.ts
export async function syncProductsToExternal() {
  const bc = new BigCommerceClient(config);
  const products = new ProductsService(bc);
  const external = new ExternalSystemClient(externalConfig);

  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await products.getAll({ page, limit: 100 });
    const { data, meta } = response;

    for (const product of data) {
      await external.upsertProduct(transformProduct(product));
    }

    hasMore = page < meta.pagination.total_pages;
    page++;

    // Respect rate limits
    if (bc.getRateLimitRemaining() < 1000) {
      await sleep(5000);
    }
  }
}

function transformProduct(bcProduct: any) {
  return {
    externalId: bcProduct.sku,
    name: bcProduct.name,
    price: bcProduct.price,
    inventory: bcProduct.inventory_level,
    // Map other fields as needed
  };
}
```

## Step 8: Add Error Handling and Logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Wrap sync operations
async function syncWithErrorHandling() {
  try {
    await syncProductsToExternal();
    logger.info('Product sync completed');
  } catch (error) {
    logger.error('Product sync failed', {
      error: error.message,
      stack: error.stack
    });
    // Alert/notify as needed
  }
}
```

## Step 9: Test Integration

```bash
# Test API connectivity
curl -X GET \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/catalog/summary' \
  -H 'X-Auth-Token: {access_token}'

# Test webhook endpoint (use ngrok for local testing)
ngrok http 3000
# Register webhook with ngrok URL
```

## Step 10: Deploy and Monitor

- Deploy to production environment
- Set up monitoring for:
  - API error rates
  - Rate limit approaching
  - Webhook delivery failures
  - Sync job completion
- Configure alerts for failures

</process>

<success_criteria>
Integration is complete when:

- [ ] API client handles authentication correctly
- [ ] Rate limits are respected with backoff
- [ ] All required data flows are implemented
- [ ] Error handling covers all failure modes
- [ ] Webhooks (if used) respond quickly and process async
- [ ] Logging captures important events
- [ ] Tests verify key functionality
- [ ] Documentation explains setup and configuration
</success_criteria>

<anti_patterns>
Avoid:
- Hardcoding credentials in source code
- Ignoring rate limit headers
- Synchronous webhook processing
- Missing error handling for specific scenarios
- Polling instead of using webhooks
- Not implementing pagination
</anti_patterns>
