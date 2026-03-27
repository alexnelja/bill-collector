<overview>
BigCommerce enforces rate limits to ensure platform reliability. Understanding these limits and implementing proper pagination, batching, and retry strategies is essential for robust integrations.
</overview>

<rate_limits>

<standard_limits>
| API Type | Limit |
|----------|-------|
| REST API (Standard) | 20,000 requests/hour |
| Payments API | 50 requests/4 seconds |
| B2B Edition | 150 requests/minute |
| GraphQL Storefront | Query complexity limits |
</standard_limits>

<b2b_endpoint_limits>
Some B2B Edition endpoints have specific limits:
- Add Company Attachment: 15 requests/minute
- Check endpoint documentation for specific quotas
</b2b_endpoint_limits>

<rate_limit_headers>
Monitor these response headers:

```
X-Rate-Limit-Requests-Left: 19850    # Remaining requests
X-Rate-Limit-Time-Reset-Ms: 3600000  # Time until reset (ms)
X-Retry-After: 300                    # Seconds to wait (when limited)
```
</rate_limit_headers>

<429_response>
When rate limited, you receive HTTP 429:

```json
{
  "status": 429,
  "title": "Too Many Requests",
  "type": "https://developer.bigcommerce.com/docs/start/about/status-codes",
  "detail": "Rate limit exceeded"
}
```
</429_response>

</rate_limits>

<retry_strategy>

<exponential_backoff>
```python
import time
import random

def make_request_with_retry(func, max_retries=10):
    base_delay = 1  # seconds

    for attempt in range(max_retries):
        try:
            response = func()

            if response.status_code == 429:
                # Use Retry-After header if present
                retry_after = response.headers.get('X-Retry-After', None)
                if retry_after:
                    time.sleep(int(retry_after))
                else:
                    # Exponential backoff with jitter
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(min(delay, 300))  # Cap at 5 minutes
                continue

            return response

        except Exception as e:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
            time.sleep(delay)

    raise Exception("Max retries exceeded")
```
</exponential_backoff>

<jitter>
Add random jitter to prevent thundering herd:

```python
# Without jitter: all retries happen at exactly 2s, 4s, 8s...
# With jitter: retries spread out across time window

delay = base_delay * (2 ** attempt)
jitter = random.uniform(0, delay * 0.1)  # 10% jitter
total_delay = delay + jitter
```
</jitter>

</retry_strategy>

<pagination>

<cursor_vs_offset>
**Cursor pagination (recommended):**
- More efficient for large datasets
- Consistent results during iteration
- Lower computational complexity
- Used by GraphQL and some REST endpoints

**Offset pagination:**
- Simpler to implement
- Allows jumping to specific pages
- Less efficient for large datasets
- Data can shift between requests
</cursor_vs_offset>

<rest_pagination>
REST APIs use offset pagination via `page` and `limit`:

```bash
# First page
GET /v3/catalog/products?page=1&limit=100

# Response includes meta object
{
  "data": [...],
  "meta": {
    "pagination": {
      "total": 500,
      "count": 100,
      "per_page": 100,
      "current_page": 1,
      "total_pages": 5,
      "links": {
        "current": "?page=1&limit=100",
        "next": "?page=2&limit=100"
      }
    }
  }
}

# Next page
GET /v3/catalog/products?page=2&limit=100
```

**Max limit:** 250 items per page for most endpoints
</rest_pagination>

<graphql_cursor_pagination>
GraphQL uses cursor-based pagination:

```graphql
query GetProducts($first: Int!, $after: String) {
  site {
    products(first: $first, after: $after) {
      edges {
        node {
          entityId
          name
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

**Pagination loop:**
```javascript
async function getAllProducts() {
  let allProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response = await graphqlRequest({
      query: GET_PRODUCTS,
      variables: { first: 50, after: cursor }
    });

    const { edges, pageInfo } = response.data.site.products;

    allProducts = allProducts.concat(edges.map(e => e.node));
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return allProducts;
}
```
</graphql_cursor_pagination>

</pagination>

<batching>

<product_batching>
Update multiple products in one request (max 10):

```bash
PUT /v3/catalog/products
[
  {"id": 111, "price": 29.99},
  {"id": 112, "price": 39.99},
  {"id": 113, "price": 49.99}
]
```

**Savings:** 10 products = 1 request instead of 10
</product_batching>

<customer_batching>
Create/update multiple customers:

```bash
POST /v3/customers
[
  {"email": "user1@example.com", "first_name": "User", "last_name": "One"},
  {"email": "user2@example.com", "first_name": "User", "last_name": "Two"}
]
```
</customer_batching>

<batching_best_practices>
- Batch similar operations together
- Respect batch size limits
- Handle partial failures (some items may succeed, others fail)
- Log batch results for debugging
</batching_best_practices>

</batching>

<optimizing_requests>

<minimize_calls>
```python
# Bad: Multiple requests
products = []
for id in product_ids:
    product = get_product(id)
    products.append(product)

# Good: Single request with filter
products = get_products(id_in=product_ids)
```
</minimize_calls>

<use_includes>
Fetch related data in one request:

```bash
# Bad: Multiple requests
GET /v3/catalog/products/111
GET /v3/catalog/products/111/variants
GET /v3/catalog/products/111/images

# Good: Single request with includes
GET /v3/catalog/products/111?include=variants,images
```
</use_includes>

<cache_responses>
Cache data that doesn't change frequently:

```python
from functools import lru_cache

@lru_cache(maxsize=100, ttl=3600)  # Cache for 1 hour
def get_categories():
    return bigcommerce_api.get('/v3/catalog/trees/categories')
```
</cache_responses>

<use_webhooks>
Instead of polling for changes, subscribe to webhooks:

```python
# Bad: Polling every minute
while True:
    orders = get_orders(date_modified_min=last_check)
    process_orders(orders)
    time.sleep(60)

# Good: Webhook-driven
@app.route('/webhooks/order-created')
def handle_order_created():
    order_id = request.json['data']['id']
    process_order(order_id)
    return '', 200
```
</use_webhooks>

</optimizing_requests>

<monitoring>

<track_usage>
```python
class APIClient:
    def __init__(self):
        self.requests_made = 0
        self.rate_limit_remaining = None

    def request(self, method, endpoint, **kwargs):
        response = self._make_request(method, endpoint, **kwargs)

        self.requests_made += 1
        self.rate_limit_remaining = int(
            response.headers.get('X-Rate-Limit-Requests-Left', 0)
        )

        if self.rate_limit_remaining < 1000:
            logging.warning(f"Rate limit low: {self.rate_limit_remaining}")

        return response
```
</track_usage>

<alerting>
Set up alerts for:
- Rate limit approaching exhaustion
- High 429 error rate
- Webhook deactivations
- Unusual API usage patterns
</alerting>

</monitoring>

<anti_patterns>

<anti_pattern name="ignoring-rate-limits">
**Problem:** Making requests without checking limits
**Why bad:** 429 errors, failed syncs, poor UX
**Instead:** Monitor headers, implement backoff, optimize requests
</anti_pattern>

<anti_pattern name="fixed-retry-intervals">
**Problem:** Retrying at fixed intervals (e.g., always 5 seconds)
**Why bad:** Causes request bunching, slower recovery
**Instead:** Use exponential backoff with jitter
</anti_pattern>

<anti_pattern name="fetching-all-at-once">
**Problem:** Trying to get all data in one request
**Why bad:** Timeouts, memory issues, missing data
**Instead:** Always implement pagination
</anti_pattern>

<anti_pattern name="individual-updates">
**Problem:** Updating records one at a time
**Why bad:** Wastes API quota, slow performance
**Instead:** Use batch operations where available
</anti_pattern>

</anti_patterns>
