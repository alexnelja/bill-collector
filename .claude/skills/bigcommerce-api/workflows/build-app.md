# Workflow: Build a BigCommerce Single-Click App

<required_reading>
**Read these reference files NOW:**
1. references/authentication.md (OAuth flow section)
2. references/app-development.md
3. references/webhooks.md
</required_reading>

<process>

## Step 1: Register as Partner

1. Go to https://partners.bigcommerce.com
2. Click "Get Started" and apply for Technology Partner Program
3. Complete registration and verification
4. Access Developer Portal

## Step 2: Create App in Developer Portal

```
1. Log in to Developer Portal
2. Click "Create an app"
3. Enter app name and description
4. Go to Technical tab
5. Configure:
   - Auth Callback URL: https://your-app.com/api/auth
   - Load Callback URL: https://your-app.com/api/load
   - Uninstall Callback URL: https://your-app.com/api/uninstall
6. Select OAuth Scopes (minimum required)
7. Save and note:
   - Client ID
   - Client Secret
```

## Step 3: Set Up Project

```bash
# Create Next.js app (recommended)
npx create-next-app@latest my-bc-app --typescript --tailwind --app

cd my-bc-app

# Install dependencies
npm install jsonwebtoken axios

# Create .env.local
cat > .env.local << EOF
BC_CLIENT_ID=your_client_id
BC_CLIENT_SECRET=your_client_secret
BC_AUTH_CALLBACK=https://your-app.com/api/auth
APP_URL=https://your-app.com
JWT_SECRET=your_jwt_secret
DATABASE_URL=your_database_url
EOF
```

## Step 4: Implement OAuth Flow

### Auth Callback Handler

```typescript
// app/api/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // BigCommerce sends these params
  const code = searchParams.get('code');
  const scope = searchParams.get('scope');
  const context = searchParams.get('context');

  if (!code || !context) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://login.bigcommerce.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.BC_CLIENT_ID!,
        client_secret: process.env.BC_CLIENT_SECRET!,
        code,
        scope: scope || '',
        grant_type: 'authorization_code',
        redirect_uri: process.env.BC_AUTH_CALLBACK!,
        context
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error || 'Token exchange failed');
    }

    // tokenData contains:
    // - access_token (permanent)
    // - scope
    // - user (object with id, email)
    // - context (stores/abc123)
    // - account_uuid

    // Extract store hash from context
    const storeHash = context.split('/')[1];

    // Store credentials in database
    await saveStoreCredentials({
      storeHash,
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
      userId: tokenData.user.id,
      userEmail: tokenData.user.email
    });

    // Redirect to app
    return NextResponse.redirect(
      new URL(`/dashboard?store=${storeHash}`, process.env.APP_URL)
    );

  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
```

### Load Callback Handler

```typescript
// app/api/load/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  const signedPayload = request.nextUrl.searchParams.get('signed_payload');

  if (!signedPayload) {
    return NextResponse.json({ error: 'Missing signed_payload' }, { status: 400 });
  }

  try {
    // Verify and decode the signed payload
    const decoded = verifySignedPayload(signedPayload);

    // decoded contains:
    // - user (id, email)
    // - owner (id, email)
    // - context (stores/abc123)
    // - store_hash
    // - timestamp

    const storeHash = decoded.store_hash;

    // Verify store is installed
    const credentials = await getStoreCredentials(storeHash);
    if (!credentials) {
      return NextResponse.redirect(
        new URL('/error?message=Store not installed', process.env.APP_URL)
      );
    }

    // Create session JWT for your app
    const sessionToken = jwt.sign(
      {
        storeHash,
        userId: decoded.user.id,
        email: decoded.user.email
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Redirect to app with session
    return NextResponse.redirect(
      new URL(`/dashboard?token=${sessionToken}`, process.env.APP_URL)
    );

  } catch (error) {
    console.error('Load error:', error);
    return NextResponse.json({ error: 'Load failed' }, { status: 500 });
  }
}

function verifySignedPayload(signedPayload: string) {
  const [encodedPayload, signature] = signedPayload.split('.');

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.BC_CLIENT_SECRET!)
    .update(encodedPayload)
    .digest('base64url');

  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }

  // Decode payload
  return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
}
```

### Uninstall Callback Handler

```typescript
// app/api/uninstall/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const signedPayload = request.nextUrl.searchParams.get('signed_payload');

  if (!signedPayload) {
    return NextResponse.json({ error: 'Missing signed_payload' }, { status: 400 });
  }

  try {
    const decoded = verifySignedPayload(signedPayload);
    const storeHash = decoded.store_hash;

    // Clean up store data
    await deleteStoreData(storeHash);

    // Remove webhooks if any
    await removeWebhooks(storeHash);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Uninstall error:', error);
    return NextResponse.json({ error: 'Uninstall failed' }, { status: 500 });
  }
}
```

## Step 5: Build App UI

### Dashboard Layout

```typescript
// app/dashboard/page.tsx
import { verifySession } from '@/lib/auth';
import { BigCommerceClient } from '@/lib/bigcommerce';

export default async function Dashboard({
  searchParams
}: {
  searchParams: { token: string }
}) {
  const session = await verifySession(searchParams.token);

  const client = new BigCommerceClient({
    storeHash: session.storeHash,
    accessToken: await getAccessToken(session.storeHash)
  });

  // Fetch store data
  const store = await client.get('/v2/store');

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Welcome to My App</h1>
      <p>Store: {store.name}</p>

      {/* Your app functionality */}
    </div>
  );
}
```

### BigDesign Components (Optional)

Use BigCommerce's BigDesign for consistent UI:

```bash
npm install @bigcommerce/big-design @bigcommerce/big-design-icons
```

```typescript
import { Panel, Button, Table } from '@bigcommerce/big-design';

export function ProductList({ products }) {
  return (
    <Panel header="Products">
      <Table
        columns={[
          { header: 'Name', hash: 'name', render: ({ name }) => name },
          { header: 'SKU', hash: 'sku', render: ({ sku }) => sku },
          { header: 'Price', hash: 'price', render: ({ price }) => `$${price}` }
        ]}
        items={products}
      />
    </Panel>
  );
}
```

## Step 6: Implement App Features

### Make API Calls

```typescript
// lib/bigcommerce.ts
export class BigCommerceClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(config: { storeHash: string; accessToken: string }) {
    this.baseUrl = `https://api.bigcommerce.com/stores/${config.storeHash}`;
    this.headers = {
      'X-Auth-Token': config.accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async get(endpoint: string) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: this.headers
    });
    return response.json();
  }

  async post(endpoint: string, data: object) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Add put, delete methods
}
```

### Register Webhooks for App

```typescript
// lib/webhooks.ts
export async function registerAppWebhooks(storeHash: string, accessToken: string) {
  const client = new BigCommerceClient({ storeHash, accessToken });

  const webhooks = [
    { scope: 'store/order/created', destination: `${APP_URL}/api/webhooks/order` },
    { scope: 'store/product/updated', destination: `${APP_URL}/api/webhooks/product` }
  ];

  for (const webhook of webhooks) {
    await client.post('/v3/hooks', {
      ...webhook,
      is_active: true,
      headers: {
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET
      }
    });
  }
}
```

## Step 7: Test Locally

### Use ngrok

```bash
# Start your app
npm run dev

# In another terminal
ngrok http 3000

# Update Developer Portal with ngrok URLs:
# Auth Callback: https://abc123.ngrok.io/api/auth
# Load Callback: https://abc123.ngrok.io/api/load
# Uninstall Callback: https://abc123.ngrok.io/api/uninstall
```

### Test Install Flow

1. Go to your BigCommerce sandbox store
2. Apps → My Draft Apps
3. Click your app
4. Click "Install"
5. Authorize requested permissions
6. Verify redirect to your app

## Step 8: Submit for Review

### Prepare Submission

1. **App listing details:**
   - Name, description, features
   - Screenshots (1200x628 recommended)
   - Support email, documentation URL

2. **Technical requirements:**
   - HTTPS for all callbacks
   - Proper error handling
   - Responsive UI
   - BigDesign styling (recommended)

3. **Test cases documented:**
   - Install flow
   - Load flow
   - Uninstall flow
   - Core functionality

### Submit via Developer Portal

```
1. Developer Portal → Your App
2. Review all tabs are complete
3. Submit for Review
4. BigCommerce team reviews (usually 5-10 business days)
5. Address any feedback
6. App goes live on Marketplace
```

</process>

<database_schema>
Minimum database for app:

```sql
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  store_hash VARCHAR(50) UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  scope TEXT,
  user_id INTEGER,
  user_email VARCHAR(255),
  installed_at TIMESTAMP DEFAULT NOW(),
  uninstalled_at TIMESTAMP
);

CREATE TABLE webhooks (
  id SERIAL PRIMARY KEY,
  store_hash VARCHAR(50) REFERENCES stores(store_hash),
  webhook_id INTEGER NOT NULL,
  scope VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```
</database_schema>

<success_criteria>
App is ready when:

- [ ] OAuth flow works (install, load, uninstall)
- [ ] Credentials stored securely
- [ ] API calls function correctly
- [ ] UI matches BigCommerce style
- [ ] Webhooks registered and handled
- [ ] Error handling comprehensive
- [ ] Documentation complete
- [ ] Testing on sandbox store passes
</success_criteria>

<anti_patterns>
Avoid:
- Storing client_secret in frontend code
- Not validating signed_payload
- Skipping uninstall cleanup
- Hardcoding store credentials
- Missing error handling in callbacks
- Not using HTTPS
</anti_patterns>
