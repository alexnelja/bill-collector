<overview>
Headless commerce decouples the frontend presentation layer from BigCommerce's backend. Use BigCommerce as the commerce engine while building custom storefronts with frameworks like Next.js, React, or Vue. BigCommerce provides Catalyst and Next.js Commerce as official headless solutions.
</overview>

<architecture>

<headless_concept>
**Traditional (coupled):**
- Stencil theme renders frontend
- Backend and frontend tightly integrated
- Limited to BigCommerce's rendering

**Headless (decoupled):**
- Custom frontend (React, Vue, etc.)
- APIs connect to BigCommerce backend
- Full control over user experience
- Multiple frontends possible (web, mobile, kiosk)
</headless_concept>

<bigcommerce_role>
BigCommerce handles:
- Product catalog management
- Inventory tracking
- Order processing
- Customer management
- Payment processing
- Tax calculation
- Shipping integrations

Your frontend handles:
- User interface
- User experience
- Performance optimization
- SEO implementation
</bigcommerce_role>

</architecture>

<official_solutions>

<catalyst>
**BigCommerce Catalyst** - The composable headless framework

Built with:
- Next.js 14 (App Router)
- React Server Components
- GraphQL Storefront API
- TypeScript

```bash
# Create new Catalyst storefront
npx create-catalyst-storefront@latest my-store
```

Features:
- Fully functional storefront out of the box
- Customizable UI component library
- Optimized for performance (SSR, RSC)
- SEO and accessibility built-in
- Multi-region support

Best for: New headless projects, rapid development
</catalyst>

<nextjs_commerce>
**Next.js Commerce** - Reference implementation

GitHub: https://github.com/bigcommerce/nextjs-commerce

Integration with BigCommerce via:
- GraphQL Storefront API
- storefront-data-hooks (SWR-based)

Features:
- Vercel-optimized deployment
- Image optimization
- Analytics integration
- Multi-storefront support

Best for: Learning headless patterns, Vercel deployment
</nextjs_commerce>

</official_solutions>

<api_strategy>

<graphql_for_storefront>
Use GraphQL Storefront API for:
- Product catalog queries
- Cart operations
- Checkout initiation
- Customer data (with impersonation token)
- Site content

```graphql
query GetStorefrontData {
  site {
    products(first: 10) {
      edges {
        node {
          entityId
          name
          prices { price { value } }
        }
      }
    }
    categoryTree {
      name
      path
      children {
        name
        path
      }
    }
  }
}
```
</graphql_for_storefront>

<rest_for_management>
Use REST APIs (server-side) for:
- Creating/updating products
- Order management
- Customer account creation
- Inventory updates
- Webhook subscriptions

Keep REST calls server-side to protect credentials.
</rest_for_management>

<hybrid_approach>
Typical headless architecture:

```
[Browser] → [Your Frontend Server] → [BigCommerce APIs]

Frontend handles:
- GraphQL Storefront (can be client-side with token)
- SSR rendering

Backend proxy handles:
- REST Management APIs
- Sensitive operations
- Webhook receiving
```
</hybrid_approach>

</api_strategy>

<cart_checkout>

<cart_with_graphql>
```graphql
mutation CreateCart($input: CreateCartInput!) {
  cart {
    createCart(input: $input) {
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
</cart_with_graphql>

<checkout_options>
Three approaches for checkout:

**1. Redirect Checkout (simplest)**
```graphql
query GetCheckoutUrl($cartId: String!) {
  site {
    cart(entityId: $cartId) {
      redirectUrls {
        redirectedCheckoutUrl
      }
    }
  }
}
```
User redirects to BigCommerce-hosted checkout.

**2. Embedded Checkout**
```javascript
// Embed BigCommerce checkout in iframe
const checkoutUrl = cart.redirectUrls.embeddedCheckoutUrl;
<iframe src={checkoutUrl} />
```
Checkout in your site, BigCommerce handles payment.

**3. Custom Checkout (advanced)**
Build your own checkout UI using:
- Checkout API for state management
- Payments API for processing
- Requires PCI compliance considerations
</checkout_options>

</cart_checkout>

<authentication>

<customer_auth>
For customer login in headless:

**1. Customer Login API**
```bash
POST https://login.bigcommerce.com/jwt
```
Exchange JWT for customer session.

**2. Current Customer API**
Verify logged-in customer identity.

**3. Storefront Token with Customer ID**
Create customer-specific storefront tokens for GraphQL access.
</customer_auth>

<token_management>
```javascript
// Server-side: Create storefront token
const tokenResponse = await fetch(
  `https://api.bigcommerce.com/stores/${storeHash}/v3/storefront/api-token`,
  {
    method: 'POST',
    headers: {
      'X-Auth-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel_id: 1,
      expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      allowed_cors_origins: ['https://your-storefront.com']
    })
  }
);

// Client-side: Use token in GraphQL requests
const graphqlResponse = await fetch(`https://${storeDomain}/graphql`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${storefrontToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query, variables })
});
```
</token_management>

</authentication>

<seo_considerations>

<server_side_rendering>
For SEO, use SSR or SSG:

```javascript
// Next.js getServerSideProps
export async function getServerSideProps({ params }) {
  const product = await fetchProduct(params.slug);

  return {
    props: { product }
  };
}

// Next.js generateMetadata (App Router)
export async function generateMetadata({ params }) {
  const product = await fetchProduct(params.slug);

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      images: [product.defaultImage.url]
    }
  };
}
```
</server_side_rendering>

<structured_data>
Include product structured data:

```javascript
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: product.name,
  image: product.images.map(i => i.url),
  description: product.description,
  sku: product.sku,
  offers: {
    "@type": "Offer",
    price: product.price.value,
    priceCurrency: product.price.currencyCode,
    availability: product.inventory.isInStock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock"
  }
};
```
</structured_data>

</seo_considerations>

<multi_storefront>

<channel_awareness>
For MSF stores, specify channel_id everywhere:

```javascript
// Storefront token for specific channel
const token = await createStorefrontToken({
  channel_id: 2,  // Your storefront's channel
  allowed_cors_origins: ['https://storefront-2.com']
});

// Cart creation with channel
const cart = await createCart({
  channel_id: 2,
  line_items: [...]
});
```
</channel_awareness>

<site_routing>
Map domains to channels using Sites API:

```bash
POST /v3/sites
{
  "url": "https://storefront-2.com",
  "channel_id": 2
}
```
</site_routing>

</multi_storefront>

<deployment>

<vercel>
Optimized for Catalyst and Next.js Commerce:
- Edge functions
- Image optimization
- Analytics
- Preview deployments

```bash
vercel deploy
```
</vercel>

<other_platforms>
Works with any platform supporting Node.js:
- Netlify
- AWS Amplify
- Google Cloud Run
- Docker containers
</other_platforms>

</deployment>

<anti_patterns>

<anti_pattern name="client-side-rest-calls">
**Problem:** Making REST API calls from browser
**Why bad:** Exposes access tokens, security risk
**Instead:** Proxy REST calls through your backend
</anti_pattern>

<anti_pattern name="ignoring-ssr">
**Problem:** Client-only rendering for product pages
**Why bad:** Poor SEO, slow initial load
**Instead:** Use SSR/SSG for content pages
</anti_pattern>

<anti_pattern name="hardcoded-channel">
**Problem:** Not parameterizing channel_id
**Why bad:** Can't support multiple storefronts
**Instead:** Make channel configurable per deployment
</anti_pattern>

</anti_patterns>
