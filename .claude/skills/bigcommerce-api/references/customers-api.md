<overview>
The Customers API manages customer accounts, addresses, attributes, and form fields. V3 is the primary API for customer operations, though Customer Groups remain V2-only. The Segmentation API (Enterprise only) enables advanced customer targeting.
</overview>

<api_versions>

<v3_customers>
**Primary API for:**
- Customer accounts
- Customer addresses
- Customer attributes
- Customer form fields
- Customer consent
- Stored instruments (payment methods)

Base: `https://api.bigcommerce.com/stores/{store_hash}/v3/customers`
</v3_customers>

<v2_customer_groups>
**V2 still required for:**
- Customer Groups (pricing tiers, access restrictions)

Base: `https://api.bigcommerce.com/stores/{store_hash}/v2/customer_groups`

Customer Groups migration to V3 is planned but not yet available.
</v2_customer_groups>

</api_versions>

<customers_v3>

<get_customers>
```bash
# Get all customers
GET /v3/customers

# Get single customer by ID
GET /v3/customers?id:in=123

# Filter customers
GET /v3/customers?email:in=john@example.com
GET /v3/customers?customer_group_id:in=5,6
GET /v3/customers?date_created:min=2024-01-01
GET /v3/customers?company:like=Acme
GET /v3/customers?name:like=John
```
</get_customers>

<create_customer>
```bash
POST /v3/customers
[
  {
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "company": "Acme Corp",
    "phone": "512-555-1234",
    "customer_group_id": 1,
    "addresses": [
      {
        "first_name": "John",
        "last_name": "Doe",
        "address1": "123 Main St",
        "city": "Austin",
        "state_or_province": "Texas",
        "postal_code": "78701",
        "country_code": "US",
        "address_type": "residential"
      }
    ],
    "authentication": {
      "force_password_reset": true,
      "new_password": "temporaryPassword123!"
    }
  }
]
```

**Note:** V3 accepts an array even for single customer creation.
</create_customer>

<update_customer>
```bash
PUT /v3/customers
[
  {
    "id": 123,
    "first_name": "Jonathan",
    "customer_group_id": 5
  }
]
```
</update_customer>

<delete_customer>
```bash
DELETE /v3/customers?id:in=123,124,125
```
</delete_customer>

<include_subresources>
```bash
GET /v3/customers?include=addresses,storecredit,attributes,formfields
```

Response includes nested address array (limited to 10 per customer in response).
</include_subresources>

</customers_v3>

<customer_addresses>

<get_addresses>
```bash
GET /v3/customers/addresses
GET /v3/customers/addresses?customer_id:in=123
GET /v3/customers/addresses?id:in=456
```

Max limit: 250 addresses per request
Default sort: address ID ascending
</get_addresses>

<create_address>
```bash
POST /v3/customers/addresses
[
  {
    "customer_id": 123,
    "first_name": "John",
    "last_name": "Doe",
    "address1": "456 Oak Ave",
    "address2": "Suite 100",
    "city": "Austin",
    "state_or_province": "Texas",
    "postal_code": "78702",
    "country_code": "US",
    "phone": "512-555-5678",
    "address_type": "commercial"
  }
]
```

**address_type:** `residential` or `commercial`
</create_address>

<update_address>
```bash
PUT /v3/customers/addresses
[
  {
    "id": 456,
    "address1": "789 New Street"
  }
]
```
</update_address>

</customer_addresses>

<customer_groups_v2>

<get_groups>
```bash
GET /v2/customer_groups
GET /v2/customer_groups/{group_id}
```
</get_groups>

<create_group>
```bash
POST /v2/customer_groups
{
  "name": "Wholesale Customers",
  "discount_rules": [
    {
      "type": "all",
      "method": "percent",
      "amount": "15.00"
    }
  ],
  "is_default": false,
  "is_group_for_guests": false
}
```
</create_group>

<discount_rule_types>
- `all` - Discount on all products
- `product` - Discount on specific product
- `category` - Discount on category

**Methods:** `percent`, `fixed`, `price`
</discount_rule_types>

<category_access>
Restrict category access by customer group:
```bash
PUT /v2/customer_groups/{group_id}
{
  "category_access": {
    "type": "specific",
    "categories": [23, 45, 67]
  }
}
```

**type:** `all`, `specific`, `none`
</category_access>

<plan_availability>
Customer Groups are only available on specific BigCommerce plans. Check plan features before implementing.
</plan_availability>

</customer_groups_v2>

<customer_attributes>

<purpose>
Custom attributes store additional customer data beyond standard fields. Define attribute types, then set values per customer.
</purpose>

<get_attributes>
```bash
GET /v3/customers/attributes
GET /v3/customers/attribute-values?customer_id:in=123
```
</get_attributes>

<create_attribute>
```bash
POST /v3/customers/attributes
[
  {
    "name": "Loyalty Tier",
    "type": "dropdown",
    "date_created": "2024-01-01T00:00:00Z"
  }
]
```

**Attribute types:** `string`, `number`, `date`, `checkbox`, `dropdown`, `text`, `multiline_text`
</create_attribute>

<set_attribute_value>
```bash
PUT /v3/customers/attribute-values
[
  {
    "attribute_id": 1,
    "customer_id": 123,
    "value": "Gold"
  }
]
```
</set_attribute_value>

</customer_attributes>

<customer_segmentation>

<enterprise_only>
The Customer Segmentation API is available only to Enterprise customers.
</enterprise_only>

<purpose>
Create customer segments for targeting in Promotions. Segments define groups of shoppers based on shared characteristics.
</purpose>

<create_segment>
```bash
POST /v3/customers/segments
{
  "name": "VIP Customers",
  "description": "High-value repeat customers"
}
```

Manual segments appear in Promotions UI targeting section.
</create_segment>

<add_customers_to_segment>
```bash
POST /v3/customers/segments/{segment_id}/customers
{
  "customer_ids": [123, 456, 789]
}
```
</add_customers_to_segment>

</customer_segmentation>

<stored_instruments>

<purpose>
Manage customer's saved payment methods (stored cards, PayPal accounts).
</purpose>

<get_stored_instruments>
```bash
GET /v3/customers/{customer_id}/stored-instruments
```

Returns tokenized payment methods for the customer.
</get_stored_instruments>

</stored_instruments>

<consent>

<gdpr_compliance>
Track customer consent for marketing and data usage:

```bash
GET /v3/customers/{customer_id}/consent
PUT /v3/customers/{customer_id}/consent
{
  "allow": ["email", "sms"],
  "deny": ["analytics"],
  "updated_at": "2024-01-15T10:30:00Z"
}
```
</gdpr_compliance>

</consent>

<subscribers>

<separate_from_customers>
Newsletter subscribers are managed separately from customer accounts:

```bash
GET /v3/customers/subscribers
POST /v3/customers/subscribers
DELETE /v3/customers/subscribers/{subscriber_id}
```

A customer can exist without being a subscriber, and vice versa.
</separate_from_customers>

</subscribers>

<anti_patterns>

<anti_pattern name="mixing-v2-v3-customer-operations">
**Problem:** Using V2 for customer CRUD when V3 is available
**Why bad:** Missing features, inconsistent behavior
**Instead:** Use V3 for all customer operations except groups
</anti_pattern>

<anti_pattern name="storing-sensitive-data-in-attributes">
**Problem:** Putting PII or payment data in custom attributes
**Why bad:** Attributes aren't designed for sensitive data, compliance risk
**Instead:** Use proper secure storage, payment tokenization
</anti_pattern>

<anti_pattern name="fetching-all-addresses">
**Problem:** Getting addresses without customer_id filter
**Why bad:** Returns all addresses across all customers, slow and wasteful
**Instead:** Always filter by customer_id when fetching addresses
</anti_pattern>

</anti_patterns>
