<overview>
BigCommerce uses OAuth-based authentication exclusively for V3 APIs. Three types of API accounts exist: store-level, app-level, and account-level credentials. Understanding which to use and how to properly authenticate is fundamental to all BigCommerce integrations.
</overview>

<credential_types>

<type name="store-level-credentials">
**When to use:** Single-store integrations, internal tools, data sync
**How to create:** Store Control Panel → Settings → Store-level API accounts
**What you get:** Access token, client ID, client secret, store hash

```
Store Hash: abc123
Access Token: xxxxxxxxxx
Client ID: xxxxxxxxxx
Client Secret: xxxxxxxxxx
```

Use these for direct API calls without OAuth flow.
</type>

<type name="app-level-credentials">
**When to use:** Multi-store apps, BigCommerce Marketplace apps
**How to create:** Developer Portal → Create App → Technical tab
**What you get:** Client ID, client secret (used in OAuth flow)

Requires OAuth authorization flow to get per-store access tokens.
</type>

<type name="account-level-credentials">
**When to use:** Managing multiple stores under one account
**How to create:** Developer Portal → Account-level API accounts
**What you get:** Access token for all stores in the account

Limited OAuth scopes available at account level.
</type>

</credential_types>

<authentication_methods>

<method name="x-auth-token">
**Used for:** REST Management APIs, GraphQL Admin API

```bash
curl -X GET \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/catalog/products' \
  -H 'X-Auth-Token: {access_token}' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'
```

**Required headers:**
- `X-Auth-Token`: Your access token
- `Content-Type`: `application/json`
- `Accept`: `application/json`
</method>

<method name="bearer-token">
**Used for:** GraphQL Storefront API

Two token types:
1. **Storefront Token** - Anonymous shopper queries, public data
2. **Customer Impersonation Token** - Customer-specific data, server-side use

```bash
curl -X POST \
  'https://{store_domain}/graphql' \
  -H 'Authorization: Bearer {storefront_token}' \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ site { ... } }"}'
```
</method>

<method name="oauth-flow">
**Used for:** Single-click app installation

Flow:
1. User clicks "Install" in BigCommerce
2. BigCommerce redirects to your Auth Callback URL with `code`, `scope`, `context`
3. Exchange code for permanent access_token:

```bash
POST https://login.bigcommerce.com/oauth2/token
Content-Type: application/x-www-form-urlencoded

client_id={client_id}&
client_secret={client_secret}&
code={temporary_code}&
scope={scopes}&
grant_type=authorization_code&
redirect_uri={auth_callback_url}&
context={context}
```

Response includes permanent `access_token` for that store.
</method>

</authentication_methods>

<oauth_scopes>

<scope_categories>
**Read-only scopes:** `read_` prefix - Can only GET data
**Modify scopes:** `modify_` prefix - Can GET, POST, PUT, DELETE

Common scopes:
- `store_v2_products` / `store_v2_products_read_only` - Catalog access
- `store_v2_orders` / `store_v2_orders_read_only` - Orders access
- `store_v2_customers` / `store_v2_customers_read_only` - Customer data
- `store_v2_content` / `store_v2_content_read_only` - Pages, widgets
- `store_cart` / `store_cart_read_only` - Cart operations
- `store_checkout` / `store_checkout_read_only` - Checkout access
- `store_payments_access_token_create` - Payment processing
</scope_categories>

<best_practice>
**Principle of least privilege:** Only request scopes your integration actually needs. Excessive scopes increase security risk and may deter merchants from installing.
</best_practice>

</oauth_scopes>

<storefront_tokens>

<creating_storefront_token>
```bash
POST https://api.bigcommerce.com/stores/{store_hash}/v3/storefront/api-token
X-Auth-Token: {access_token}
Content-Type: application/json

{
  "channel_id": 1,
  "expires_at": 1893456000,
  "allowed_cors_origins": ["https://your-storefront.com"]
}
```

Response:
```json
{
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9..."
  }
}
```
</creating_storefront_token>

<creating_customer_impersonation_token>
```bash
POST https://api.bigcommerce.com/stores/{store_hash}/v3/storefront/api-token-customer-impersonation
X-Auth-Token: {access_token}
Content-Type: application/json

{
  "channel_id": 1,
  "expires_at": 1893456000
}
```

Use impersonation tokens for server-to-server requests or when accessing customer-specific data.
</creating_customer_impersonation_token>

<token_best_practices>
- Create tokens that expire and rotate them regularly
- Long-lived tokens are permitted but less secure
- For anonymous queries, use storefront tokens
- For customer data, use customer impersonation tokens
- Store tokens securely, never expose in client-side code
</token_best_practices>

</storefront_tokens>

<anti_patterns>

<anti_pattern name="hardcoded-credentials">
**Problem:** Embedding API keys directly in code
**Why bad:** Security vulnerability, credentials exposed in version control
**Instead:** Use environment variables or secure secret management
</anti_pattern>

<anti_pattern name="over-scoped-credentials">
**Problem:** Requesting all OAuth scopes "just in case"
**Why bad:** Increased attack surface, merchants may reject installation
**Instead:** Request minimum scopes needed, add scopes when features require them
</anti_pattern>

<anti_pattern name="client-side-tokens">
**Problem:** Exposing access tokens in browser JavaScript
**Why bad:** Tokens can be stolen and misused
**Instead:** Proxy API calls through your backend server
</anti_pattern>

<anti_pattern name="ignoring-token-expiry">
**Problem:** Not handling token expiration for storefront tokens
**Why bad:** API calls fail silently or with confusing errors
**Instead:** Check expiry, implement token refresh logic
</anti_pattern>

</anti_patterns>
