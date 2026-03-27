<overview>
The GraphQL Storefront API enables querying storefront data for headless commerce, Stencil themes, and custom shopping experiences. It provides read-only access to catalog data, carts, checkout, and customer information. For mutations and admin operations, use REST APIs.
</overview>

<endpoint>
```
POST https://{store_domain}/graphql
Authorization: Bearer {storefront_token}
Content-Type: application/json
```

Replace `{store_domain}` with your storefront URL (e.g., `store.mybigcommerce.com` or custom domain).
</endpoint>

<authentication>

<token_types>
**Storefront Token:**
- Anonymous shopper queries
- Public catalog data
- Create via REST API

**Customer Impersonation Token:**
- Customer-specific data (wishlists, account info)
- Server-to-server requests
- More secure, limited exposure
</token_types>

<creating_tokens>
```bash
# Storefront Token
POST /v3/storefront/api-token
{
  "channel_id": 1,
  "expires_at": 1893456000,
  "allowed_cors_origins": ["https://your-site.com"]
}

# Customer Impersonation Token
POST /v3/storefront/api-token-customer-impersonation
{
  "channel_id": 1,
  "expires_at": 1893456000
}
```
</creating_tokens>

<best_practices>
- Rotate tokens regularly
- Use short expiration for client-side tokens
- Customer impersonation tokens for server-side only
- Respect Principle of Least Privilege
</best_practices>

</authentication>

<common_queries>

<get_products>
```graphql
query GetProducts($first: Int!) {
  site {
    products(first: $first) {
      edges {
        node {
          entityId
          name
          sku
          path
          prices {
            price {
              value
              currencyCode
            }
            salePrice {
              value
            }
          }
          defaultImage {
            url(width: 500)
          }
          variants {
            edges {
              node {
                entityId
                sku
                inventory {
                  isInStock
                  aggregated {
                    availableToSell
                  }
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```
</get_products>

<get_category>
```graphql
query GetCategory($path: String!) {
  site {
    route(path: $path) {
      node {
        ... on Category {
          entityId
          name
          description
          products {
            edges {
              node {
                entityId
                name
                prices {
                  price {
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```
</get_category>

<search_products>
```graphql
query SearchProducts($searchTerm: String!) {
  site {
    search {
      searchProducts(filters: {searchTerm: $searchTerm}) {
        products {
          edges {
            node {
              entityId
              name
              path
            }
          }
        }
      }
    }
  }
}
```
</search_products>

<get_customer>
Requires customer impersonation token or logged-in customer context:

```graphql
query GetCustomer {
  customer {
    entityId
    email
    firstName
    lastName
    company
    customerGroupId
    addresses {
      edges {
        node {
          entityId
          firstName
          lastName
          address1
          city
          stateOrProvince
          postalCode
          countryCode
        }
      }
    }
  }
}
```
</get_customer>

</common_queries>

<cart_operations>

<create_cart>
```graphql
mutation CreateCart($input: CreateCartInput!) {
  cart {
    createCart(input: $input) {
      cart {
        entityId
        lineItems {
          physicalItems {
            entityId
            productEntityId
            variantEntityId
            name
            quantity
            extendedSalePrice {
              value
            }
          }
        }
      }
    }
  }
}
```

Variables:
```json
{
  "input": {
    "lineItems": [
      {
        "productEntityId": 123,
        "variantEntityId": 456,
        "quantity": 2
      }
    ]
  }
}
```
</create_cart>

<add_to_cart>
```graphql
mutation AddToCart($input: AddCartLineItemsInput!) {
  cart {
    addCartLineItems(input: $input) {
      cart {
        entityId
        lineItems {
          physicalItems {
            entityId
            name
            quantity
          }
        }
      }
    }
  }
}
```
</add_to_cart>

<get_cart>
```graphql
query GetCart($entityId: String!) {
  site {
    cart(entityId: $entityId) {
      entityId
      currencyCode
      isTaxIncluded
      baseAmount {
        value
      }
      discountedAmount {
        value
      }
      amount {
        value
      }
      lineItems {
        physicalItems {
          entityId
          name
          quantity
          extendedSalePrice {
            value
          }
        }
        digitalItems {
          entityId
          name
          quantity
        }
      }
    }
  }
}
```
</get_cart>

</cart_operations>

<checkout>

<get_checkout>
```graphql
query GetCheckout($entityId: String!) {
  site {
    checkout(entityId: $entityId) {
      entityId
      subtotal {
        value
      }
      grandTotal {
        value
      }
      shippingCostTotal {
        value
      }
      taxTotal {
        value
      }
      billingAddress {
        firstName
        lastName
        email
      }
      shippingConsignments {
        address {
          firstName
          lastName
          city
        }
        selectedShippingOption {
          entityId
          description
          cost {
            value
          }
        }
      }
    }
  }
}
```
</get_checkout>

<redirect_to_checkout>
Use `redirectUrls` to get checkout URL:

```graphql
query GetCheckoutUrl($cartEntityId: String!) {
  site {
    cart(entityId: $cartEntityId) {
      entityId
      redirectUrls {
        redirectedCheckoutUrl
        embeddedCheckoutUrl
      }
    }
  }
}
```
</redirect_to_checkout>

</checkout>

<pagination>

<cursor_pagination>
GraphQL uses cursor-based pagination:

```graphql
query GetProductsPage($first: Int!, $after: String) {
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
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
}
```

**Pagination workflow:**
1. Initial request with `first: 50`
2. Check `pageInfo.hasNextPage`
3. If true, request again with `after: endCursor`
4. Repeat until `hasNextPage` is false
</cursor_pagination>

<why_cursor_over_offset>
- More efficient for large datasets
- Consistent results even when data changes
- Lower computational complexity
- Recommended by BigCommerce
</why_cursor_over_offset>

</pagination>

<image_handling>

<dynamic_sizing>
Request images at specific dimensions:

```graphql
query GetProductImage($productId: Int!) {
  site {
    product(entityId: $productId) {
      defaultImage {
        url(width: 800, height: 800)
        urlOriginal
        altText
      }
      images {
        edges {
          node {
            url(width: 400)
            altText
            isDefault
          }
        }
      }
    }
  }
}
```

Images are resized on-the-fly by BigCommerce CDN.
</dynamic_sizing>

</image_handling>

<site_content>

<web_pages>
```graphql
query GetWebPage($path: String!) {
  site {
    content {
      page(path: $path) {
        ... on NormalPage {
          name
          htmlBody
          path
        }
        ... on ContactPage {
          name
          contactFields
        }
      }
    }
  }
}
```
</web_pages>

<banners>
```graphql
query GetBanners {
  site {
    content {
      banners {
        homePage {
          edges {
            node {
              entityId
              name
              content
              location
            }
          }
        }
      }
    }
  }
}
```
</banners>

</site_content>

<best_practices>

<request_only_needed_fields>
GraphQL advantage: request exactly what you need. Don't over-fetch.

**Bad:**
```graphql
query { site { products { edges { node { ... everything } } } } }
```

**Good:**
```graphql
query { site { products { edges { node { entityId name prices { price { value } } } } } } }
```
</request_only_needed_fields>

<cache_responses>
- Share cached data across users for public data
- Use appropriate cache TTLs
- Invalidate cache on data changes
</cache_responses>

<use_correlation_id>
For headless storefronts, group related requests:

```
X-Correlation-Id: checkout-flow-abc123
```
</use_correlation_id>

<proxy_client_ip>
When using a proxy, forward the client IP for accurate rate limiting and fraud detection:

```
X-Forwarded-For: 192.0.2.1
```
</proxy_client_ip>

</best_practices>

<limitations>

<read_only>
GraphQL Storefront API is **read-only** for products. To create/update/delete products, use REST Catalog API.
</read_only>

<complexity_limits>
Queries have complexity limits. Very deep or wide queries may be rejected. Split large queries if needed.
</complexity_limits>

<all_errors_401>
All GraphQL errors return HTTP 401 status. Check response body for actual error details.
</all_errors_401>

</limitations>

<anti_patterns>

<anti_pattern name="polling-cart-api">
**Problem:** Polling cart endpoint on interval to check for changes
**Why bad:** Millions of browsers polling = server overload
**Instead:** Query cart in response to user actions, use webhooks server-side
</anti_pattern>

<anti_pattern name="fetching-everything">
**Problem:** Requesting all fields "just in case"
**Why bad:** Slower responses, higher complexity, wasted bandwidth
**Instead:** Request only fields you'll actually use
</anti_pattern>

<anti_pattern name="ignoring-pagination">
**Problem:** Assuming all data comes in one response
**Why bad:** Missing data, incomplete results
**Instead:** Always implement pagination loop
</anti_pattern>

</anti_patterns>
