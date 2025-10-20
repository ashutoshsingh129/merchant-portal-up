# Stripe Merchant Portal - Setup Instructions

## Environment Setup

1. **Create your `.env` file** in the project root with your Stripe keys:

```bash
# Stripe Configuration
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_stripe_publishable_key
REACT_APP_STRIPE_SECRET_KEY=sk_test_your_actual_stripe_secret_key

# API Configuration
REACT_APP_API_BASE_URL=http://localhost:3001/api
REACT_APP_ENVIRONMENT=development
```

2. **Replace the placeholder keys** with your actual Stripe test keys from your Stripe dashboard.

## Backend Setup (Optional - for real API calls)

If you want to test with real Stripe API calls, you can set up a simple backend:

1. **Install backend dependencies**:
```bash
npm install express cors stripe
```

2. **Create a backend .env file**:
```bash
STRIPE_SECRET_KEY=sk_test_your_actual_stripe_secret_key
PORT=3001
```

3. **Start the backend server**:
```bash
node server.js
```

## Frontend Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Start the development server**:
```bash
npm start
```

## API Endpoints

The backend provides these endpoints:

- `GET /api/stripe/transactions` - Get all transactions
- `GET /api/stripe/transactions/:id` - Get a specific transaction
- `GET /api/stripe/transactions/summary` - Get transaction summary

## Testing

1. **With Mock Data**: The frontend will work with mock data if no backend is running
2. **With Real API**: Start the backend server and update your `.env` file with real Stripe keys

## Stripe Dashboard

Make sure you have:
- A Stripe account with test mode enabled
- Some test transactions created in your Stripe dashboard
- Valid API keys from your Stripe dashboard
