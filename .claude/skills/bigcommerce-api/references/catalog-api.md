<overview>
The Catalog API manages products, categories, brands, variants, and related entities. V3 is the current standard, offering better pagination, metafields support, and batch operations. V2 is deprecated but still supported for legacy integrations.
</overview>

<api_versions>

<v3_advantages>
- Cursor pagination via `meta` object
- Metafields on products, variants, brands, categories
- Batch operations (up to 10 products per request)
- Better performance optimization
- Channel assignments for MSF

**Always use V3 for new integrations.**
</v3_advantages>

<v2_legacy>
Still available but deprecated. Avoid for new work.
Migration guide: https://developer.bigcommerce.com/docs/store-operations/catalog/migration
</v2_legacy>

</api_versions>

<products>

<base_endpoint>
```
GET/POST/PUT/DELETE https://api.bigcommerce.com/stores/{store_hash}/v3/catalog/products
```
</base_endpoint>

<create_product>
```bash
POST /v3/catalog/products
Content-Type: application/json

{
  "name": "Product Name",
  "type": "physical",
  "sku": "PROD-001",
  "price": 29.99,
  "weight": 1.5,
  "categories": [23, 45],
  "brand_id": 12,
  "inventory_level": 100,
  "inventory_tracking": "product",
  "is_visible": true
}
```

**Required fields:** `name`, `type`, `weight` (for physical), `price`
</create_product>

<product_types>
- `physical` - Tangible goods requiring shipping
- `digital` - Downloadable products
</product_types>

<batch_operations>
Update up to 10 products per request:

```bash
PUT /v3/catalog/products
Content-Type: application/json

[
  {"id": 111, "price": 24.99},
  {"id": 112, "price": 34.99},
  {"id": 113, "inventory_level": 50}
]
```
</batch_operations>

<filtering_products>
```
GET /v3/catalog/products?sku=PROD-001
GET /v3/catalog/products?brand_id=12
GET /v3/catalog/products?categories:in=23,45
GET /v3/catalog/products?is_visible=true
GET /v3/catalog/products?price:min=10&price:max=50
GET /v3/catalog/products?date_modified:min=2024-01-01
```
</filtering_products>

<include_subresources>
```
GET /v3/catalog/products?include=variants,images,custom_fields,bulk_pricing_rules,options,modifiers
```
</include_subresources>

</products>

<variants>

<concept>
A variant is a purchasable version of a product with its own SKU. Every purchasable entity is a variant in V3, including the base product itself (base variant).

Example: A T-shirt product has variants for each size/color combination.
</concept>

<create_product_with_variants>
```bash
POST /v3/catalog/products
Content-Type: application/json

{
  "name": "T-Shirt",
  "type": "physical",
  "weight": 0.5,
  "price": 25.00,
  "variants": [
    {
      "sku": "TSHIRT-S-RED",
      "price": 25.00,
      "option_values": [
        {"option_display_name": "Size", "label": "Small"},
        {"option_display_name": "Color", "label": "Red"}
      ]
    },
    {
      "sku": "TSHIRT-M-RED",
      "price": 25.00,
      "option_values": [
        {"option_display_name": "Size", "label": "Medium"},
        {"option_display_name": "Color", "label": "Red"}
      ]
    }
  ]
}
```
</create_product_with_variants>

<variant_endpoints>
```
GET /v3/catalog/products/{product_id}/variants
GET /v3/catalog/products/{product_id}/variants/{variant_id}
PUT /v3/catalog/products/{product_id}/variants/{variant_id}
```
</variant_endpoints>

</variants>

<categories>

<deprecation_notice>
V3 `/catalog/categories` endpoints are deprecated. Use **Category Trees** endpoints for both single-storefront and MSF stores:

```
GET /v3/catalog/trees/categories
POST /v3/catalog/trees/categories
PUT /v3/catalog/trees/categories
DELETE /v3/catalog/trees/categories
```
</deprecation_notice>

<category_tree_operations>
```bash
# Get all categories
GET /v3/catalog/trees/categories

# Create category
POST /v3/catalog/trees/categories
{
  "parent_id": 0,
  "tree_id": 1,
  "name": "New Category",
  "is_visible": true
}

# Update category
PUT /v3/catalog/trees/categories
[
  {"id": 23, "name": "Updated Name"}
]
```
</category_tree_operations>

</categories>

<brands>

<endpoints>
```
GET /v3/catalog/brands
POST /v3/catalog/brands
PUT /v3/catalog/brands/{brand_id}
DELETE /v3/catalog/brands/{brand_id}
```
</endpoints>

<create_brand>
```bash
POST /v3/catalog/brands
{
  "name": "Acme Corp",
  "page_title": "Acme Products",
  "meta_keywords": ["acme", "quality"],
  "meta_description": "Premium Acme products",
  "image_url": "https://example.com/acme-logo.png"
}
```
</create_brand>

<assign_brand_to_product>
Use `brand_id` or `brand_name` when creating/updating products:
```bash
PUT /v3/catalog/products/{product_id}
{
  "brand_id": 12
}
```
If `brand_name` doesn't exist, BigCommerce creates it automatically.
</assign_brand_to_product>

</brands>

<channel_assignments>

<msf_requirement>
For multi-storefront stores, products must be explicitly assigned to channels to be visible/purchasable on that storefront.
</msf_requirement>

<assign_products_to_channel>
```bash
PUT /v3/catalog/products/channel-assignments
{
  "assignments": [
    {"product_id": 111, "channel_id": 1},
    {"product_id": 111, "channel_id": 2},
    {"product_id": 112, "channel_id": 1}
  ]
}
```
</assign_products_to_channel>

<get_channel_assignments>
```
GET /v3/catalog/products/channel-assignments?product_id:in=111,112
GET /v3/catalog/products/channel-assignments?channel_id=2
```
</get_channel_assignments>

</channel_assignments>

<metafields>

<purpose>
Store custom data on products, variants, categories, brands. Useful for app-specific data, custom attributes, or integration metadata.
</purpose>

<create_metafield>
```bash
POST /v3/catalog/products/{product_id}/metafields
{
  "permission_set": "app_only",
  "namespace": "my_app",
  "key": "custom_attribute",
  "value": "custom_value"
}
```

**permission_set options:**
- `app_only` - Only your app can read/write
- `read` - Other apps can read
- `write` - Other apps can read/write
- `read_and_sf_access` - Readable in storefront context
</create_metafield>

</metafields>

<pagination>

<cursor_pagination>
V3 responses include a `meta` object with pagination info:

```json
{
  "data": [...],
  "meta": {
    "pagination": {
      "total": 250,
      "count": 50,
      "per_page": 50,
      "current_page": 1,
      "total_pages": 5,
      "links": {
        "next": "?page=2&limit=50",
        "current": "?page=1&limit=50"
      }
    }
  }
}
```
</cursor_pagination>

<pagination_params>
```
GET /v3/catalog/products?page=2&limit=100
```
Max limit: 250 per page
</pagination_params>

</pagination>

<anti_patterns>

<anti_pattern name="fetching-all-products-without-pagination">
**Problem:** Single request to get all products
**Why bad:** Timeouts, memory issues, rate limiting
**Instead:** Paginate with reasonable page sizes (50-100)
</anti_pattern>

<anti_pattern name="updating-products-one-by-one">
**Problem:** Individual PUT requests for each product
**Why bad:** Slow, hits rate limits quickly
**Instead:** Use batch updates (up to 10 per request)
</anti_pattern>

<anti_pattern name="ignoring-channel-assignments">
**Problem:** Creating products without channel assignments in MSF stores
**Why bad:** Products won't appear on any storefront
**Instead:** Always assign products to appropriate channels
</anti_pattern>

</anti_patterns>
