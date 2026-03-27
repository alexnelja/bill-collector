<overview>
BigCommerce provides Orders V2 and Orders V3 REST APIs. V2 handles order CRUD operations, shipments, and shipping addresses. V3 provides transactions and refunds endpoints. Both are actively used in different contexts.
</overview>

<api_split>

<v2_endpoints>
**Orders V2 handles:**
- Creating, reading, updating, deleting orders
- Order shipments management
- Order shipping addresses
- Order products
- Order coupons
- Order status updates

Base: `https://api.bigcommerce.com/stores/{store_hash}/v2/orders`
</v2_endpoints>

<v3_endpoints>
**Orders V3 handles:**
- Order transactions (payment details)
- Order refunds
- Individual item fulfillment tracking

Base: `https://api.bigcommerce.com/stores/{store_hash}/v3/orders`
</v3_endpoints>

</api_split>

<orders_v2>

<get_orders>
```bash
# Get all orders
GET /v2/orders

# Get single order
GET /v2/orders/{order_id}

# Filter orders
GET /v2/orders?status_id=11
GET /v2/orders?min_date_created=2024-01-01
GET /v2/orders?customer_id=123
GET /v2/orders?is_deleted=false
```
</get_orders>

<order_statuses>
```
0  - Incomplete
1  - Pending
2  - Shipped
3  - Partially Shipped
4  - Refunded
5  - Cancelled
6  - Declined
7  - Awaiting Payment
8  - Awaiting Pickup
9  - Awaiting Shipment
10 - Completed
11 - Awaiting Fulfillment
12 - Manual Verification Required
13 - Disputed
14 - Partially Refunded
```
</order_statuses>

<create_order>
```bash
POST /v2/orders
{
  "customer_id": 123,
  "billing_address": {
    "first_name": "John",
    "last_name": "Doe",
    "street_1": "123 Main St",
    "city": "Austin",
    "state": "Texas",
    "zip": "78701",
    "country": "United States",
    "email": "john@example.com"
  },
  "products": [
    {
      "product_id": 456,
      "quantity": 2
    }
  ],
  "status_id": 11
}
```

**Note:** Creating orders via API sets `order_source` to "external".
</create_order>

<update_order>
```bash
PUT /v2/orders/{order_id}
{
  "status_id": 2,
  "staff_notes": "Shipped via FedEx"
}
```

**Important:** Updating status to "Awaiting Fulfillment" (11) after manual edit won't update inventory. Use webhooks for accurate inventory tracking.
</update_order>

</orders_v2>

<shipments>

<create_shipment>
```bash
POST /v2/orders/{order_id}/shipments
{
  "order_address_id": 1,
  "tracking_number": "1Z999AA10123456784",
  "shipping_method": "FedEx Ground",
  "shipping_provider": "fedex",
  "items": [
    {
      "order_product_id": 789,
      "quantity": 2
    }
  ]
}
```
</create_shipment>

<shipping_providers>
Common values: `fedex`, `ups`, `usps`, `dhl`, `auspost`, `royalmail`, `custom`
</shipping_providers>

<multiple_shipments>
Orders can have multiple shipments with different `order_address_id` values for split shipping scenarios.
</multiple_shipments>

<get_shipments>
```bash
GET /v2/orders/{order_id}/shipments
GET /v2/orders/{order_id}/shipments/{shipment_id}
```
</get_shipments>

</shipments>

<transactions_v3>

<get_transactions>
```bash
GET /v3/orders/{order_id}/transactions
```

Returns payment transaction details including:
- Payment method
- Transaction status
- Amount
- Gateway-specific data (varies by provider)
- AVS/CVV results (if available)
</get_transactions>

<transaction_response>
```json
{
  "data": [
    {
      "id": 1,
      "order_id": "123",
      "event": "purchase",
      "method": "credit_card",
      "amount": 99.99,
      "currency": "USD",
      "gateway": "stripe",
      "gateway_transaction_id": "ch_xxx",
      "status": "ok",
      "test": false,
      "fraud_review": false,
      "avs_result": {
        "code": "Y",
        "message": "Address and Zip match"
      },
      "cvv_result": {
        "code": "M",
        "message": "Match"
      }
    }
  ]
}
```
</transaction_response>

</transactions_v3>

<refunds_v3>

<create_refund>
```bash
POST /v3/orders/{order_id}/payment_actions/refunds
{
  "items": [
    {
      "item_type": "PRODUCT",
      "item_id": 789,
      "quantity": 1,
      "reason": "Customer request"
    }
  ],
  "payments": [
    {
      "provider_id": "stripe",
      "amount": 29.99,
      "offline": false
    }
  ]
}
```
</create_refund>

<refund_item_types>
- `PRODUCT` - Refund a product
- `SHIPPING` - Refund shipping cost
- `HANDLING` - Refund handling fee
- `ORDER` - Refund entire order
</refund_item_types>

<get_refunds>
```bash
GET /v3/orders/{order_id}/payment_actions/refunds
```
</get_refunds>

</refunds_v3>

<fulfillment_methods>

<shipping_vs_pickup>
An order can have either shipping OR pickup fulfillment, not both.
- **Shipping:** Use `shipping_addresses` and `products`
- **Pickup:** Single pickup consignment per order
</shipping_vs_pickup>

</fulfillment_methods>

<order_products>

<get_order_products>
```bash
GET /v2/orders/{order_id}/products
GET /v2/orders/{order_id}/products/{product_id}
```
</get_order_products>

<order_product_fields>
- `id` - Order product ID (not catalog product ID)
- `product_id` - Catalog product ID
- `variant_id` - Variant ID if applicable
- `quantity` - Quantity ordered
- `price_inc_tax` / `price_ex_tax` - Prices
- `total_inc_tax` / `total_ex_tax` - Line totals
- `applied_discounts` - Discounts applied
</order_product_fields>

</order_products>

<channel_integration>

<channel_aware_orders>
For MSF stores, orders are associated with channels:

```bash
GET /v2/orders?channel_id=2
```

Include `channel_id` when creating orders to associate with specific storefronts:

```bash
POST /v2/orders
{
  "channel_id": 2,
  ...
}
```

This ensures order attribution and proper storefront configuration.
</channel_aware_orders>

</channel_integration>

<webhooks>

<order_events>
Subscribe to order events for real-time updates:
- `store/order/created`
- `store/order/updated`
- `store/order/archived`
- `store/order/statusUpdated`
- `store/order/message/created`
- `store/shipment/created`
- `store/shipment/updated`
- `store/shipment/deleted`
</order_events>

</webhooks>

<anti_patterns>

<anti_pattern name="polling-for-order-updates">
**Problem:** Constantly polling orders endpoint for changes
**Why bad:** Wastes API quota, slow to detect changes
**Instead:** Use webhooks to get real-time order notifications
</anti_pattern>

<anti_pattern name="using-wrong-api-version">
**Problem:** Using V2 for transactions or V3 for order CRUD
**Why bad:** Endpoints don't exist, confusing errors
**Instead:** V2 for order CRUD/shipments, V3 for transactions/refunds
</anti_pattern>

<anti_pattern name="ignoring-channel-id">
**Problem:** Not specifying channel_id in MSF environments
**Why bad:** Orders default to channel 1, wrong storefront association
**Instead:** Always include channel_id for MSF stores
</anti_pattern>

</anti_patterns>
