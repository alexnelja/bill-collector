# Workflow: Work with Specific BigCommerce API

<required_reading>
Read the relevant reference file based on the API:
- Catalog → references/catalog-api.md
- Orders → references/orders-api.md
- Customers → references/customers-api.md
- Payments → references/payments-api.md
- GraphQL → references/graphql-storefront.md
- Webhooks → references/webhooks.md
- Widgets/Scripts → references/widgets-scripts.md
</required_reading>

<process>

## Step 1: Identify the API

Ask the user which API they need help with:
- **Catalog API** - Products, categories, brands, variants
- **Orders API** - Orders, shipments, transactions, refunds
- **Customers API** - Customers, addresses, groups
- **Payments API** - Payment processing, checkout
- **GraphQL Storefront** - Storefront queries, carts
- **Webhooks** - Event subscriptions
- **Content APIs** - Widgets, scripts, pages

## Step 2: Understand the Task

Ask what operation they need:
- **Read** - GET data (list, filter, single item)
- **Create** - POST new resource
- **Update** - PUT existing resource
- **Delete** - DELETE resource
- **Batch** - Multiple operations

## Step 3: Provide Endpoint Reference

Based on API and operation, provide the correct endpoint:

### Catalog Endpoints
```
Products:
  GET    /v3/catalog/products              # List products
  GET    /v3/catalog/products/{id}         # Get product
  POST   /v3/catalog/products              # Create product
  PUT    /v3/catalog/products/{id}         # Update product
  PUT    /v3/catalog/products              # Batch update (array)
  DELETE /v3/catalog/products/{id}         # Delete product

Variants:
  GET    /v3/catalog/products/{id}/variants
  POST   /v3/catalog/products/{id}/variants
  PUT    /v3/catalog/products/{id}/variants/{vid}

Categories (use trees):
  GET    /v3/catalog/trees/categories
  POST   /v3/catalog/trees/categories
  PUT    /v3/catalog/trees/categories

Brands:
  GET    /v3/catalog/brands
  POST   /v3/catalog/brands
  PUT    /v3/catalog/brands/{id}
```

### Orders Endpoints
```
Orders (V2):
  GET    /v2/orders                        # List orders
  GET    /v2/orders/{id}                   # Get order
  POST   /v2/orders                        # Create order
  PUT    /v2/orders/{id}                   # Update order
  DELETE /v2/orders/{id}                   # Delete order

Shipments:
  GET    /v2/orders/{id}/shipments
  POST   /v2/orders/{id}/shipments
  PUT    /v2/orders/{id}/shipments/{sid}

Transactions (V3):
  GET    /v3/orders/{id}/transactions

Refunds (V3):
  GET    /v3/orders/{id}/payment_actions/refunds
  POST   /v3/orders/{id}/payment_actions/refunds
```

### Customers Endpoints
```
Customers (V3):
  GET    /v3/customers                     # List customers
  POST   /v3/customers                     # Create (array)
  PUT    /v3/customers                     # Update (array)
  DELETE /v3/customers?id:in=1,2,3        # Delete

Addresses:
  GET    /v3/customers/addresses
  POST   /v3/customers/addresses
  PUT    /v3/customers/addresses

Customer Groups (V2):
  GET    /v2/customer_groups
  POST   /v2/customer_groups
  PUT    /v2/customer_groups/{id}
```

### Webhooks Endpoints
```
  GET    /v3/hooks                         # List webhooks
  POST   /v3/hooks                         # Create webhook
  PUT    /v3/hooks/{id}                    # Update webhook
  DELETE /v3/hooks/{id}                    # Delete webhook
```

## Step 4: Construct the Request

Help build the correct request:

### Headers (required for all requests)
```
X-Auth-Token: {access_token}
Content-Type: application/json
Accept: application/json
```

### Common Filters
```
# Catalog
?sku=PROD001
?brand_id=12
?categories:in=23,45
?include=variants,images,custom_fields

# Orders
?status_id=11
?customer_id=123
?min_date_created=2024-01-01

# Customers
?email:in=user@example.com
?customer_group_id:in=5,6
?date_created:min=2024-01-01
```

### Pagination
```
?page=1&limit=100    # REST pagination
# Max limit: 250 for most endpoints
```

## Step 5: Provide Example Code

Based on the operation, provide working code:

### cURL Example
```bash
curl -X GET \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/catalog/products?limit=50' \
  -H 'X-Auth-Token: {access_token}' \
  -H 'Accept: application/json'
```

### JavaScript/Node.js Example
```javascript
const response = await fetch(
  `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/products`,
  {
    method: 'GET',
    headers: {
      'X-Auth-Token': accessToken,
      'Accept': 'application/json'
    }
  }
);
const data = await response.json();
```

### Python Example
```python
import requests

response = requests.get(
    f'https://api.bigcommerce.com/stores/{store_hash}/v3/catalog/products',
    headers={
        'X-Auth-Token': access_token,
        'Accept': 'application/json'
    }
)
data = response.json()
```

## Step 6: Handle Response

Explain expected response structure:

### Success Response (V3)
```json
{
  "data": [...],       // Array or object
  "meta": {
    "pagination": {
      "total": 100,
      "count": 50,
      "per_page": 50,
      "current_page": 1,
      "total_pages": 2
    }
  }
}
```

### Error Response
```json
{
  "status": 422,
  "title": "Unprocessable Entity",
  "errors": {
    "field": "error message"
  }
}
```

## Step 7: Address Common Issues

Based on the API, warn about common pitfalls:

### Catalog API
- Products need `weight` for physical type
- Use category trees, not deprecated categories endpoint
- Batch updates limited to 10 items
- MSF: Products need channel assignments

### Orders API
- V2 for CRUD, V3 for transactions/refunds
- Include channel_id for MSF stores
- Status changes don't always update inventory

### Customers API
- V3 accepts arrays for create/update
- Customer Groups still V2 only
- Addresses limited to 10 per customer in response

### Webhooks
- Respond 200 immediately, process async
- 48-hour retry window before deactivation
- 90-day inactivity deactivation

</process>

<success_criteria>
API task complete when:

- [ ] Correct endpoint identified
- [ ] Request properly formatted
- [ ] Response successfully received
- [ ] Error handling in place
- [ ] Pagination implemented if needed
</success_criteria>
