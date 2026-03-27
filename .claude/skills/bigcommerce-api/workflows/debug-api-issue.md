# Workflow: Debug BigCommerce API Issue

<required_reading>
**Read these reference files NOW:**
1. references/error-handling.md
2. references/authentication.md
3. references/rate-limits-pagination.md
</required_reading>

<process>

## Step 1: Identify the Error

Ask the user:
- What error code/message are you receiving?
- Which endpoint are you calling?
- Can you share the request (headers, body)?
- Is this intermittent or consistent?

## Step 2: Categorize the Error

| Error | Category | Next Step |
|-------|----------|-----------|
| 401 | Authentication | Go to Step 3 |
| 403 | Permissions | Go to Step 4 |
| 404 | Not Found | Go to Step 5 |
| 422 | Validation | Go to Step 6 |
| 429 | Rate Limit | Go to Step 7 |
| 5xx | Server Error | Go to Step 8 |
| Other | Unknown | Go to Step 9 |

## Step 3: Debug 401 Unauthorized

**Common causes:**
1. Invalid or expired access token
2. Missing X-Auth-Token header
3. Wrong store hash
4. Token revoked

**Diagnostic steps:**

```bash
# 1. Test token with simple endpoint
curl -v -X GET \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/catalog/summary' \
  -H 'X-Auth-Token: {access_token}' \
  -H 'Accept: application/json'
```

**Checklist:**
- [ ] Token has no extra whitespace?
- [ ] Store hash matches token?
- [ ] Using X-Auth-Token (not Authorization)?
- [ ] Token not revoked in control panel?

**Solutions:**
- Regenerate API credentials in control panel
- Verify store hash in API account details
- Check header format exactly

## Step 4: Debug 403 Forbidden

**Common causes:**
1. Insufficient OAuth scopes
2. Resource owned by different app
3. Feature not available on plan

**Diagnostic steps:**

```bash
# Check what scopes are needed for the endpoint
# (Refer to API documentation)

# For apps, check authorized scopes
GET /v3/oauth/scopes
```

**Checklist:**
- [ ] OAuth scope includes required permission?
- [ ] Using `modify_` scope for write operations?
- [ ] Feature available on merchant's plan?

**Solutions:**
- Add required scopes to API account
- For apps: Re-authorize with expanded scopes
- Check plan limitations

## Step 5: Debug 404 Not Found

**Common causes:**
1. Resource doesn't exist
2. Resource was deleted
3. Typo in endpoint URL
4. Wrong resource ID

**Diagnostic steps:**

```bash
# Verify the resource exists
GET /v3/catalog/products/{product_id}

# List resources to find correct ID
GET /v3/catalog/products?sku={expected_sku}
```

**Checklist:**
- [ ] Resource ID is correct?
- [ ] Resource hasn't been deleted?
- [ ] Endpoint URL is spelled correctly?
- [ ] Using correct API version (v2 vs v3)?

**Solutions:**
- Verify resource exists before operating on it
- Implement graceful handling for deleted resources
- Double-check endpoint documentation

## Step 6: Debug 422 Unprocessable Entity

**Common causes:**
1. Missing required fields
2. Invalid field values
3. Data type mismatch
4. Business rule violation

**Diagnostic steps:**

```bash
# The error response contains specific field errors
{
  "status": 422,
  "errors": {
    "weight": "Weight is required for physical products",
    "price": "Price must be greater than 0"
  }
}
```

**Checklist:**
- [ ] All required fields provided?
- [ ] Data types match schema (string, number, etc.)?
- [ ] Values within allowed ranges?
- [ ] No conflicting field combinations?

**Common 422 fixes:**

**Products:**
- `weight` required for physical products
- `type` must be "physical" or "digital"
- `price` must be >= 0

**Customers:**
- `email` must be valid format
- Required fields depend on store settings

**Orders:**
- `billing_address` required
- `products` array must have valid product_ids

**Solutions:**
- Review API documentation for required fields
- Validate data before sending
- Log full error response to see all field errors

## Step 7: Debug 429 Rate Limited

**Common causes:**
1. Exceeded 20,000 requests/hour
2. Burst of requests too fast
3. B2B: Exceeded 150 requests/minute

**Diagnostic steps:**

```bash
# Check rate limit headers in response
X-Rate-Limit-Requests-Left: 0
X-Rate-Limit-Time-Reset-Ms: 1800000
X-Retry-After: 300
```

**Solutions:**

```python
# Implement exponential backoff
import time
import random

def retry_with_backoff(func, max_retries=10):
    for attempt in range(max_retries):
        response = func()

        if response.status_code == 429:
            retry_after = int(response.headers.get('X-Retry-After', 60))
            jitter = random.uniform(0, 5)
            time.sleep(retry_after + jitter)
            continue

        return response

    raise Exception("Max retries exceeded")
```

**Optimization strategies:**
- Use batch operations (10 products per request)
- Cache frequently accessed data
- Use webhooks instead of polling
- Implement request queuing

## Step 8: Debug 5xx Server Errors

**Common causes:**
1. BigCommerce service issue
2. Request too complex
3. Temporary infrastructure problem

**Diagnostic steps:**

```bash
# Check BigCommerce status
https://status.bigcommerce.com/
```

**Solutions:**
- Implement retry with exponential backoff
- Don't retry immediately
- Log for pattern analysis
- Contact BigCommerce support if persistent

```python
def handle_server_error(func, max_retries=5):
    for attempt in range(max_retries):
        try:
            response = func()
            if response.status_code >= 500:
                delay = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(delay)
                continue
            return response
        except ConnectionError:
            delay = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(delay)

    raise Exception("Server error persists after retries")
```

## Step 9: Debug Unknown/Other Errors

**Diagnostic approach:**

1. **Capture full request/response:**
```bash
curl -v -X [METHOD] \
  'https://api.bigcommerce.com/stores/{hash}/v3/endpoint' \
  -H 'X-Auth-Token: {token}' \
  -H 'Content-Type: application/json' \
  -d '{"your": "data"}'
```

2. **Check request format:**
- Content-Type header set?
- JSON properly formatted?
- No trailing commas in JSON?

3. **Compare with documentation:**
- Endpoint exists for API version?
- Required parameters included?
- Correct HTTP method?

4. **Test in isolation:**
- Works in Postman/curl?
- Works with minimal payload?
- Works for other resources?

## Step 10: Report Issue (if unresolved)

If debugging doesn't resolve the issue:

1. Gather information:
   - Exact endpoint and method
   - Request headers (redact token)
   - Request body
   - Full response including headers
   - Timestamp of error
   - Steps to reproduce

2. Contact BigCommerce:
   - Developer community forums
   - Support ticket (for partners)
   - Include all gathered information

</process>

<common_mistakes>

<mistake name="not-reading-error-body">
Many developers only look at status code. The response body contains specific field errors and guidance.
</mistake>

<mistake name="assuming-auth-error">
401 and 403 are different. 401 = credentials wrong. 403 = credentials right but permissions lacking.
</mistake>

<mistake name="immediate-retry">
Retrying failed requests immediately without backoff causes more failures and potential blocking.
</mistake>

<mistake name="not-logging">
Without logs, reproducing and diagnosing issues is nearly impossible.
</mistake>

</common_mistakes>

<success_criteria>
Issue is resolved when:

- [ ] Root cause identified
- [ ] Solution implemented
- [ ] Similar issues prevented (error handling added)
- [ ] Logging captures future occurrences
- [ ] Documentation updated if needed
</success_criteria>
