<overview>
Multi-Storefront (MSF) enables merchants to manage multiple storefronts from a single BigCommerce backend. Each storefront can have its own branding, products, pricing, and domain while sharing inventory and order management. Understanding channels and site routing is essential for MSF integrations.
</overview>

<core_concepts>

<channels>
A **channel** represents a place where products are sold:
- Storefronts (Stencil or headless)
- Marketplaces (Amazon, eBay)
- Point of sale systems
- Marketing feeds

Every BigCommerce store has a default channel with ID `1`.
This channel cannot be deleted.
</channels>

<sites>
A **site** links a channel to a domain:
- Maps URL to storefront channel
- Enables proper routing
- Configures SSL and domains
</sites>

<channel_assignments>
Products must be explicitly assigned to channels.
Adding to a category ≠ making available on channel.
</channel_assignments>

</core_concepts>

<availability>
| Plan | MSF Support |
|------|-------------|
| Enterprise | Full MSF features |
| Pro | Limited MSF features |
| Standard | No MSF |
</availability>

<channels_api>

<list_channels>
```bash
GET /v3/channels

Response:
{
  "data": [
    {
      "id": 1,
      "name": "Primary Storefront",
      "type": "storefront",
      "platform": "bigcommerce",
      "status": "active",
      "is_listable_from_ui": true,
      "is_visible": true,
      "date_created": "2024-01-01T00:00:00Z"
    },
    {
      "id": 2,
      "name": "Wholesale Store",
      "type": "storefront",
      "platform": "bigcommerce",
      "status": "active"
    }
  ]
}
```
</list_channels>

<create_channel>
```bash
POST /v3/channels
{
  "name": "EU Storefront",
  "type": "storefront",
  "platform": "bigcommerce",
  "status": "active",
  "is_listable_from_ui": true,
  "is_visible": true
}
```
</create_channel>

<channel_types>
- `storefront` - Web storefront
- `marketplace` - Third-party marketplace
- `marketing` - Marketing/advertising feed
- `pos` - Point of sale
</channel_types>

</channels_api>

<sites_api>

<create_site>
```bash
POST /v3/sites
{
  "url": "https://eu.example.com",
  "channel_id": 2,
  "ssl": {
    "type": "bigcommerce_provided"
  }
}
```
</create_site>

<get_sites>
```bash
GET /v3/sites
GET /v3/sites?channel_id=2
```
</get_sites>

<site_routes>
Configure URL routes for specific content:

```bash
POST /v3/sites/{site_id}/routes
{
  "type": "product",
  "matching": "/products/*",
  "route": "/eu-products/{slug}"
}
```
</site_routes>

</sites_api>

<product_channel_assignments>

<assign_products>
```bash
PUT /v3/catalog/products/channel-assignments
{
  "assignments": [
    {"product_id": 111, "channel_id": 1},
    {"product_id": 111, "channel_id": 2},
    {"product_id": 112, "channel_id": 2}
  ]
}
```

Product 111 appears on both channels.
Product 112 only on channel 2.
</assign_products>

<get_assignments>
```bash
GET /v3/catalog/products/channel-assignments?product_id:in=111,112
GET /v3/catalog/products/channel-assignments?channel_id=2
```
</get_assignments>

<remove_assignment>
```bash
DELETE /v3/catalog/products/channel-assignments?product_id:in=111&channel_id:in=2
```
</remove_assignment>

<category_tree_assignment>
Categories are also channel-specific via category trees:

```bash
# Get category trees for a channel
GET /v3/catalog/trees?channel_id=2

# Assign category tree to channel
POST /v3/catalog/trees
{
  "channel_id": 2,
  "name": "EU Category Tree"
}
```
</category_tree_assignment>

</product_channel_assignments>

<channel_specific_data>

<localized_product_attributes>
Override product attributes per channel locale:

```bash
PUT /v3/catalog/products/{product_id}/channel/{channel_id}
{
  "name": "Produit en Français",
  "description": "Description en français..."
}
```

Channel-specific overrides supersede global attributes.
</localized_product_attributes>

<channel_pricing>
Set different prices per channel:

```bash
PUT /v3/catalog/products/{product_id}/channel/{channel_id}/currency-assignments
{
  "default_price": 49.99,
  "sale_price": 39.99,
  "currency_code": "EUR"
}
```
</channel_pricing>

</channel_specific_data>

<orders_and_carts>

<channel_aware_orders>
Always specify channel_id when creating orders:

```bash
POST /v2/orders
{
  "channel_id": 2,
  "customer_id": 123,
  "billing_address": {...},
  "products": [...]
}
```

Filter orders by channel:
```bash
GET /v2/orders?channel_id=2
```
</channel_aware_orders>

<channel_aware_carts>
Carts must be associated with channels:

```bash
POST /v3/carts
{
  "channel_id": 2,
  "line_items": [...]
}
```

Cart redirect URLs will point to the correct storefront site.
</channel_aware_carts>

<checkout_routing>
If site-channel relationship is properly configured:
- `redirectedCheckoutUrl` → Correct storefront domain
- `embeddedCheckoutUrl` → Embeddable checkout for that channel
</checkout_routing>

</orders_and_carts>

<storefront_tokens>

<channel_specific_tokens>
Create tokens for specific channels:

```bash
POST /v3/storefront/api-token
{
  "channel_id": 2,
  "expires_at": 1893456000,
  "allowed_cors_origins": ["https://eu.example.com"]
}
```

Token is scoped to channel 2 only.
</channel_specific_tokens>

</storefront_tokens>

<webhooks>

<channel_webhooks>
Subscribe to events for specific channels:

```bash
POST /v3/hooks
{
  "scope": "store/order/created",
  "destination": "https://app.example.com/webhooks/eu-orders",
  "channel_id": 2,
  "is_active": true
}
```

Only fires for orders on channel 2.
</channel_webhooks>

<channel_events>
Channel-specific webhook events:

```
store/channel/created
store/channel/updated
```

Subscribe to know when channels change.
</channel_events>

</webhooks>

<app_compatibility>

<msf_aware_apps>
Apps must be "channel-aware" to work with MSF:

1. Handle install/load callbacks properly
2. Work with data from all channels
3. Respect channel_id in operations
4. Store channel context when needed
</msf_aware_apps>

<checking_msf_status>
```bash
# Check if store has MSF enabled
GET /v3/channels

# Multiple active storefront channels = MSF enabled
```
</checking_msf_status>

</app_compatibility>

<integration_patterns>

<pattern name="channel-per-region">
**Use case:** International expansion

- Channel 1: US Store (example.com)
- Channel 2: EU Store (eu.example.com)
- Channel 3: UK Store (uk.example.com)

Each channel has:
- Localized product names
- Regional pricing
- Currency settings
- Shipping zones
</pattern>

<pattern name="channel-per-brand">
**Use case:** Multi-brand retailer

- Channel 1: Brand A
- Channel 2: Brand B
- Channel 3: Brand C

Shared inventory, separate branding and product lines.
</pattern>

<pattern name="wholesale-retail">
**Use case:** B2B and B2C

- Channel 1: Consumer storefront (public)
- Channel 2: Wholesale storefront (restricted)

Different pricing, customer groups, and products per channel.
</pattern>

</integration_patterns>

<anti_patterns>

<anti_pattern name="assuming-single-channel">
**Problem:** Hardcoding channel_id = 1
**Why bad:** Breaks for MSF stores
**Instead:** Accept channel_id as parameter, detect from context
</anti_pattern>

<anti_pattern name="forgetting-product-assignments">
**Problem:** Creating products without channel assignments
**Why bad:** Products invisible on storefronts
**Instead:** Always assign products to appropriate channels
</anti_pattern>

<anti_pattern name="ignoring-channel-in-orders">
**Problem:** Not specifying channel_id when creating orders
**Why bad:** Orders attributed to wrong channel
**Instead:** Always include channel_id in order creation
</anti_pattern>

</anti_patterns>
