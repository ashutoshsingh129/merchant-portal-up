# Stripe Transaction Fields Documentation

This document provides detailed explanations of each field displayed in the Payments and Payouts tables, including their meaning, data source, API calls used, and business significance.

## Table of Contents
- [API Architecture Overview](#api-architecture-overview)
- [Payment API Calls & Data Flow](#payment-api-calls--data-flow)
- [Payout API Calls & Data Flow](#payout-api-calls--data-flow)
- [Core Transaction Fields](#core-transaction-fields)
- [Payment Method Fields](#payment-method-fields)
- [Financial Fields](#financial-fields)
- [Status & Outcome Fields](#status--outcome-fields)
- [Refund Fields](#refund-fields)
- [Settlement & Transfer Fields](#settlement--transfer-fields)
- [Terminal Fields](#terminal-fields)
- [Customer Fields](#customer-fields)
- [Account Fields](#account-fields)
- [Metadata Fields](#metadata-fields)

---

## Complete Stripe API Endpoints & Field Reference

### 1. PaymentIntents Endpoint
**Stripe API:** `GET /v1/payment_intents`

**All Fields Returned:**
```json
{
  "id": "pi_1234567890",
  "object": "payment_intent",
  "amount": 2000,
  "amount_capturable": 0,
  "amount_details": {
    "tip": {}
  },
  "amount_received": 2000,
  "application": null,
  "application_fee_amount": null,
  "automatic_payment_methods": null,
  "canceled_at": null,
  "cancellation_reason": null,
  "capture_method": "automatic",
  "charges": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/charges?payment_intent=pi_1234567890"
  },
  "client_secret": "pi_1234567890_secret_abc123",
  "confirmation_method": "automatic",
  "created": 1640995200,
  "currency": "usd",
  "customer": "cus_1234567890",
  "description": "Payment for order #12345",
  "invoice": null,
  "last_payment_error": null,
  "latest_charge": "ch_1234567890",
  "livemode": false,
  "metadata": {
    "order_id": "12345",
    "terminal_location": "Store A"
  },
  "next_action": null,
  "on_behalf_of": null,
  "payment_method": "pm_1234567890",
  "payment_method_options": {},
  "payment_method_types": ["card"],
  "processing": null,
  "receipt_email": "customer@example.com",
  "review": null,
  "setup_future_usage": null,
  "shipping": null,
  "source": null,
  "statement_descriptor": null,
  "statement_descriptor_suffix": null,
  "status": "succeeded",
  "transfer_data": null,
  "transfer_group": null
}
```

**Key Fields Used in Our Tables:**
- `id` → Transaction ID
- `amount` → Amount
- `currency` → Currency
- `status` → Status
- `description` → Description
- `amount_received` → Amount Received
- `created` → Date
- `receipt_email` → Customer
- `metadata` → Terminal Location
- `payment_method` → Payment Method (when expanded)
- `latest_charge` → Multiple fields (when expanded)
- `customer` → Customer (when expanded)

---

### 2. Charges Endpoint
**Stripe API:** `GET /v1/charges`

**All Fields Returned:**
```json
{
  "id": "ch_1234567890",
  "object": "charge",
  "amount": 2000,
  "amount_captured": 2000,
  "amount_refunded": 0,
  "application": null,
  "application_fee": null,
  "application_fee_amount": null,
  "balance_transaction": "txn_1234567890",
  "billing_details": {
    "address": {
      "city": null,
      "country": null,
      "line1": null,
      "line2": null,
      "postal_code": null,
      "state": null
    },
    "email": null,
    "name": null,
    "phone": null
  },
  "calculated_statement_descriptor": null,
  "captured": true,
  "created": 1640995200,
  "currency": "usd",
  "customer": "cus_1234567890",
  "description": "Payment for order #12345",
  "destination": null,
  "dispute": null,
  "disputed": false,
  "failure_balance_transaction": null,
  "failure_code": null,
  "failure_message": null,
  "fraud_details": {},
  "invoice": null,
  "livemode": false,
  "metadata": {
    "order_id": "12345",
    "terminal_location": "Store A"
  },
  "on_behalf_of": null,
  "order": null,
  "outcome": {
    "network_status": "approved_by_network",
    "reason": null,
    "risk_level": "normal",
    "risk_score": 23,
    "seller_message": "Payment complete.",
    "type": "authorized"
  },
  "paid": true,
  "payment_intent": "pi_1234567890",
  "payment_method": "pm_1234567890",
  "payment_method_details": {
    "card": {
      "brand": "visa",
      "checks": {
        "address_line1_check": null,
        "address_postal_code_check": null,
        "cvc_check": "pass"
      },
      "country": "US",
      "exp_month": 12,
      "exp_year": 2025,
      "fingerprint": "abc123",
      "funding": "credit",
      "installments": null,
      "last4": "4242",
      "mandate": null,
      "network": "visa",
      "three_d_secure": null,
      "wallet": null
    },
    "type": "card"
  },
  "receipt_email": "customer@example.com",
  "receipt_number": null,
  "receipt_url": "https://pay.stripe.com/receipts/...",
  "refunded": false,
  "refunds": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/charges/ch_1234567890/refunds"
  },
  "review": null,
  "shipping": null,
  "source": null,
  "source_transfer": null,
  "statement_descriptor": null,
  "statement_descriptor_suffix": null,
  "status": "succeeded",
  "transfer_data": null,
  "transfer_group": null
}
```

**Key Fields Used in Our Tables:**
- `id` → Charge ID
- `amount` → Amount
- `currency` → Currency
- `status` → Status
- `description` → Description
- `amount_captured` → Amount Received
- `created` → Date
- `receipt_email` → Customer
- `metadata` → Terminal Location
- `payment_method_details.card.brand` → Payment Method
- `payment_method_details.card.last4` → Payment Method
- `outcome.reason` → Decline Reason
- `outcome.failure_message` → Failure Message
- `outcome.risk_level` → Risk Level
- `refunds.data` → Refunded Amount
- `balance_transaction` → Balance Transaction ID
- `transfer_data.destination` → Settlement Merchant

---

### 3. Payouts Endpoint
**Stripe API:** `GET /v1/payouts`

**All Fields Returned:**
```json
{
  "id": "po_1234567890",
  "object": "payout",
  "amount": 10000,
  "arrival_date": 1641081600,
  "automatic": true,
  "balance_transaction": "txn_1234567890",
  "created": 1640995200,
  "currency": "usd",
  "description": "STRIPE PAYOUT",
  "destination": "ba_1234567890",
  "failure_balance_transaction": null,
  "failure_code": null,
  "failure_message": null,
  "livemode": false,
  "metadata": {},
  "method": "standard",
  "original_payout": null,
  "reversed_by": null,
  "source_type": "card",
  "statement_descriptor": null,
  "status": "paid",
  "type": "bank_account"
}
```

**Key Fields Used in Our Tables:**
- `id` → Payout ID
- `amount` → Amount
- `currency` → Currency
- `status` → Status
- `method` → Method
- `type` → Type
- `source_type` → Source Type
- `destination` → Destination
- `description` → Description
- `statement_descriptor` → Statement Descriptor
- `arrival_date` → Arrival Date
- `created` → Created Date

---

### 4. Accounts Endpoint
**Stripe API:** `GET /v1/accounts`

**All Fields Returned:**
```json
{
  "id": "acct_1234567890",
  "object": "account",
  "business_profile": {
    "mcc": "5734",
    "name": "Example Business",
    "product_description": "Software services",
    "support_email": "support@example.com",
    "support_phone": "+1234567890",
    "support_url": "https://example.com/support",
    "url": "https://example.com"
  },
  "business_type": "company",
  "capabilities": {
    "card_payments": "active",
    "transfers": "active"
  },
  "charges_enabled": true,
  "country": "US",
  "created": 1640995200,
  "default_currency": "usd",
  "details_submitted": true,
  "email": "merchant@example.com",
  "external_accounts": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/accounts/acct_1234567890/external_accounts"
  },
  "metadata": {},
  "payouts_enabled": true,
  "requirements": {
    "currently_due": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
  "settings": {
    "branding": {
      "icon": null,
      "logo": null,
      "primary_color": null,
      "secondary_color": null
    },
    "card_issuing": {
      "tos_acceptance": {
        "date": null,
        "ip": null
      }
    },
    "card_payments": {
      "decline_on": {
        "avs_failure": false,
        "cvc_failure": false
      },
      "statement_descriptor_prefix": null
    },
    "dashboard": {
      "display_name": null,
      "timezone": "UTC"
    },
    "payments": {
      "statement_descriptor": null,
      "statement_descriptor_kana": null,
      "statement_descriptor_kanji": null
    },
    "payouts": {
      "debit_negative_balances": false,
      "schedule": {
        "delay_days": 2,
        "interval": "daily"
      },
      "statement_descriptor": null
    }
  },
  "tos_acceptance": {
    "date": 1640995200,
    "ip": "192.168.1.1"
  },
  "type": "standard"
}
```

**Key Fields Used in Our Tables:**
- `id` → Account
- `email` → Account Email
- `country` → Country
- `default_currency` → Default Currency
- `charges_enabled` → Charges Enabled
- `payouts_enabled` → Payouts Enabled
- `details_submitted` → Details Submitted
- `created` → Created Date

---

### 5. Refunds Endpoint
**Stripe API:** `GET /v1/refunds`

**All Fields Returned:**
```json
{
  "id": "re_1234567890",
  "object": "refund",
  "amount": 1000,
  "charge": "ch_1234567890",
  "created": 1641081600,
  "currency": "usd",
  "metadata": {},
  "payment_intent": "pi_1234567890",
  "reason": "requested_by_customer",
  "receipt_number": null,
  "status": "succeeded"
}
```

**Key Fields Used in Our Tables:**
- `id` → Refund ID
- `amount` → Refunded Amount
- `charge` → Charge ID
- `created` → Refunded Date
- `reason` → Refund Reason
- `status` → Refund Status

---

### 6. Balance Transactions Endpoint
**Stripe API:** `GET /v1/balance_transactions`

**All Fields Returned:**
```json
{
  "id": "txn_1234567890",
  "object": "balance_transaction",
  "amount": 2000,
  "available_on": 1641081600,
  "created": 1640995200,
  "currency": "usd",
  "description": "Payment from customer@example.com",
  "exchange_rate": null,
  "fee": 58,
  "fee_details": [
    {
      "amount": 58,
      "application": null,
      "currency": "usd",
      "description": "Stripe processing fee",
      "type": "stripe_fee"
    }
  ],
  "net": 1942,
  "reporting_category": "charge",
  "source": "ch_1234567890",
  "status": "available",
  "type": "charge"
}
```

**Key Fields Used in Our Tables:**
- `id` → Balance Transaction ID
- `amount` → Transaction Amount
- `fee` → Fee Amount
- `net` → Net Amount
- `source` → Source Transaction ID
- `status` → Transaction Status
- `created` → Transaction Date

---

## Stripe API Endpoints & Field Mappings

### PaymentIntents API Endpoint

**Stripe Endpoint:** `GET /v1/payment_intents`

**Our Usage:**
```typescript
const platformPayments = await this.stripe.paymentIntents.list({
    limit: 100,
    expand: [
        'data.payment_method',
        'data.latest_charge',
        'data.latest_charge.outcome',
        'data.latest_charge.refunds',
        'data.latest_charge.balance_transaction',
        'data.latest_charge.transfer_data',
        'data.customer'
    ]
});
```

**Fields Returned by Stripe API:**

| Stripe Field | Type | Description | Used in Table |
|--------------|------|-------------|---------------|
| `id` | string | PaymentIntent ID | Transaction ID |
| `amount` | number | Amount in smallest currency unit | Amount |
| `currency` | string | Three-letter currency code | Currency |
| `status` | string | Payment status | Status |
| `description` | string | Payment description | Description |
| `amount_received` | number | Amount actually received | Amount Received |
| `amount_capturable` | number | Amount that can be captured | - |
| `capture_method` | string | How payment is captured | - |
| `confirmation_method` | string | How payment is confirmed | - |
| `payment_method_types` | array | Accepted payment methods | - |
| `created` | number | Unix timestamp | Date |
| `metadata` | object | Custom key-value pairs | Terminal Location |
| `receipt_email` | string | Customer email | Customer |
| `payment_method` | object | Payment method details | Payment Method |
| `latest_charge` | object | Latest charge object | Multiple fields |
| `customer` | object | Customer object | Customer |

**Expanded Fields:**

#### `payment_method` (expanded)
| Field | Type | Description | Used in Table |
|-------|------|-------------|---------------|
| `type` | string | Payment method type | Payment Method |
| `card.brand` | string | Card brand (visa, mastercard) | Payment Method |
| `card.last4` | string | Last 4 digits | Payment Method |
| `card.exp_month` | number | Expiry month | - |
| `card.exp_year` | number | Expiry year | - |
| `card.funding` | string | Card funding type | - |

#### `latest_charge` (expanded)
| Field | Type | Description | Used in Table |
|-------|------|-------------|---------------|
| `id` | string | Charge ID | Charge ID |
| `amount` | number | Charge amount | Amount |
| `amount_received` | number | Amount received | Amount Received |
| `outcome.reason` | string | Decline reason | Decline Reason |
| `outcome.failure_message` | string | Failure message | - |
| `outcome.risk_level` | string | Risk assessment | - |
| `refunds.data` | array | Refund objects | Refunded Amount |
| `balance_transaction` | string | Balance transaction ID | Balance Transaction ID |
| `transfer_data.destination` | string | Transfer destination | Settlement Merchant |

#### `customer` (expanded)
| Field | Type | Description | Used in Table |
|-------|------|-------------|---------------|
| `id` | string | Customer ID | Customer ID |
| `email` | string | Customer email | Customer |
| `name` | string | Customer name | - |

---

### Charges API Endpoint

**Stripe Endpoint:** `GET /v1/charges`

**Our Usage:**
```typescript
const platformCharges = await this.stripe.charges.list({
    limit: 100,
    expand: ['data.customer']
});
```

**Fields Returned by Stripe API:**

| Stripe Field | Type | Description | Used in Table |
|--------------|------|-------------|---------------|
| `id` | string | Charge ID | Charge ID |
| `amount` | number | Charge amount | Amount |
| `currency` | string | Currency code | Currency |
| `status` | string | Charge status | Status |
| `description` | string | Charge description | Description |
| `amount_received` | number | Amount received | Amount Received |
| `created` | number | Unix timestamp | Date |
| `metadata` | object | Custom metadata | Terminal Location |
| `receipt_email` | string | Customer email | Customer |
| `payment_method_details` | object | Payment method info | Payment Method |
| `outcome` | object | Payment outcome | Decline Reason |
| `refunds` | object | Refunds data | Refunded Amount |
| `balance_transaction` | string | Balance transaction ID | Balance Transaction ID |
| `transfer_data` | object | Transfer information | Settlement Merchant |
| `customer` | string/object | Customer ID or object | Customer |

**Payment Method Details:**
| Field | Type | Description | Used in Table |
|-------|------|-------------|---------------|
| `card.brand` | string | Card brand | Payment Method |
| `card.last4` | string | Last 4 digits | Payment Method |
| `card.exp_month` | number | Expiry month | - |
| `card.exp_year` | number | Expiry year | - |
| `card.funding` | string | Card funding type | - |

**Outcome Object:**
| Field | Type | Description | Used in Table |
|-------|------|-------------|---------------|
| `reason` | string | Decline reason | Decline Reason |
| `failure_message` | string | Human-readable failure | - |
| `risk_level` | string | Risk assessment | - |

---

### Payouts API Endpoint

**Stripe Endpoint:** `GET /v1/payouts`

**Our Usage:**
```typescript
const platformPayouts = await this.stripe.payouts.list({
    limit: 100
});
```

**Fields Returned by Stripe API:**

| Stripe Field | Type | Description | Used in Table |
|--------------|------|-------------|---------------|
| `id` | string | Payout ID | Payout ID |
| `amount` | number | Payout amount | Amount |
| `currency` | string | Currency code | Currency |
| `status` | string | Payout status | Status |
| `arrival_date` | number | Unix timestamp | Arrival Date |
| `created` | number | Unix timestamp | Created Date |
| `description` | string | Payout description | Description |
| `destination` | string | Destination account | Destination |
| `failure_code` | string | Failure code | - |
| `failure_message` | string | Failure message | - |
| `method` | string | Payout method | Method |
| `source_type` | string | Source type | Source Type |
| `statement_descriptor` | string | Statement descriptor | Statement Descriptor |
| `type` | string | Payout type | Type |
| `metadata` | object | Custom metadata | - |

---

### Connected Accounts API Endpoint

**Stripe Endpoint:** `GET /v1/accounts`

**Our Usage:**
```typescript
const connectedAccounts = await this.stripe.accounts.list({
    limit: 100
});
```

**Fields Returned by Stripe API:**

| Stripe Field | Type | Description | Used in Table |
|--------------|------|-------------|---------------|
| `id` | string | Account ID | Account |
| `email` | string | Account email | Account Email |
| `type` | string | Account type | - |
| `country` | string | Country code | - |
| `default_currency` | string | Default currency | - |
| `charges_enabled` | boolean | Can accept charges | - |
| `payouts_enabled` | boolean | Can receive payouts | - |
| `details_submitted` | boolean | Details submitted | - |
| `created` | number | Unix timestamp | - |

---

## Stripe API Expansions Explained

### What are Expansions?
Stripe API expansions allow you to include related objects in a single API call instead of making separate requests. This reduces the number of API calls needed and improves performance.

### Expansions Used in Our Project

#### PaymentIntents Expansions
```typescript
expand: [
    'data.payment_method',           // Include full payment method object
    'data.latest_charge',            // Include latest charge object
    'data.latest_charge.outcome',    // Include charge outcome details
    'data.latest_charge.refunds',   // Include refunds array
    'data.latest_charge.balance_transaction', // Include balance transaction
    'data.latest_charge.transfer_data',      // Include transfer data
    'data.customer'                 // Include full customer object
]
```

**Why Each Expansion is Used:**

| Expansion | Purpose | Fields Gained |
|-----------|---------|---------------|
| `payment_method` | Get card details without separate API call | `card.brand`, `card.last4`, `card.exp_month`, `card.exp_year` |
| `latest_charge` | Access charge-specific data | `outcome`, `refunds`, `balance_transaction`, `transfer_data` |
| `latest_charge.outcome` | Get decline reasons and risk assessment | `reason`, `failure_message`, `risk_level` |
| `latest_charge.refunds` | Get refund information | `refunds.data[]` with amounts and dates |
| `latest_charge.balance_transaction` | Get financial settlement details | `balance_transaction.id`, `net`, `fee` |
| `latest_charge.transfer_data` | Get transfer destination for Connect accounts | `destination` account ID |
| `customer` | Get customer details without separate call | `customer.email`, `customer.name` |

#### Charges Expansions
```typescript
expand: ['data.customer']  // Include full customer object
```

**Why This Expansion is Used:**
- **Purpose**: Get customer email and name without making separate API calls
- **Fields Gained**: `customer.email`, `customer.name`, `customer.id`

### Performance Impact of Expansions

#### Without Expansions (Multiple API Calls)
```
1. GET /v1/payment_intents (basic data)
2. GET /v1/payment_methods/{id} (for each payment method)
3. GET /v1/charges/{id} (for each charge)
4. GET /v1/customers/{id} (for each customer)
5. GET /v1/refunds (for each charge's refunds)
6. GET /v1/balance_transactions/{id} (for each transaction)
```

**Total API Calls**: 6+ calls per transaction

#### With Expansions (Single API Call)
```
1. GET /v1/payment_intents?expand=data.payment_method,data.latest_charge...
```

**Total API Calls**: 1 call per transaction

**Performance Improvement**: ~6x reduction in API calls

### Stripe API Rate Limits & Expansions

#### Rate Limit Benefits
- **Standard Rate Limit**: 100 requests per second
- **With Expansions**: Effectively 600+ data points per second (6x improvement)
- **Reduced Latency**: Single request vs multiple sequential requests
- **Better Reliability**: Fewer points of failure

#### Expansion Limitations
- **Response Size**: Expanded responses are larger
- **Memory Usage**: More data loaded into memory
- **Processing Time**: Slightly longer to process expanded responses
- **Stripe Limits**: Some expansions have limits on depth

### Field Access Patterns

#### PaymentIntent → Charge → Refunds
```typescript
// Without expansion (multiple calls)
const paymentIntent = await stripe.paymentIntents.retrieve(pi_id);
const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
const refunds = await stripe.refunds.list({ charge: charge.id });

// With expansion (single call)
const paymentIntent = await stripe.paymentIntents.retrieve(pi_id, {
    expand: ['latest_charge', 'latest_charge.refunds']
});
// Access: paymentIntent.latest_charge.refunds.data
```

#### PaymentIntent → PaymentMethod → Card Details
```typescript
// Without expansion (multiple calls)
const paymentIntent = await stripe.paymentIntents.retrieve(pi_id);
const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);

// With expansion (single call)
const paymentIntent = await stripe.paymentIntents.retrieve(pi_id, {
    expand: ['payment_method']
});
// Access: paymentIntent.payment_method.card.brand
```

---

## API Architecture Overview

### Frontend to Backend Flow
```
Frontend (React) → Backend API (NestJS) → Stripe API → Data Processing → Response
```

### Key Components
- **Frontend Service**: `client/src/services/stripeService.ts`
- **Backend Controller**: `server/src/apis/stripe/stripe.controller.ts`
- **Backend Service**: `server/src/apis/stripe/stripe.service.ts`
- **Stripe SDK**: Official Stripe Node.js SDK

### API Endpoints Used
- **Payments**: `/stripe/all-transactions` - Fetches all transactions from platform + Connect accounts
- **Payouts**: `/stripe/all-payouts` - Fetches all payouts from platform + Connect accounts
- **Individual Records**: `/stripe/transactions/:id`, `/stripe/payouts/:id`

---

## Payment API Calls & Data Flow

### Primary API Call: `getAllTransactionsWithSummary()`

**Frontend Call:**
```typescript
const response = await stripeService.getAllTransactionsWithSummary({
    limit: 500
});
```

**Backend Endpoint:** `GET /stripe/all-transactions`

**Multiple Stripe API Calls Made:**

#### 1. Platform Account Payment Intents
```typescript
const platformPayments = await this.stripe.paymentIntents.list({
    limit: 100,
    expand: [
        'data.payment_method',
        'data.latest_charge',
        'data.latest_charge.outcome',
        'data.latest_charge.refunds',
        'data.latest_charge.balance_transaction',
        'data.latest_charge.transfer_data',
        'data.customer'
    ]
});
```

#### 2. Platform Account Charges
```typescript
const platformCharges = await this.stripe.charges.list({
    limit: 100,
    expand: ['data.customer']
});
```

#### 3. Connect Account Payment Intents (for each connected account)
```typescript
const connectPayments = await this.stripe.paymentIntents.list({
    limit: 100,
    stripeAccount: connectAccountId,
    expand: [
        'data.payment_method',
        'data.latest_charge',
        'data.latest_charge.outcome',
        'data.latest_charge.refunds',
        'data.latest_charge.balance_transaction',
        'data.latest_charge.transfer_data',
        'data.customer'
    ]
});
```

#### 4. Connect Account Charges (for each connected account)
```typescript
const connectCharges = await this.stripe.charges.list({
    limit: 100,
    stripeAccount: connectAccountId,
    expand: ['data.customer']
});
```

### Data Aggregation Process

1. **Fetch Connected Accounts**: Get list of all connected Stripe accounts
2. **Platform Data**: Fetch PaymentIntents and Charges from platform account
3. **Connect Data**: For each connected account, fetch PaymentIntents and Charges
4. **Data Processing**: Combine and normalize data from all sources
5. **Field Mapping**: Map Stripe fields to our transaction interface
6. **Summary Calculation**: Calculate totals for each status type

### Field Mapping from Multiple Sources

| Table Field | Primary Source | Fallback Source | Additional Sources |
|-------------|---------------|-----------------|-------------------|
| Amount | PaymentIntent.amount | Charge.amount | - |
| Status | PaymentIntent.status | Charge.status | - |
| Payment Method | PaymentIntent.payment_method.card | Charge.payment_method_details.card | - |
| Amount Received | PaymentIntent.amount_received | Charge.amount_received | - |
| Refunded Amount | latest_charge.refunds (sum) | Charge.refunds (sum) | - |
| Decline Reason | latest_charge.outcome.reason | Charge.outcome.reason | - |
| Customer Email | Customer.email | PaymentIntent.receipt_email | Charge.receipt_email |
| Settlement Merchant | transfer_data.destination | balance_transaction.destination | - |
| Terminal Location | PaymentIntent.metadata.terminal_location | Charge.metadata.terminal_location | - |

---

## Payout API Calls & Data Flow

### Primary API Call: `getAllPayoutsWithSummary()`

**Frontend Call:**
```typescript
const response = await stripeService.getAllPayoutsWithSummary({
    limit: 500
});
```

**Backend Endpoint:** `GET /stripe/all-payouts`

**Multiple Stripe API Calls Made:**

#### 1. Platform Account Payouts
```typescript
const platformPayouts = await this.stripe.payouts.list({
    limit: 100
});
```

#### 2. Connect Account Payouts (for each connected account)
```typescript
const connectPayouts = await this.stripe.payouts.list({
    limit: 100,
    stripeAccount: connectAccountId
});
```

### Payout Data Aggregation Process

1. **Fetch Connected Accounts**: Get list of all connected Stripe accounts
2. **Platform Payouts**: Fetch payouts from platform account
3. **Connect Payouts**: For each connected account, fetch payouts
4. **Data Processing**: Combine and normalize payout data
5. **Field Mapping**: Map Stripe payout fields to our payout interface
6. **Summary Calculation**: Calculate totals for each payout status

### Payout Field Mapping

| Table Field | Stripe Source | Description |
|-------------|--------------|-------------|
| Amount | payout.amount | Payout amount in smallest currency unit |
| Status | payout.status | Current payout status |
| Method | payout.method | Payout method (standard/instant) |
| Type | payout.type | Payout type (bank_account/card) |
| Source Type | payout.source_type | Source type (card/bank_account) |
| Destination | payout.destination | Destination account |
| Description | payout.description | Payout description |
| Statement Descriptor | payout.statement_descriptor | Statement descriptor |
| Account | Determined by API call | Which account processed the payout |
| Arrival Date | payout.arrival_date | When payout arrives |
| Created Date | payout.created | When payout was created |

---

## Core Transaction Fields

### Amount
- **Field**: `amount`
- **Type**: `number`
- **Description**: The total amount of the transaction in the smallest currency unit (cents for USD)
- **Example**: `5000` = $50.00
- **Source**: Stripe PaymentIntent/Charge `amount` field
- **Business Value**: Primary transaction value for revenue tracking

### Currency
- **Field**: `currency`
- **Type**: `string`
- **Description**: Three-letter ISO currency code
- **Example**: `"usd"`, `"eur"`, `"gbp"`
- **Source**: Stripe PaymentIntent/Charge `currency` field
- **Business Value**: Essential for multi-currency operations and reporting

### Status
- **Field**: `status`
- **Type**: `string`
- **Description**: Current state of the payment
- **Values**:
  - `succeeded`: Payment completed successfully
  - `pending`: Payment is being processed
  - `failed`: Payment was declined or failed
  - `canceled`: Payment was canceled
  - `requires_payment_method`: Needs a valid payment method
  - `requires_confirmation`: Needs confirmation
  - `requires_action`: Requires additional customer action
- **Source**: Stripe PaymentIntent/Charge `status` field
- **Business Value**: Critical for transaction monitoring and reconciliation

### Description
- **Field**: `description`
- **Type**: `string`
- **Description**: Optional description of the transaction
- **Example**: `"Purchase of premium subscription"`
- **Source**: Stripe PaymentIntent/Charge `description` field
- **Business Value**: Helps identify transaction purpose and context

### Date
- **Field**: `created`
- **Type**: `number` (Unix timestamp)
- **Description**: When the transaction was created
- **Example**: `1640995200` = January 1, 2022 00:00:00 UTC
- **Source**: Stripe PaymentIntent/Charge `created` field
- **Business Value**: Essential for time-based reporting and analytics

---

## Payment Method Fields

### Payment Method Type
- **Field**: `payment_method.type`
- **Type**: `string`
- **Description**: Type of payment method used
- **Values**: `card`, `bank_account`, `alipay`, `ideal`, etc.
- **Source**: Stripe PaymentMethod `type` field
- **Business Value**: Understanding customer payment preferences

### Card Brand
- **Field**: `payment_method.card.brand`
- **Type**: `string`
- **Description**: Brand of the card used
- **Values**: `visa`, `mastercard`, `amex`, `discover`, etc.
- **Source**: Stripe PaymentMethod `card.brand` field
- **Business Value**: Card network analysis and processing optimization

### Card Last 4 Digits
- **Field**: `payment_method.card.last4`
- **Type**: `string`
- **Description**: Last 4 digits of the card number
- **Example**: `"4242"`
- **Source**: Stripe PaymentMethod `card.last4` field
- **Business Value**: Customer identification and support

### Card Expiry Month
- **Field**: `payment_method.card.exp_month`
- **Type**: `number`
- **Description**: Month when the card expires
- **Example**: `12` = December
- **Source**: Stripe PaymentMethod `card.exp_month` field
- **Business Value**: Card validity tracking

### Card Expiry Year
- **Field**: `payment_method.card.exp_year`
- **Type**: `number`
- **Description**: Year when the card expires
- **Example**: `2025`
- **Source**: Stripe PaymentMethod `card.exp_year` field
- **Business Value**: Card validity tracking

### Card Funding Type
- **Field**: `payment_method.card.funding`
- **Type**: `string`
- **Description**: How the card is funded
- **Values**: `credit`, `debit`, `prepaid`, `unknown`
- **Source**: Stripe PaymentMethod `card.funding` field
- **Business Value**: Understanding customer spending behavior

---

## Financial Fields

### Amount Received
- **Field**: `amount_received`
- **Type**: `number`
- **Description**: Amount actually received by the merchant
- **Example**: `4800` = $48.00 (after fees)
- **Source**: Stripe PaymentIntent `amount_received` field
- **Business Value**: Actual revenue received after processing

### Amount Capturable
- **Field**: `amount_capturable`
- **Type**: `number`
- **Description**: Amount that can be captured (for authorized payments)
- **Example**: `5000` = $50.00 available to capture
- **Source**: Stripe PaymentIntent `amount_capturable` field
- **Business Value**: Managing authorized but not captured payments

### Application Fee
- **Field**: `fee` / `application_fee_amount`
- **Type**: `number`
- **Description**: Fee charged by the platform (for Connect accounts)
- **Example**: `200` = $2.00 platform fee
- **Source**: Stripe PaymentIntent/Charge `application_fee_amount` field
- **Business Value**: Platform revenue tracking

### Net Amount
- **Field**: `net` / `net_amount`
- **Type**: `number`
- **Description**: Amount after deducting fees
- **Example**: `4800` = $48.00 (after $2.00 fee)
- **Source**: Calculated or from `balance_transaction.net`
- **Business Value**: Actual profit from transaction

### Balance Transaction ID
- **Field**: `balance_transaction_id`
- **Type**: `string`
- **Description**: ID of the balance transaction record
- **Example**: `"txn_1234567890"`
- **Source**: Stripe Charge `balance_transaction` field
- **Business Value**: Linking to detailed financial records

---

## Status & Outcome Fields

### Decline Reason
- **Field**: `decline_reason`
- **Type**: `string`
- **Description**: Reason why payment was declined
- **Values**:
  - `insufficient_funds`: Not enough money in account
  - `lost_card`: Card reported as lost
  - `stolen_card`: Card reported as stolen
  - `generic_decline`: Generic decline reason
  - `do_not_honor`: Bank declined the transaction
  - `invalid_account`: Account number is invalid
  - `card_not_supported`: Card type not supported
- **Source**: Stripe Charge `outcome.reason` or `outcome.failure_code`
- **Business Value**: Understanding payment failures for optimization

### Failure Message
- **Field**: `failure_message`
- **Type**: `string`
- **Description**: Human-readable failure message
- **Example**: `"Your card was declined."`
- **Source**: Stripe Charge `outcome.failure_message`
- **Business Value**: Customer communication and support

### Risk Level
- **Field**: `risk_level`
- **Type**: `string`
- **Description**: Stripe's assessment of transaction risk
- **Values**: `normal`, `elevated`, `highest`
- **Source**: Stripe Charge `outcome.risk_level`
- **Business Value**: Fraud prevention and risk management

---

## Refund Fields

### Refunded Amount
- **Field**: `refunded_amount`
- **Type**: `number`
- **Description**: Total amount refunded for this transaction
- **Example**: `2500` = $25.00 refunded
- **Source**: Sum of all refunds from `latest_charge.refunds`
- **Business Value**: Tracking refunds and chargebacks

### Refunded Date
- **Field**: `refunded_date`
- **Type**: `number` (Unix timestamp)
- **Description**: Date of the first refund
- **Example**: `1641081600` = January 2, 2022
- **Source**: First refund's `created` timestamp
- **Business Value**: Refund timing analysis

### Refund Count
- **Field**: `refund_count`
- **Type**: `number`
- **Description**: Number of refunds processed
- **Example**: `2` = Two separate refunds
- **Source**: Length of `latest_charge.refunds` array
- **Business Value**: Understanding refund patterns

### Refunds Array
- **Field**: `refunds`
- **Type**: `Array<RefundObject>`
- **Description**: Detailed information about each refund
- **Structure**:
  ```typescript
  {
    id: string;           // Refund ID
    amount: number;       // Refund amount
    created: number;      // Refund timestamp
    reason: string;       // Refund reason
    status: string;      // Refund status
  }
  ```
- **Source**: Stripe Charge `refunds.data`
- **Business Value**: Detailed refund analysis

---

## Settlement & Transfer Fields

### Settlement Merchant
- **Field**: `settlement_merchant`
- **Type**: `string`
- **Description**: Which merchant account received the funds
- **Example**: `"acct_1234567890"` (Connect account ID)
- **Source**: `transfer_data.destination` or `balance_transaction.destination`
- **Business Value**: Multi-merchant settlement tracking

### Transferred To
- **Field**: `transferred_to`
- **Type**: `string`
- **Description**: Destination account for transfers
- **Example**: `"acct_1234567890"`
- **Source**: `transfer_data.destination`
- **Business Value**: Transfer destination tracking

### Transfer Group
- **Field**: `transfer_group`
- **Type**: `string`
- **Description**: Group identifier for related transfers
- **Example**: `"group_12345"`
- **Source**: Stripe Charge `transfer_group`
- **Business Value**: Grouping related transactions

---

## Terminal Fields

### Terminal Location
- **Field**: `terminal_location`
- **Type**: `string`
- **Description**: Physical location where payment was processed
- **Example**: `"Store Location A"` or `"loc_1234567890"`
- **Source**: Payment metadata `terminal_location` or `location_id`
- **Business Value**: In-person payment tracking

### Terminal Reader
- **Field**: `terminal_reader`
- **Type**: `string`
- **Description**: Specific terminal device used
- **Example**: `"Reader 001"` or `"tmr_1234567890"`
- **Source**: Payment metadata `terminal_reader` or `reader_id`
- **Business Value**: Device-level transaction tracking

---

## Customer Fields

### Customer ID
- **Field**: `customer.id`
- **Type**: `string`
- **Description**: Unique identifier for the customer
- **Example**: `"cus_1234567890"`
- **Source**: Stripe Customer `id` field
- **Business Value**: Customer identification and history

### Customer Email
- **Field**: `customer.email`
- **Type**: `string`
- **Description**: Customer's email address
- **Example**: `"customer@example.com"`
- **Source**: Stripe Customer `email` or PaymentIntent `receipt_email`
- **Business Value**: Customer communication and support

---

## Account Fields

### Stripe Account
- **Field**: `stripe_account`
- **Type**: `string`
- **Description**: Which Stripe account processed the transaction
- **Example**: `"platform"` or `"acct_1234567890"`
- **Source**: Determined by which account made the API call
- **Business Value**: Multi-account transaction tracking

### Account Email
- **Field**: `account_email`
- **Type**: `string`
- **Description**: Email of the Connect account owner
- **Example**: `"merchant@example.com"`
- **Source**: Stripe Account `email` field
- **Business Value**: Merchant identification

---

## Metadata Fields

### Transaction Metadata
- **Field**: `metadata`
- **Type**: `Record<string, string>`
- **Description**: Custom key-value pairs attached to the transaction
- **Example**: `{"order_id": "12345", "campaign": "summer_sale"}`
- **Source**: Stripe PaymentIntent/Charge `metadata` field
- **Business Value**: Custom business logic and tracking

### Charge ID
- **Field**: `charge_id`
- **Type**: `string`
- **Description**: Reference to the underlying Stripe Charge
- **Example**: `"ch_1234567890"`
- **Source**: Stripe PaymentIntent `latest_charge.id`
- **Business Value**: Linking PaymentIntents to Charges

---

## Capture Method Fields

### Capture Method
- **Field**: `capture_method`
- **Type**: `string`
- **Description**: How the payment is captured
- **Values**:
  - `automatic`: Captured immediately
  - `manual`: Requires manual capture
- **Source**: Stripe PaymentIntent `capture_method`
- **Business Value**: Understanding payment flow

### Confirmation Method
- **Field**: `confirmation_method`
- **Type**: `string`
- **Description**: How the payment is confirmed
- **Values**:
  - `automatic`: Confirmed automatically
  - `manual`: Requires manual confirmation
- **Source**: Stripe PaymentIntent `confirmation_method`
- **Business Value**: Payment confirmation flow

### Payment Method Types
- **Field**: `payment_method_types`
- **Type**: `string[]`
- **Description**: Types of payment methods accepted
- **Example**: `["card", "bank_account"]`
- **Source**: Stripe PaymentIntent `payment_method_types`
- **Business Value**: Payment method configuration

---

## Business Value Summary

### Revenue Tracking
- **Amount**: Primary transaction value
- **Amount Received**: Actual revenue after processing
- **Net Amount**: Profit after fees
- **Application Fee**: Platform revenue

### Risk Management
- **Status**: Transaction success/failure
- **Decline Reason**: Failure analysis
- **Risk Level**: Fraud assessment
- **Refunded Amount**: Chargeback tracking

### Customer Insights
- **Customer Email**: Customer identification
- **Payment Method**: Payment preferences
- **Card Details**: Payment behavior analysis

### Operational Tracking
- **Terminal Location**: Physical transaction tracking
- **Settlement Merchant**: Multi-merchant operations
- **Transfer Details**: Fund movement tracking
- **Metadata**: Custom business logic

### Compliance & Support
- **Transaction Date**: Time-based reporting
- **Refund Details**: Customer service support
- **Failure Messages**: Customer communication
- **Account Information**: Multi-account management

---

## Data Sources

### Stripe API Objects
- **PaymentIntent**: Modern payment flow object
- **Charge**: Legacy payment object
- **Customer**: Customer information
- **PaymentMethod**: Payment method details
- **Refund**: Refund information
- **BalanceTransaction**: Financial settlement details

### Field Mapping
- **Primary Source**: PaymentIntent with expanded latest_charge
- **Fallback Source**: Direct Charge object
- **Metadata Source**: Custom fields in PaymentIntent/Charge metadata
- **Calculated Fields**: Computed from multiple sources

---

## Technical Implementation Details

### Performance Considerations

#### API Rate Limits
- **Stripe Rate Limits**: 100 requests per second per API key
- **Pagination**: Each API call limited to 100 records maximum
- **Multiple Pages**: System fetches additional pages up to 1000 records per account
- **Parallel Processing**: Connect account calls are made in parallel for better performance

#### Data Volume Handling
- **Platform Account**: Typically 100-1000 transactions per call
- **Connect Accounts**: Variable based on merchant activity
- **Total Volume**: Can aggregate thousands of transactions across all accounts
- **Memory Management**: Data processed in chunks to avoid memory issues

#### Caching Strategy
- **No Caching**: Real-time data ensures accuracy
- **Fresh Data**: Each request fetches latest data from Stripe
- **Error Handling**: Graceful fallback if individual account calls fail

### Error Handling

#### API Failures
- **Individual Account Failures**: System continues with other accounts
- **Partial Data**: Returns available data even if some accounts fail
- **Error Logging**: Detailed console logging for debugging
- **User Feedback**: Clear error messages in UI

#### Data Validation
- **Field Validation**: Ensures required fields are present
- **Type Safety**: TypeScript interfaces prevent runtime errors
- **Fallback Values**: Default values for missing optional fields

### Security Considerations

#### API Key Management
- **Server-Side Only**: Stripe API keys never exposed to frontend
- **Environment Variables**: Keys stored securely in server environment
- **Account Isolation**: Each Connect account accessed with proper permissions

#### Data Privacy
- **PCI Compliance**: No sensitive card data stored locally
- **Minimal Data**: Only necessary fields fetched and displayed
- **Secure Transmission**: All API calls over HTTPS

---

## API Call Summary

### Payments Table Data Sources
1. **Platform PaymentIntents** (with expanded fields)
2. **Platform Charges** (with customer expansion)
3. **Connect PaymentIntents** (for each connected account)
4. **Connect Charges** (for each connected account)
5. **Connected Accounts List** (for account identification)

### Payouts Table Data Sources
1. **Platform Payouts**
2. **Connect Payouts** (for each connected account)
3. **Connected Accounts List** (for account identification)

### Total API Calls Per Request
- **Minimum**: 3 calls (platform data + accounts list)
- **Typical**: 5-15 calls (depending on number of connected accounts)
- **Maximum**: 2N + 1 calls (where N = number of connected accounts)

---

*This documentation is based on Stripe API v2020-08-27 and may need updates for newer API versions.*
