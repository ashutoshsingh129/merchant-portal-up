# API Documentation

Complete API documentation for the Stripe Merchant Portal, including both backend REST API endpoints and frontend service methods.

## Table of Contents

- [Backend API](#backend-api)
  - [Base URL](#base-url)
  - [Authentication](#authentication)
  - [Auth Endpoints](#auth-endpoints)
  - [Stripe Endpoints](#stripe-endpoints)
  - [Product Endpoints](#product-endpoints)
- [Frontend API Services](#frontend-api-services)
  - [Authentication Service](#authentication-service)
  - [Stripe Service](#stripe-service)
  - [API Service](#api-service)
- [Data Models](#data-models)
- [Error Handling](#error-handling)

---

# Backend API

## Base URL

**Development**: `http://localhost:5000/api`  
**Production**: `https://your-domain.com/api`

All endpoints are prefixed with `/api`

## Authentication

Most endpoints require JWT authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

The JWT token is obtained through the `/api/auth/login` endpoint and should be stored securely by the client.

---

## Auth Endpoints

### POST `/api/auth/login`

Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "name": "Admin User"
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Invalid credentials

---

### POST `/api/auth/logout`

Logout endpoint (currently returns success message, token should be cleared client-side).

**Headers:** `Authorization: Bearer <token>` (optional)

**Response:**
```json
{
  "message": "Logout successful",
  "success": true
}
```

---

### GET `/api/auth/me`

Get the currently authenticated user's information.

**Headers:** `Authorization: Bearer <token>` (required)

**Response:**
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "stripeId": "acct_1234567890",
    "username": "admin",
    "email": "admin@example.com",
    "name": "Admin User",
    "isMaster": true
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized

---

### POST `/api/validate-keys`

Validate and import Stripe keys.

**Request Body:**
```json
{
  "publicKey": "pk_test_...",
  "secretKey": "sk_test_..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Keys validated and imported successfully"
}
```

---

## Stripe Endpoints

All Stripe endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Transactions

#### GET `/api/stripe/transactions`

Get paginated list of transactions for the authenticated user.

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 200)
- `starting_after` (optional): Pagination cursor (transaction ID)
- `ending_before` (optional): Pagination cursor (transaction ID)
- `customer` (optional): Filter by customer ID

**Response:**
```json
{
  "data": [
    {
      "id": "pi_1234567890",
      "amount": 2000,
      "currency": "usd",
      "status": "succeeded",
      "description": "Payment for order #12345",
      "created": 1640995200,
      "customer": {
        "id": "cus_1234567890",
        "email": "customer@example.com"
      },
      "payment_method": {
        "type": "card",
        "card": {
          "brand": "visa",
          "last4": "4242"
        }
      }
    }
  ],
  "has_more": true,
  "total_count": 150
}
```

---

#### GET `/api/stripe/transactions/:id`

Get a single transaction by ID.

**Path Parameters:**
- `id` (required): Transaction ID

**Response:** Transaction object (same structure as array item above)

---

#### GET `/api/stripe/transactions-with-summary`

Get transactions with summary statistics in a single request.

**Query Parameters:** Same as `/api/stripe/transactions`

**Response:**
```json
{
  "transactions": {
    "data": [...],
    "has_more": true
  },
  "summary": {
    "total": 100000,
    "succeeded": 95000,
    "pending": 3000,
    "failed": 2000
  }
}
```

---

#### GET `/api/stripe/all-transactions`

Get all transactions from platform account and all connected accounts with summary.

**Response:** Same structure as `transactions-with-summary`

---

#### GET `/api/stripe/transactions-fast`

Optimized endpoint for fast transaction loading with pagination.

**Query Parameters:**
- `limit` (optional): Number of records per page
- `page` (optional): Page number
- `account` (optional): Filter by account ID

**Response:** Same as `/api/stripe/transactions`

---

#### GET `/api/stripe/all-transactions-fast`

Get all transactions with filters (optimized for fast loading).

**Query Parameters:**
- `limit` (optional): Records per page
- `page` (optional): Page number
- `status` (optional): Filter by status
- `statusFilter` (optional): Comma-separated list of statuses
- `days` (optional): Number of days to look back
- `amount` (optional): Amount filter value
- `amountOperator` (optional): Comparison operator (>, <, =, >=, <=)
- `currency` (optional): Currency code
- `paymentMethod` (optional): Payment method type

**Response:** Same as `/api/stripe/transactions-with-summary`

---

#### GET `/api/stripe/transactions-db`

Get transactions from local database with advanced filtering and pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Records per page (default: 10)
- `status` (optional): Transaction status
- `statusFilter` (optional): Comma-separated status values
- `days` (optional): Days to look back
- `dateFilterType` (optional): Date filter type
- `dateFilterInput` (optional): Date filter value
- `dateFilterInput2` (optional): Second date for range
- `amount` (optional): Amount filter value
- `amountOperator` (optional): Amount comparison operator
- `currency` (optional): Currency code
- `paymentMethod` (optional): Payment method type
- `customerId` (optional): Customer ID
- `email` (optional): Customer email
- `cardBrand` (optional): Card brand
- `declineReason` (optional): Decline reason
- `last4Digits` (optional): Last 4 digits of card

**Response:**
```json
{
  "transactions": [...],
  "total": 1000,
  "page": 1,
  "limit": 50,
  "totalPages": 20,
  "hasMore": true
}
```

---

#### GET `/api/stripe/transactions-db-summary`

Get summary statistics from database with filters (same query parameters as `/api/stripe/transactions-db`).

**Response:**
```json
{
  "total": 100000,
  "succeeded": 95000,
  "pending": 3000,
  "failed": 2000,
  "refunded": 1000,
  "disputed": 500,
  "uncaptured": 500
}
```

---

#### GET `/api/stripe/transactions-db/:id`

Get a single transaction from database by ID.

**Path Parameters:**
- `id` (required): Transaction ID

**Response:** Transaction object

---

### Payouts

#### GET `/api/stripe/payouts`

Get paginated list of payouts.

**Query Parameters:**
- `limit` (optional): Number of records
- `starting_after` (optional): Pagination cursor
- `ending_before` (optional): Pagination cursor

**Response:**
```json
{
  "data": [
    {
      "id": "po_1234567890",
      "amount": 10000,
      "currency": "usd",
      "status": "paid",
      "arrival_date": 1641081600,
      "created": 1640995200,
      "destination": "ba_1234567890",
      "method": "standard"
    }
  ],
  "has_more": false
}
```

---

#### GET `/api/stripe/payouts/:id`

Get a single payout by ID.

**Path Parameters:**
- `id` (required): Payout ID

**Response:** Payout object

---

#### GET `/api/stripe/all-payouts`

Get all payouts from platform account and all connected accounts with summary.

**Response:**
```json
{
  "payouts": {
    "data": [...],
    "has_more": false
  },
  "summary": {
    "total": 50000,
    "paid": 45000,
    "pending": 3000,
    "in_transit": 2000,
    "canceled": 0,
    "failed": 0
  }
}
```

---

#### GET `/api/stripe/payouts-fast`

Optimized endpoint for fast payout loading with pagination.

**Query Parameters:**
- `limit` (optional): Records per page
- `page` (optional): Page number
- `account` (optional): Filter by account ID

**Response:** Same as `/api/stripe/payouts`

---

#### GET `/api/stripe/all-payouts-fast`

Get all payouts with filters (optimized).

**Query Parameters:**
- `limit` (optional): Records per page
- `page` (optional): Page number
- `status` (optional): Filter by status

**Response:** Same as `/api/stripe/all-payouts`

---

### Accounts

#### GET `/api/stripe/accounts`

Get all connected Stripe accounts for the authenticated user.

**Response:**
```json
{
  "data": [
    {
      "id": "acct_1234567890",
      "email": "merchant@example.com",
      "country": "US",
      "type": "standard",
      "business_type": "company",
      "charges_enabled": true,
      "payouts_enabled": true
    }
  ],
  "total": 1
}
```

---

#### GET `/api/stripe/accounts-fast`

Optimized endpoint for fast account loading.

**Response:** Same as `/api/stripe/accounts`

---

### Customers

#### GET `/api/stripe/all-customers-fast`

Get all customers with pagination and summary.

**Query Parameters:**
- `limit` (optional): Records per page
- `page` (optional): Page number

**Response:**
```json
{
  "customers": {
    "data": [
      {
        "id": "cus_1234567890",
        "email": "customer@example.com",
        "name": "John Doe",
        "created": 1640995200,
        "balance": 0,
        "currency": "usd"
      }
    ],
    "has_more": false
  },
  "summary": {
    "total": 100,
    "delinquent": 5,
    "with_email": 95,
    "with_phone": 80,
    "with_balance": 10
  }
}
```

---

### Summary & Statistics

#### GET `/api/stripe/summary-fast`

Get fast summary statistics.

**Query Parameters:**
- `account` (optional): Filter by account ID

**Response:**
```json
{
  "total": 100000,
  "succeeded": 95000,
  "pending": 3000,
  "failed": 2000,
  "refunded": 1000,
  "disputed": 500,
  "uncaptured": 500
}
```

---

#### GET `/api/stripe/volume-data`

Get volume data for dashboard graphs.

**Query Parameters:**
- `days` (optional): Number of days to analyze
- `groupBy` (optional): `"hour"` or `"day"` (default: `"day"`)
- `date` (optional): ISO date string for specific date

**Response:**
```json
{
  "data": [
    {
      "time": "2024-01-01",
      "gross": 50000,
      "net": 48500,
      "count": 100,
      "newCustomers": 20
    }
  ],
  "totals": {
    "gross": 1000000,
    "net": 970000,
    "count": 2000,
    "newCustomers": 400
  },
  "period": {
    "days": 30,
    "groupBy": "day",
    "startTime": 1704067200,
    "endTime": 1706659200
  }
}
```

---

### Stripe Keys Management

#### POST `/api/stripe/keys`

Store Stripe API keys for the authenticated user. This triggers an automatic full sync of all payment intents and charges.

**Request Body:**
```json
{
  "secret_key": "sk_test_...",
  "publishable_key": "pk_test_..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Keys stored successfully"
}
```

**Note:** This endpoint automatically triggers a full sync in the background after keys are stored.

---

#### GET `/api/stripe/keys/status`

Check if Stripe keys are stored for the authenticated user.

**Response:**
```json
{
  "hasKeys": true,
  "message": "Stripe keys are configured"
}
```

---

#### GET `/api/stripe/keys`

Retrieve stored Stripe keys (publishable key only, secret key is never returned for security).

**Response:**
```json
{
  "publishable_key": "pk_test_...",
  "hasSecretKey": true
}
```

---

#### DELETE `/api/stripe/keys`

Delete stored Stripe keys for the authenticated user.

**Response:**
```json
{
  "success": true,
  "message": "Keys deleted successfully"
}
```

---

### Data Synchronization

#### POST `/api/stripe/sync-initial`

Trigger initial sync (first 10 payment intents and 10 charges).

**Response:**
```json
{
  "message": "Initial sync completed successfully",
  "paymentIntents": {
    "synced": 10,
    "skipped": 0
  },
  "charges": {
    "synced": 10,
    "skipped": 0
  }
}
```

---

#### POST `/api/stripe/sync-batch`

Trigger batch sync (default 100 records, customizable).

**Request Body:**
```json
{
  "batchSize": 100
}
```

**Response:**
```json
{
  "message": "Batch sync completed successfully",
  "paymentIntents": {
    "synced": 100,
    "skipped": 5,
    "hasMore": true
  },
  "charges": {
    "synced": 100,
    "skipped": 3,
    "hasMore": true
  },
  "hasMore": true
}
```

---

#### POST `/api/stripe/sync-all`

Trigger full sync of all records for the user.

**Response:**
```json
{
  "message": "Full sync completed successfully",
  "statusBefore": {
    "paymentIntents": 1000,
    "charges": 950
  },
  "statusAfter": {
    "paymentIntents": 1500,
    "charges": 1400
  },
  "paymentIntents": {
    "synced": 500,
    "skipped": 0
  },
  "charges": {
    "synced": 450,
    "skipped": 0
  }
}
```

---

#### GET `/api/stripe/sync-status`

Get current synchronization status.

**Response:**
```json
{
  "paymentIntentsCount": 1500,
  "chargesCount": 1400,
  "totalTransactions": 2900,
  "oldestRecord": "2024-01-01T00:00:00Z",
  "newestRecord": "2024-01-31T23:59:59Z"
}
```

---

### Cache Management

#### POST `/api/stripe/clear-cache`

Clear cache (optional pattern matching).

**Request Body:**
```json
{
  "pattern": "stripe:*"
}
```

**Response:**
```json
{
  "message": "Cache cleared successfully"
}
```

---

## Product Endpoints

### GET `/api/product`

Get all products.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Product Name",
    "status": "active"
  }
]
```

---

### POST `/api/product/add`

Create a new product.

**Request Body:**
```json
{
  "name": "Product Name",
  "status": "active"
}
```

**Response:** Created product object

---

### GET `/api/product/:id`

Get a product by ID.

**Path Parameters:**
- `id` (required): Product ID

**Response:** Product object

---

### PUT `/api/product/:id`

Update a product.

**Path Parameters:**
- `id` (required): Product ID

**Request Body:**
```json
{
  "name": "Updated Product Name",
  "status": "inactive"
}
```

**Response:** Updated product object

---

# Frontend API Services

## Authentication Service

**Location**: `client/src/services/authService.ts`

The authentication service handles user authentication, token management, and API configuration using Axios.

### Methods

#### `login(username: string, password: string)`

Authenticate a user and store the JWT token.

**Parameters:**
- `username` (string): User's username
- `password` (string): User's password

**Returns:** `Promise<AxiosResponse>`

**Example:**
```typescript
import { login } from './services/authService';

const response = await login('admin', 'password123');
const { token, user } = response.data;
```

---

#### `logout()`

Logout the current user and clear authentication tokens.

**Returns:** `Promise<void>`

**Example:**
```typescript
import { logout } from './services/authService';

await logout();
```

---

#### `checkAuthStatus()`

Check if the current user is authenticated and get their information.

**Returns:** `Promise<AxiosResponse>`

**Throws:** Error if no auth token is found

**Example:**
```typescript
import { checkAuthStatus } from './services/authService';

try {
  const response = await checkAuthStatus();
  const user = response.data.user;
} catch (error) {
  // User not authenticated
}
```

---

#### `validateKeys(encryptedKeys: { publicKey: string; secretKey: string })`

Validate and import Stripe keys.

**Parameters:**
- `encryptedKeys` (object):
  - `publicKey` (string): Encrypted Stripe publishable key
  - `secretKey` (string): Encrypted Stripe secret key

**Returns:** `Promise<AxiosResponse>`

---

#### `isAuthenticated(): boolean`

Check if user is currently authenticated (checks for token in localStorage).

**Returns:** `boolean`

---

#### `clearAuthToken(): void`

Clear authentication token and prevent it from being sent in headers.

---

## Stripe Service

**Location**: `client/src/services/stripeService.ts`

The Stripe service provides comprehensive methods for interacting with Stripe data through the backend API.

### Service Instance

```typescript
import { stripeService } from './services/stripeService';
```

### Transaction Methods

#### `getTransactions(params?: TransactionParams)`

Get paginated list of transactions.

**Parameters:**
```typescript
interface TransactionParams {
  limit?: number;           // Default: 200
  starting_after?: string;  // Pagination cursor
  ending_before?: string;   // Pagination cursor
  status?: string;         // Filter by status
  customer?: string;       // Filter by customer ID
}
```

**Returns:** `Promise<ApiResponse<StripeTransactionListResponse>>`

---

#### `getTransaction(transactionId: string)`

Get a single transaction by ID.

**Parameters:**
- `transactionId` (string): Transaction ID

**Returns:** `Promise<ApiResponse<StripeTransaction | null>>`

---

#### `getTransactionsWithSummary(params?: TransactionParams)`

Get transactions with summary statistics in a single request.

**Returns:** `Promise<ApiResponse<{ transactions: StripeTransactionListResponse; summary: Summary }>>`

---

#### `getAllTransactionsWithSummary(params?: { limit?: number })`

Get all transactions from platform account and all connected accounts with summary.

**Returns:** `Promise<ApiResponse<{ transactions: StripeTransactionListResponse; summary: Summary }>>`

---

#### `getTransactionsFast(params?: FastTransactionParams)`

Optimized method for fast transaction loading with pagination.

**Parameters:**
```typescript
interface FastTransactionParams {
  limit?: number;    // Records per page
  page?: number;     // Page number
  account?: string;  // Filter by account ID
}
```

---

#### `getAllTransactionsFast(params?: AdvancedTransactionParams)`

Get all transactions with advanced filters (optimized).

**Parameters:**
```typescript
interface AdvancedTransactionParams {
  limit?: number;
  page?: number;
  status?: string;
  statusFilter?: string[];
  days?: number;
  amount?: number;
  amountOperator?: string;
  currency?: string;
  paymentMethod?: string;
}
```

---

#### `getTransactionsFromDb(params?: DatabaseTransactionParams)`

Get transactions from local database with advanced filtering and pagination.

**Parameters:**
```typescript
interface DatabaseTransactionParams {
  page?: number;
  limit?: number;
  status?: string;
  statusFilter?: string[];
  days?: number;
  dateFilterType?: string;
  dateFilterInput?: string;
  dateFilterInput2?: string;
  amount?: number;
  amountOperator?: string;
  currency?: string;
  paymentMethod?: string;
  customerId?: string;
  email?: string;
  cardBrand?: string;
  declineReason?: string;
  last4Digits?: string;
}
```

---

#### `getSummaryFromDb(params?: DatabaseTransactionParams)`

Get summary statistics from database with filters.

**Returns:** `Promise<ApiResponse<Summary>>`

---

### Payout Methods

#### `getPayouts(params?: PayoutParams)`

Get paginated list of payouts.

**Parameters:**
```typescript
interface PayoutParams {
  limit?: number;
  starting_after?: string;
  ending_before?: string;
}
```

---

#### `getPayout(payoutId: string)`

Get a single payout by ID.

---

#### `getPayoutsFast(params?: FastPayoutParams)`

Optimized method for fast payout loading with pagination.

---

#### `getAllPayoutsFast(params?: FastPayoutParams)`

Get all payouts from platform account and all connected accounts with summary (optimized).

---

### Account Methods

#### `getAccountsFast()`

Get all connected Stripe accounts (optimized).

**Returns:** `Promise<ApiResponse<{ accounts: Account[]; total: number }>>`

---

### Customer Methods

#### `getAllCustomersFast(params?: CustomerParams)`

Get all customers with pagination and summary (optimized).

**Parameters:**
```typescript
interface CustomerParams {
  limit?: number;
  page?: number;
}
```

---

### Summary Methods

#### `getSummaryFast(account?: string)`

Get fast summary statistics.

**Parameters:**
- `account` (optional): Filter by account ID

**Returns:** `Promise<ApiResponse<Summary>>`

---

### Volume Data Methods

#### `getVolumeData(params?: VolumeDataParams)`

Get volume data for dashboard graphs.

**Parameters:**
```typescript
interface VolumeDataParams {
  days?: number;
  groupBy?: 'hour' | 'day';
  date?: Date;
}
```

---

### Sync Methods

#### `getSyncStatus()`

Get current synchronization status.

**Returns:** `Promise<ApiResponse<SyncStatus>>`

---

#### `triggerInitialSync()`

Trigger initial sync (first 10 payment intents and 10 charges).

**Returns:** `Promise<ApiResponse<SyncResult>>`

---

#### `triggerBatchSync(params?: { batchSize?: number })`

Trigger batch sync (default 100 records).

**Returns:** `Promise<ApiResponse<BatchSyncResult>>`

---

#### `triggerFullSync()`

Trigger full sync of all records.

**Returns:** `Promise<ApiResponse<SyncResult>>`

---

### Cache Methods

#### `clearCache(pattern?: string)`

Clear cache with optional pattern matching.

---

### Utility Methods

#### `formatAmount(amount: number, currency: string): string`

Format amount for display (converts cents to currency format).

**Example:**
```typescript
const formatted = stripeService.formatAmount(1000, 'usd');
// Returns: "$10.00"
```

---

#### `formatDate(timestamp: number): string`

Format Unix timestamp for display.

---

#### `formatRefundDate(timestamp: number): string`

Format Unix timestamp for refund date display (includes year).

---

#### `getStatusColor(status: string): string`

Get color code for transaction status.

**Status Colors:**
- `succeeded`: `#10b981` (green)
- `pending`: `#f59e0b` (yellow)
- `failed`: `#ef4444` (red)
- `refunded`: `#6b7280` (gray)
- `canceled`: `#ef4444` (red)
- Default: `#6b7280` (gray)

---

## API Service

**Location**: `client/src/services/api.ts`

A mock API service for demonstration purposes (not connected to the backend). Provides simulated CRUD operations for users.

**Note:** This service is currently using mock data and is not integrated with the backend API.

---

# Data Models

## PaymentIntent

```typescript
{
  id: number;
  userId: number;
  stripeId: string;
  stripeData: any; // JSONB
  amount: number;
  currency: string;
  status: string;
  customerId: string;
  customerEmail: string;
  description: string;
  paymentMethodType: string;
  createdAt: Date;
  updatedAt: Date;
  stripeCreatedAt: Date;
  application: string; // Connected account ID
}
```

## Charge

```typescript
{
  id: number;
  userId: number;
  stripeId: string;
  stripeData: any; // JSONB
  amount: number;
  currency: string;
  status: string;
  customerId: string;
  customerEmail: string;
  description: string;
  paymentIntentId: string;
  paymentMethodType: string;
  amountRefunded: number;
  refunded: boolean;
  createdAt: Date;
  updatedAt: Date;
  stripeCreatedAt: Date;
  application: string; // Connected account ID
}
```

## User

```typescript
{
  id: number;
  stripeId?: string;
  username: string;
  email?: string;
  name?: string;
  passwordHash?: string;
  rawData?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  isMaster?: boolean;
}
```

---

# Error Handling

## Backend Error Responses

The API uses standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

Error responses follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

Or for some endpoints:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Error message"
}
```

## Frontend Error Handling

All service methods return `ApiResponse<T>` objects with a `success` boolean. Always check `result.success` before accessing `result.data`.

**Pattern:**
```typescript
const result = await stripeService.getTransactions();

if (result.success) {
  // Use result.data
  const transactions = result.data.data;
} else {
  // Handle error
  console.error(result.message);
  // Show error message to user
}
```

**Error Response Structure:**
```typescript
{
  data: null | [] | defaultValue,
  message: "Error message",
  success: false
}
```

The auth service (Axios) automatically handles 401 errors by clearing tokens and redirecting to login. For other errors, check the response status and handle accordingly.

---

## Notes

1. **Authentication**: Most endpoints require JWT authentication. The token should be included in the `Authorization` header as `Bearer <token>`.

2. **Stripe Keys**: Keys are encrypted before storage and can be managed via the `/api/stripe/keys` endpoints. Storing keys automatically triggers a full sync.

3. **Data Sync**: The system supports syncing Stripe data to a local database for faster queries and advanced filtering. Use the sync endpoints to manage this.

4. **Pagination**: Many endpoints support pagination via `limit`, `page`, `starting_after`, and `ending_before` parameters.

5. **Filtering**: Database endpoints (`transactions-db`) support extensive filtering options for advanced queries.

6. **Caching**: Some endpoints use caching for improved performance. Use the `clear-cache` endpoint to clear cached data if needed.

7. **Rate Limits**: Be aware of Stripe API rate limits (100 requests per second). The system implements pagination and batching to stay within limits.

