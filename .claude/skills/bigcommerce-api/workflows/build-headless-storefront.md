# Workflow: Build Headless BigCommerce Storefront

<required_reading>
**Read these reference files NOW:**
1. references/headless-commerce.md
2. references/graphql-storefront.md
3. references/authentication.md
4. references/multi-storefront.md (if MSF)
</required_reading>

<process>

## Step 1: Choose Framework

Ask the user their preference:

| Option | Best For | Setup Time |
|--------|----------|------------|
| **Catalyst** | Production-ready, full featured | Fastest |
| **Next.js Commerce** | Learning, Vercel deployment | Fast |
| **Custom Next.js** | Full control, specific needs | Medium |
| **Other (React, Vue)** | Existing stack | Varies |

**Recommended: Catalyst** - BigCommerce's official framework with everything built-in.

## Step 2: Set Up Project

### Option A: Catalyst (Recommended)

```bash
# Create new Catalyst storefront
npx create-catalyst-storefront@latest my-store

# Follow prompts to connect to BigCommerce store
# Provides: store hash, access token, channel ID

cd my-store
npm run dev
```

You'll have a fully functional storefront immediately.

### Option B: Next.js Commerce

```bash
# Clone the repository
git clone https://github.com/bigcommerce/nextjs-commerce.git my-store
cd my-store

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
```

Edit `.env.local`:
```
BIGCOMMERCE_STORE_HASH=your_store_hash
BIGCOMMERCE_ACCESS_TOKEN=your_access_token
BIGCOMMERCE_CHANNEL_ID=1
BIGCOMMERCE_STOREFRONT_TOKEN=your_storefront_token
```

### Option C: Custom Next.js

```bash
npx create-next-app@latest my-store --typescript --tailwind --app
cd my-store

# Install BigCommerce SDK
npm install @bigcommerce/storefront-data-hooks
```

## Step 3: Create API Credentials

### Store-level API Account

```
1. BigCommerce Control Panel
2. Settings → Store-level API accounts
3. Create API Account with scopes:
   - Products: Read-only
   - Carts: Modify
   - Checkout: Modify
   - Content: Read-only
   - Storefront API Tokens: Modify
```

### Generate Storefront Token

```bash
curl -X POST \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/storefront/api-token' \
  -H 'X-Auth-Token: {access_token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "channel_id": 1,
    "expires_at": 1893456000,
    "allowed_cors_origins": ["http://localhost:3000", "https://your-domain.com"]
  }'
```

Save the token for client-side GraphQL requests.

## Step 4: Implement Core Features

### GraphQL Client Setup

```typescript
// lib/bigcommerce/graphql-client.ts
const STOREFRONT_API_URL = `https://${process.env.STORE_DOMAIN}/graphql`;

export async function graphqlFetch<T>({
  query,
  variables,
  cache = 'force-cache'
}: {
  query: string;
  variables?: Record<string, unknown>;
  cache?: RequestCache;
}): Promise<T> {
  const response = await fetch(STOREFRONT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.STOREFRONT_TOKEN}`
    },
    body: JSON.stringify({ query, variables }),
    cache
  });

  const json = await response.json();

  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}
```

### Product Listing

```typescript
// app/products/page.tsx
import { graphqlFetch } from '@/lib/bigcommerce/graphql-client';

const GET_PRODUCTS = `
  query GetProducts($first: Int!) {
    site {
      products(first: $first) {
        edges {
          node {
            entityId
            name
            path
            prices {
              price { value currencyCode }
            }
            defaultImage {
              url(width: 400)
              altText
            }
          }
        }
      }
    }
  }
`;

export default async function ProductsPage() {
  const data = await graphqlFetch<{ site: { products: any } }>({
    query: GET_PRODUCTS,
    variables: { first: 20 }
  });

  const products = data.site.products.edges.map((e: any) => e.node);

  return (
    <div className="grid grid-cols-4 gap-4">
      {products.map((product: any) => (
        <ProductCard key={product.entityId} product={product} />
      ))}
    </div>
  );
}
```

### Product Detail Page

```typescript
// app/products/[slug]/page.tsx
const GET_PRODUCT = `
  query GetProduct($path: String!) {
    site {
      route(path: $path) {
        node {
          ... on Product {
            entityId
            name
            description
            prices {
              price { value currencyCode }
              salePrice { value }
            }
            images {
              edges {
                node {
                  url(width: 800)
                  altText
                }
              }
            }
            variants {
              edges {
                node {
                  entityId
                  sku
                  options {
                    edges {
                      node {
                        displayName
                        values {
                          edges {
                            node {
                              label
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
        }
      }
    }
  }
`;

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const data = await graphqlFetch({
    query: GET_PRODUCT,
    variables: { path: `/products/${params.slug}` }
  });

  const product = data.site.route.node;

  return <ProductDetail product={product} />;
}
```

### Cart Functionality

```typescript
// lib/bigcommerce/cart.ts
const CREATE_CART = `
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
              extendedSalePrice { value }
            }
          }
        }
      }
    }
  }
`;

const ADD_TO_CART = `
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
`;

export async function createCart(productId: number, variantId: number, quantity: number) {
  return graphqlFetch({
    query: CREATE_CART,
    variables: {
      input: {
        lineItems: [{
          productEntityId: productId,
          variantEntityId: variantId,
          quantity
        }]
      }
    },
    cache: 'no-store'
  });
}

export async function addToCart(cartId: string, productId: number, variantId: number, quantity: number) {
  return graphqlFetch({
    query: ADD_TO_CART,
    variables: {
      input: {
        cartEntityId: cartId,
        data: {
          lineItems: [{
            productEntityId: productId,
            variantEntityId: variantId,
            quantity
          }]
        }
      }
    },
    cache: 'no-store'
  });
}
```

### Checkout Redirect

```typescript
// lib/bigcommerce/checkout.ts
const GET_CHECKOUT_URL = `
  query GetCheckoutUrl($cartId: String!) {
    site {
      cart(entityId: $cartId) {
        redirectUrls {
          redirectedCheckoutUrl
        }
      }
    }
  }
`;

export async function getCheckoutUrl(cartId: string): Promise<string> {
  const data = await graphqlFetch({
    query: GET_CHECKOUT_URL,
    variables: { cartId }
  });

  return data.site.cart.redirectUrls.redirectedCheckoutUrl;
}

// In your checkout button component
const handleCheckout = async () => {
  const checkoutUrl = await getCheckoutUrl(cartId);
  window.location.href = checkoutUrl;
};
```

## Step 5: Implement SEO

### Metadata

```typescript
// app/products/[slug]/page.tsx
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug);

  return {
    title: product.name,
    description: product.description.substring(0, 160),
    openGraph: {
      title: product.name,
      description: product.description,
      images: [product.defaultImage?.url]
    }
  };
}
```

### Structured Data

```typescript
// components/product-structured-data.tsx
export function ProductStructuredData({ product }: { product: Product }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images.map(i => i.url),
    description: product.description,
    sku: product.sku,
    offers: {
      '@type': 'Offer',
      price: product.prices.price.value,
      priceCurrency: product.prices.price.currencyCode,
      availability: product.inventory?.isInStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock'
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
```

## Step 6: Handle Multi-Storefront (if applicable)

```typescript
// lib/bigcommerce/config.ts
export function getChannelConfig() {
  // Different configs per deployment/domain
  const domain = process.env.NEXT_PUBLIC_DOMAIN;

  const channelMap: Record<string, number> = {
    'us.example.com': 1,
    'eu.example.com': 2,
    'uk.example.com': 3
  };

  return {
    channelId: channelMap[domain] || 1,
    storeDomain: process.env.STORE_DOMAIN
  };
}

// Use in token creation and cart operations
const { channelId } = getChannelConfig();
```

## Step 7: Deploy

### Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Environment Variables

```
STORE_HASH=abc123
ACCESS_TOKEN=xxxx
STORE_DOMAIN=store.mybigcommerce.com
STOREFRONT_TOKEN=xxxx
CHANNEL_ID=1
```

## Step 8: Test and Verify

- [ ] Products display correctly
- [ ] Search and filtering work
- [ ] Add to cart functions
- [ ] Checkout redirects properly
- [ ] Customer login works
- [ ] SEO metadata renders
- [ ] Performance meets targets
- [ ] Mobile responsive

</process>

<success_criteria>
Headless storefront complete when:

- [ ] Products, categories, and search functional
- [ ] Cart and checkout working
- [ ] SEO properly implemented
- [ ] Performance optimized (Core Web Vitals pass)
- [ ] Responsive design
- [ ] Error handling in place
- [ ] Deployed to production
</success_criteria>

<anti_patterns>
Avoid:
- Exposing access tokens in client-side code
- Client-only rendering for SEO-critical pages
- Ignoring error states in GraphQL responses
- Hardcoding channel IDs in MSF setups
- Not implementing proper caching strategies
</anti_patterns>
