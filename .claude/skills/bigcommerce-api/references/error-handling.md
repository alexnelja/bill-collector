<overview>
BigCommerce APIs return standard HTTP status codes with JSON error responses. Understanding common errors and implementing proper handling is crucial for reliable integrations.
</overview>

<status_codes>

<success_codes>
| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 204 | No Content - Successful deletion |
</success_codes>

<client_errors>
| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Check request format, headers |
| 401 | Unauthorized | Check credentials, token validity |
| 403 | Forbidden | Check OAuth scopes, permissions |
| 404 | Not Found | Verify resource exists, check ID |
| 405 | Method Not Allowed | Use correct HTTP method |
| 409 | Conflict | Resource state conflict, retry |
| 413 | Payload Too Large | Reduce request size |
| 415 | Unsupported Media Type | Use application/json |
| 422 | Unprocessable Entity | Check data validity, required fields |
| 429 | Too Many Requests | Rate limited, implement backoff |
</client_errors>

<server_errors>
| Code | Meaning | Action |
|------|---------|--------|
| 500 | Internal Server Error | Retry with backoff |
| 502 | Bad Gateway | Retry with backoff |
| 503 | Service Unavailable | Retry with backoff |
| 504 | Gateway Timeout | Retry with backoff |
</server_errors>

</status_codes>

<error_response_format>

<standard_format>
```json
{
  "status": 422,
  "title": "Unprocessable Entity",
  "type": "https://developer.bigcommerce.com/docs/start/about/status-codes",
  "errors": {
    "name": "Product name is required",
    "price": "Price must be a positive number"
  }
}
```
</standard_format>

<graphql_errors>
GraphQL always returns HTTP 200 with errors in body:

```json
{
  "data": null,
  "errors": [
    {
      "message": "Product not found",
      "locations": [{"line": 2, "column": 3}],
      "path": ["site", "product"]
    }
  ]
}
```

**Important:** All GraphQL errors return HTTP 401 status - check response body for details.
</graphql_errors>

</error_response_format>

<common_errors>

<error name="401-unauthorized">
**Causes:**
- Expired access token
- Invalid access token
- Missing X-Auth-Token header
- Wrong store hash

**Diagnosis:**
```bash
# Test token validity
curl -X GET \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/catalog/summary' \
  -H 'X-Auth-Token: {access_token}' \
  -H 'Accept: application/json'
```

**Solutions:**
- Verify token is correct (no extra whitespace)
- Check token hasn't expired
- Regenerate credentials if needed
- Verify store hash matches token
</error>

<error name="403-forbidden">
**Causes:**
- OAuth scope insufficient
- Resource belongs to different app
- Store plan doesn't include feature

**Diagnosis:**
Check required scopes for endpoint in documentation.

**Solutions:**
- Add required OAuth scopes to API account
- For apps: Re-authorize with expanded scopes
- Contact merchant about plan features
</error>

<error name="404-not-found">
**Causes:**
- Resource doesn't exist
- Resource was deleted
- Wrong resource ID
- Typo in endpoint URL

**Diagnosis:**
```bash
# Verify resource exists
GET /v3/catalog/products/{product_id}
```

**Solutions:**
- Verify ID is correct
- Check if resource was deleted
- Handle gracefully in code
</error>

<error name="422-unprocessable-entity">
**Causes:**
- Missing required fields
- Invalid field values
- Data type mismatch
- Business rule violation

**Example:**
```json
{
  "status": 422,
  "errors": {
    "weight": "Weight is required for physical products",
    "price": "Price must be greater than 0"
  }
}
```

**Diagnosis:**
Review error messages - they specify which fields have problems.

**Solutions:**
- Add missing required fields
- Validate data before sending
- Check data types match schema
- Review API documentation for constraints
</error>

<error name="429-rate-limited">
**Causes:**
- Exceeded 20,000 requests/hour
- B2B: Exceeded 150 requests/minute
- Payments: Exceeded 50 requests/4 seconds

**Headers to check:**
```
X-Rate-Limit-Requests-Left: 0
X-Rate-Limit-Time-Reset-Ms: 1800000
X-Retry-After: 300
```

**Solutions:**
- Implement exponential backoff
- Respect Retry-After header
- Optimize request patterns
- Use batching and caching
</error>

</common_errors>

<troubleshooting_auth>

<checklist>
1. **Token format correct?**
   - No extra whitespace
   - Complete token (not truncated)
   - Using X-Auth-Token header (not Authorization)

2. **Store hash matches token?**
   - Token is store-specific
   - Check URL: `/stores/{correct_hash}/`

3. **Token still valid?**
   - App tokens are permanent but can be revoked
   - Storefront tokens expire

4. **Required scopes present?**
   - Check API account scopes in control panel
   - Match required scopes for endpoint

5. **Clock sync?**
   - Server time must be accurate
   - Use NTP for synchronization
</checklist>

<debugging_requests>
```bash
# Verbose curl to see all headers
curl -v -X GET \
  'https://api.bigcommerce.com/stores/{store_hash}/v3/catalog/summary' \
  -H 'X-Auth-Token: {access_token}' \
  -H 'Accept: application/json'
```
</debugging_requests>

</troubleshooting_auth>

<error_handling_implementation>

<python_example>
```python
import requests
from requests.exceptions import RequestException

class BigCommerceError(Exception):
    def __init__(self, status_code, message, errors=None):
        self.status_code = status_code
        self.message = message
        self.errors = errors or {}
        super().__init__(f"{status_code}: {message}")

class BigCommerceClient:
    def request(self, method, endpoint, **kwargs):
        try:
            response = requests.request(
                method,
                f"{self.base_url}{endpoint}",
                headers=self.headers,
                **kwargs
            )

            # Check for errors
            if response.status_code >= 400:
                self._handle_error(response)

            return response.json() if response.content else None

        except RequestException as e:
            raise BigCommerceError(0, f"Request failed: {e}")

    def _handle_error(self, response):
        try:
            error_data = response.json()
        except:
            error_data = {"title": response.text}

        raise BigCommerceError(
            status_code=response.status_code,
            message=error_data.get('title', 'Unknown error'),
            errors=error_data.get('errors', {})
        )
```
</python_example>

<javascript_example>
```javascript
class BigCommerceError extends Error {
  constructor(statusCode, message, errors = {}) {
    super(`${statusCode}: ${message}`);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

async function bigCommerceRequest(method, endpoint, data = null) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'X-Auth-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: data ? JSON.stringify(data) : null
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new BigCommerceError(
      response.status,
      errorData.title || 'Request failed',
      errorData.errors || {}
    );
  }

  return response.json();
}
```
</javascript_example>

</error_handling_implementation>

<graceful_degradation>

<strategies>
**For 401/403 (auth errors):**
- Log error details
- Alert administrators
- Return user-friendly message
- Don't retry automatically

**For 404 (not found):**
- Handle as expected condition
- Remove stale references
- Continue processing other items

**For 422 (validation):**
- Log specific field errors
- Present errors to user if applicable
- Fix data and retry

**For 429 (rate limit):**
- Implement backoff and retry
- Queue requests for later
- Consider request optimization

**For 5xx (server errors):**
- Retry with exponential backoff
- Log for monitoring
- Fail gracefully after max retries
</strategies>

</graceful_degradation>

<logging>

<what_to_log>
```python
def log_api_call(response, request_data=None):
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "method": response.request.method,
        "url": response.request.url,
        "status_code": response.status_code,
        "rate_limit_remaining": response.headers.get('X-Rate-Limit-Requests-Left'),
        "response_time_ms": response.elapsed.total_seconds() * 1000
    }

    if response.status_code >= 400:
        log_entry["error"] = response.json()
        # Don't log sensitive request data in production
        logger.error(log_entry)
    else:
        logger.debug(log_entry)
```
</what_to_log>

<sensitive_data>
Never log:
- Access tokens
- API secrets
- Customer PII
- Payment data
</sensitive_data>

</logging>

<anti_patterns>

<anti_pattern name="generic-error-handling">
**Problem:** Catching all errors the same way
**Why bad:** Different errors need different handling
**Instead:** Handle specific error codes appropriately
</anti_pattern>

<anti_pattern name="ignoring-error-details">
**Problem:** Not reading error response body
**Why bad:** Missing actionable information
**Instead:** Parse and log error details
</anti_pattern>

<anti_pattern name="infinite-retry">
**Problem:** Retrying forever without limits
**Why bad:** Wastes resources, masks real problems
**Instead:** Set max retries, alert on repeated failures
</anti_pattern>

<anti_pattern name="logging-secrets">
**Problem:** Including tokens in error logs
**Why bad:** Security vulnerability
**Instead:** Redact sensitive data before logging
</anti_pattern>

</anti_patterns>
