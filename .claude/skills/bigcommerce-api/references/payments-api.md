<overview>
The Payments API enables payment processing for BigCommerce orders. It works with supported payment gateways to process transactions securely through BigCommerce's PCI-compliant infrastructure.
</overview>

<endpoints>

<base_urls>
- Payment Access Token: `https://api.bigcommerce.com/stores/{store_hash}/v3/payments/access_tokens`
- Process Payment: `https://payments.bigcommerce.com/stores/{store_hash}/payments`
</base_urls>

<rate_limit>
**50 requests per 4 seconds** - More restrictive than standard APIs.
</rate_limit>

</endpoints>

<payment_flow>

<overview>
1. Create order or checkout
2. Generate Payment Access Token (PAT)
3. Process payment using PAT
4. Handle result
</overview>

<step_1_create_order>
Create an order that needs payment:

```bash
POST /v2/orders
{
  "customer_id": 123,
  "billing_address": {...},
  "products": [...],
  "status_id": 0  # Incomplete - awaiting payment
}
```

Or use Checkout API for cart-based flow.
</step_1_create_order>

<step_2_create_pat>
Generate Payment Access Token:

```bash
POST /v3/payments/access_tokens
X-Auth-Token: {access_token}
Content-Type: application/json

{
  "order": {
    "id": 12345
  }
}
```

Response:
```json
{
  "data": {
    "id": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9..."
  }
}
```

The PAT is valid for one payment attempt.
</step_2_create_pat>

<step_3_process_payment>
Process payment (note: different host):

```bash
POST https://payments.bigcommerce.com/stores/{store_hash}/payments
Authorization: PAT {payment_access_token}
Content-Type: application/json

{
  "payment": {
    "instrument": {
      "type": "card",
      "cardholder_name": "John Doe",
      "number": "4111111111111111",
      "expiry_month": 12,
      "expiry_year": 2025,
      "verification_value": "123"
    },
    "payment_method_id": "stripe.card"
  }
}
```

**Important:** This request goes to `payments.bigcommerce.com`, not `api.bigcommerce.com`.
</step_3_process_payment>

<step_4_handle_result>
Success response:
```json
{
  "data": {
    "id": "payment_uuid",
    "status": "success",
    "transaction_type": "purchase"
  }
}
```

Order status automatically updates to "Awaiting Fulfillment" (11).
</step_4_handle_result>

</payment_flow>

<payment_instruments>

<credit_card>
```json
{
  "instrument": {
    "type": "card",
    "cardholder_name": "John Doe",
    "number": "4111111111111111",
    "expiry_month": 12,
    "expiry_year": 2025,
    "verification_value": "123"
  },
  "payment_method_id": "stripe.card"
}
```
</credit_card>

<stored_card>
Use previously stored payment method:

```json
{
  "instrument": {
    "type": "stored_card",
    "token": "stored_card_token_from_vault"
  },
  "payment_method_id": "stripe.card"
}
```
</stored_card>

<stored_paypal>
```json
{
  "instrument": {
    "type": "stored_paypal_account",
    "token": "paypal_vault_token"
  },
  "payment_method_id": "paypalcommerce.paypal"
}
```
</stored_paypal>

</payment_instruments>

<payment_methods>

<getting_available_methods>
```bash
GET /v3/payments/methods?order_id={order_id}
```

Response includes available payment methods based on:
- Store configuration
- Order total
- Customer location
- Gateway availability
</getting_available_methods>

<common_payment_method_ids>
```
stripe.card
paypalcommerce.paypal
braintree.card
braintree.paypal
square.card
authorizenet.card
checkout.card
adyen.card
```
</common_payment_method_ids>

</payment_methods>

<supported_gateways>

<compatibility>
The Payments API only works with supported gateways. Check BigCommerce documentation for current list.

Common supported gateways:
- Stripe
- PayPal Commerce Platform
- Braintree
- Square
- Authorize.net
- Adyen
- Checkout.com

**Not all store gateways are API-compatible.** Verify before building.
</compatibility>

</supported_gateways>

<use_cases>

<headless_checkout>
Process payments from custom checkout:

```typescript
async function processHeadlessPayment(orderId: number, cardDetails: CardDetails) {
  // 1. Get PAT
  const patResponse = await bigcommerceClient.post(
    '/v3/payments/access_tokens',
    { order: { id: orderId } }
  );
  const pat = patResponse.data.id;

  // 2. Process payment
  const paymentResponse = await fetch(
    `https://payments.bigcommerce.com/stores/${storeHash}/payments`,
    {
      method: 'POST',
      headers: {
        'Authorization': `PAT ${pat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        payment: {
          instrument: {
            type: 'card',
            cardholder_name: cardDetails.name,
            number: cardDetails.number,
            expiry_month: cardDetails.expiryMonth,
            expiry_year: cardDetails.expiryYear,
            verification_value: cardDetails.cvv
          },
          payment_method_id: 'stripe.card'
        }
      })
    }
  );

  return paymentResponse.json();
}
```
</headless_checkout>

<recurring_billing>
For subscriptions:

1. Store customer's card (use gateway's vaulting)
2. Create orders periodically
3. Process with stored instrument

```typescript
async function chargeSubscription(customerId: number, amount: number) {
  // Create order for subscription charge
  const order = await createSubscriptionOrder(customerId, amount);

  // Get customer's stored payment method
  const storedCard = await getStoredPaymentMethod(customerId);

  // Generate PAT and process
  const pat = await generatePAT(order.id);
  return processStoredCardPayment(pat, storedCard.token);
}
```
</recurring_billing>

</use_cases>

<error_handling>

<common_errors>
```json
// Card declined
{
  "status": 422,
  "title": "Payment was declined",
  "errors": {
    "payment": "Card was declined by the payment processor"
  }
}

// Invalid card number
{
  "status": 422,
  "title": "Unprocessable Entity",
  "errors": {
    "number": "Invalid card number"
  }
}

// Expired PAT
{
  "status": 401,
  "title": "Unauthorized",
  "message": "Payment access token has expired"
  }
}
```
</common_errors>

<handling_declines>
```typescript
async function processPaymentWithRetry(orderId: number, cardDetails: CardDetails) {
  try {
    return await processPayment(orderId, cardDetails);
  } catch (error) {
    if (error.status === 422 && error.errors?.payment) {
      // Card declined - prompt user to try different card
      throw new PaymentDeclinedError(error.errors.payment);
    }
    if (error.status === 401) {
      // PAT expired - generate new one and retry
      const newPat = await generatePAT(orderId);
      return await processPaymentWithPAT(newPat, cardDetails);
    }
    throw error;
  }
}
```
</handling_declines>

</error_handling>

<security>

<pci_compliance>
- BigCommerce is PCI DSS Level 1 certified
- Card data goes directly to BigCommerce's payment servers
- Never store raw card numbers in your database
- Use tokenization for stored cards
</pci_compliance>

<3d_secure>
Many gateways support 3D Secure for additional authentication:
- Required for EU Strong Customer Authentication (SCA)
- Gateway handles redirect flow
- Check gateway documentation for implementation
</3d_secure>

<best_practices>
- Generate PAT just before payment (they expire)
- Handle payment errors gracefully
- Log transaction IDs (not card numbers)
- Use HTTPS for all payment flows
- Validate amounts server-side
</best_practices>

</security>

<transactions_api>

<viewing_transactions>
After payment, view transaction details:

```bash
GET /v3/orders/{order_id}/transactions
```

Response includes:
- Gateway transaction ID
- Amount and currency
- AVS/CVV verification results
- Fraud check results (if available)
</viewing_transactions>

</transactions_api>

<anti_patterns>

<anti_pattern name="storing-card-numbers">
**Problem:** Saving raw card numbers in your database
**Why bad:** PCI violation, security risk
**Instead:** Use gateway tokenization, stored instruments
</anti_pattern>

<anti_pattern name="client-side-payment">
**Problem:** Processing payments from browser JavaScript
**Why bad:** Exposes PAT and payment details
**Instead:** Process payments server-side only
</anti_pattern>

<anti_pattern name="reusing-pat">
**Problem:** Trying to reuse Payment Access Token
**Why bad:** PATs are single-use and expire
**Instead:** Generate new PAT for each payment attempt
</anti_pattern>

</anti_patterns>
