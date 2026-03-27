<overview>
Webhooks allow real-time event notifications when actions occur in a BigCommerce store. Subscribe to events like order creation, product updates, or customer changes. Webhooks use OAuth authentication and JSON payloads.
</overview>

<endpoint>
```
POST/GET/PUT/DELETE https://api.bigcommerce.com/stores/{store_hash}/v3/hooks
```
</endpoint>

<creating_webhooks>

<basic_webhook>
```bash
POST /v3/hooks
X-Auth-Token: {access_token}
Content-Type: application/json

{
  "scope": "store/order/created",
  "destination": "https://your-app.com/webhooks/order-created",
  "is_active": true,
  "headers": {
    "X-Custom-Header": "my-value",
    "Authorization": "Bearer your-secret-token"
  }
}
```
</basic_webhook>

<response>
```json
{
  "data": {
    "id": 12345,
    "client_id": "your-client-id",
    "store_hash": "abc123",
    "scope": "store/order/created",
    "destination": "https://your-app.com/webhooks/order-created",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```
</response>

<custom_headers>
Use custom headers to validate incoming webhooks:
- Authentication tokens
- Shared secrets for signature verification
- App identifiers
</custom_headers>

</creating_webhooks>

<webhook_scopes>

<order_events>
```
store/order/*                    # All order events
store/order/created              # New order placed
store/order/updated              # Order modified
store/order/archived             # Order archived
store/order/statusUpdated        # Status changed
store/order/message/created      # New order message
store/order/refund/created       # Refund processed
```
</order_events>

<product_events>
```
store/product/*                  # All product events
store/product/created            # New product
store/product/updated            # Product modified
store/product/deleted            # Product removed
store/product/inventory/updated  # Stock level changed
store/product/inventory/order/updated  # Inventory from order
```
</product_events>

<customer_events>
```
store/customer/*                 # All customer events
store/customer/created           # New customer account
store/customer/updated           # Customer modified
store/customer/deleted           # Customer removed
store/customer/address/created   # New address added
store/customer/address/updated   # Address modified
store/customer/address/deleted   # Address removed
store/customer/payment/instrument/default/updated  # Default payment changed
```
</customer_events>

<cart_events>
```
store/cart/*                     # All cart events
store/cart/created               # New cart
store/cart/updated               # Cart modified
store/cart/deleted               # Cart removed
store/cart/abandoned             # Cart abandoned
store/cart/converted             # Cart became order
store/cart/lineItem/*            # Line item changes
```
</cart_events>

<category_events>
```
store/category/*                 # All category events
store/category/created
store/category/updated
store/category/deleted
```
</category_events>

<subscriber_events>
```
store/subscriber/*               # All subscriber events
store/subscriber/created
store/subscriber/updated
store/subscriber/deleted
```
</subscriber_events>

<channel_events>
```
store/channel/*                  # All channel events
store/channel/created
store/channel/updated
```
</channel_events>

<sku_events>
```
store/sku/*                      # All SKU events
store/sku/created
store/sku/updated
store/sku/deleted
store/sku/inventory/updated
store/sku/inventory/order/updated
```
</sku_events>

<shipment_events>
```
store/shipment/*                 # All shipment events
store/shipment/created
store/shipment/updated
store/shipment/deleted
```
</shipment_events>

</webhook_scopes>

<payload_structure>

<standard_payload>
```json
{
  "scope": "store/order/created",
  "store_id": "12345",
  "data": {
    "type": "order",
    "id": 67890
  },
  "hash": "abc123def456",
  "created_at": 1705312200,
  "producer": "stores/abc123"
}
```

The payload contains minimal data - just enough to identify what changed. Fetch full details via API.
</standard_payload>

<data_object>
The `data` object varies by event type:

**Order events:**
```json
"data": { "type": "order", "id": 12345 }
```

**Product events:**
```json
"data": { "type": "product", "id": 111 }
```

**Customer events:**
```json
"data": { "type": "customer", "id": 222 }
```

**Inventory events:**
```json
"data": {
  "type": "product",
  "id": 111,
  "inventory": { "product_id": 111, "method": "absolute" }
}
```
</data_object>

</payload_structure>

<channel_webhooks>

<creating_channel_webhook>
Subscribe to events for a specific channel (storefront):

```bash
POST /v3/hooks
{
  "scope": "store/order/created",
  "destination": "https://your-app.com/webhooks/channel-2-orders",
  "channel_id": 2,
  "is_active": true
}
```

Only fires for orders on that specific channel.
</creating_channel_webhook>

</channel_webhooks>

<managing_webhooks>

<list_webhooks>
```bash
GET /v3/hooks
GET /v3/hooks?scope=store/order/*
GET /v3/hooks?is_active=true
```
</list_webhooks>

<get_webhook>
```bash
GET /v3/hooks/{webhook_id}
```
</get_webhook>

<update_webhook>
```bash
PUT /v3/hooks/{webhook_id}
{
  "destination": "https://new-url.com/webhooks",
  "is_active": true
}
```
</update_webhook>

<delete_webhook>
```bash
DELETE /v3/hooks/{webhook_id}
```
</delete_webhook>

</managing_webhooks>

<retry_mechanism>

<failure_handling>
If your endpoint doesn't return HTTP 200:
1. BigCommerce retries with exponential backoff
2. Retries continue for ~48 hours
3. After 48 hours, webhook is deactivated (`is_active: false`)
4. Email notification sent to registered address
</failure_handling>

<reactivating>
```bash
PUT /v3/hooks/{webhook_id}
{
  "is_active": true
}
```
</reactivating>

<inactivity_deactivation>
Webhooks deactivate after **90 days of inactivity**. Reactivate before they expire if needed.
</inactivity_deactivation>

</retry_mechanism>

<best_practices>

<respond_quickly>
Return HTTP 200 immediately, then process asynchronously:

```python
@app.route('/webhooks/order', methods=['POST'])
def handle_order_webhook():
    payload = request.json

    # Queue for async processing
    queue.enqueue(process_order, payload['data']['id'])

    # Return immediately
    return '', 200
```

Slow responses trigger retries and potential deactivation.
</respond_quickly>

<idempotent_processing>
Design handlers to be idempotent - safe to process the same event multiple times:

```python
def process_order(order_id):
    # Check if already processed
    if already_processed(order_id):
        return

    # Process and mark as complete
    do_processing(order_id)
    mark_processed(order_id)
```
</idempotent_processing>

<validate_webhooks>
Verify webhook authenticity using custom headers:

```python
def verify_webhook(request):
    expected_secret = os.environ['WEBHOOK_SECRET']
    received_secret = request.headers.get('X-Webhook-Secret')
    return hmac.compare_digest(expected_secret, received_secret)
```
</validate_webhooks>

<use_ngrok_for_testing>
During development, use ngrok to expose local server:

```bash
ngrok http 3000
# Gives you: https://abc123.ngrok.io
```

Use ngrok URL as webhook destination for testing.
</use_ngrok_for_testing>

</best_practices>

<google_cloud_pubsub>

<overview>
Alternative to HTTP webhooks - publish events to Google Cloud Pub/Sub for reliable, scalable event handling.
</overview>

<benefits>
- Asynchronous, scalable message delivery
- Built-in retry and dead-letter handling
- Decoupled architecture
- Multiple subscribers per topic
</benefits>

<setup>
Requires Google Cloud Platform configuration. See BigCommerce docs for GCP Pub/Sub webhook setup.
</setup>

</google_cloud_pubsub>

<anti_patterns>

<anti_pattern name="synchronous-processing">
**Problem:** Doing heavy processing before returning 200
**Why bad:** Slow response triggers retries, potential deactivation
**Instead:** Queue work, return 200 immediately
</anti_pattern>

<anti_pattern name="not-handling-duplicates">
**Problem:** Assuming each event fires exactly once
**Why bad:** Retries and race conditions cause duplicates
**Instead:** Implement idempotent handlers with deduplication
</anti_pattern>

<anti_pattern name="ignoring-deactivation">
**Problem:** Not monitoring webhook health
**Why bad:** Silent failures, missed events
**Instead:** Monitor webhook status, alert on deactivation
</anti_pattern>

<anti_pattern name="hardcoded-webhook-urls">
**Problem:** Using hardcoded URLs that can't change
**Why bad:** Can't update without code deployment
**Instead:** Use configurable destinations, environment variables
</anti_pattern>

</anti_patterns>
