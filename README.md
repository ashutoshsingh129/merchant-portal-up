# Stripe Merchant Portal

> **⚠️ Important:** The current working branch is `deployment`. Make sure you are on this branch before starting development.

A full-stack application for managing Stripe payments, transactions, payouts, and customers. Built with React (TypeScript) frontend and NestJS backend, following Clean Architecture principles.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Development Workflow](#development-workflow)
- [Database Setup](#database-setup)
- [Stripe Setup](#stripe-setup)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## Overview

This is a comprehensive Stripe merchant portal that allows you to:
- View and manage transactions (payments, charges)
- Monitor payouts
- Manage customers
- View dashboard analytics
- Sync Stripe data to local database for advanced filtering
- Support multiple Stripe accounts (platform + connected accounts)

## Features

- 🔐 **Authentication**: JWT-based authentication system
- 💳 **Stripe Integration**: Full integration with Stripe API
- 📊 **Dashboard**: Real-time analytics and statistics
- 🔄 **Data Sync**: Sync Stripe data to local PostgreSQL database
- 🔍 **Advanced Filtering**: Filter transactions by status, date, amount, currency, etc.
- 👥 **Multi-Account Support**: Manage platform and connected Stripe accounts
- 🎨 **Modern UI**: Built with Material-UI (MUI) and React
- 🏗️ **Clean Architecture**: Backend follows Clean Architecture principles

## Project Structure

```
merchant-portal-up/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API services
│   │   ├── store/          # Redux store
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   ├── public/             # Static assets
│   └── package.json
├── server/                 # NestJS backend application
│   ├── src/
│   │   ├── apis/          # API layer (controllers, DTOs)
│   │   ├── usecase/       # Business logic layer
│   │   ├── dataservice/   # Data access layer
│   │   ├── datastore/     # Database models and repositories
│   │   └── utilities/     # Common utilities
│   └── package.json
└── package.json           # Root package.json for running both apps
```

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/download/)
- **Stripe Account** - [Sign up](https://stripe.com/)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd merchant-portal-up
```

### 2. Checkout the Working Branch

```bash
git checkout deployment
```

> **Note:** The `deployment` branch is the current working branch with the latest stable code.

### 3. Install Dependencies

Install root dependencies (for running both apps concurrently):
```bash
npm install
```

Install backend dependencies:
```bash
cd server
npm install
cd ..
```

Install frontend dependencies:
```bash
cd client
npm install
cd ..
```

### 4. Database Setup

1. **Create PostgreSQL Database**:
   ```sql
   CREATE DATABASE stripe_merchant_portal;
   ```

2. **The database tables will be automatically created** when you start the backend server for the first time.

## Environment Variables

### Backend Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASS=your_postgres_password
PG_DB=stripe_merchant_portal

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random
JWT_EXPIRES_IN=24h

# Encryption Key (for encrypting Stripe keys in database)
ENCRYPTION_KEY=your_encryption_key_here_minimum_16_characters

# Master Admin User (optional - defaults provided)
MASTER_ADMIN_USER=admin
MASTER_ADMIN_PASSWORD=admin123

# Stripe Import Password (optional - for key validation)
STRIPE_IMPORT_PASSWORD=stripe2024!
```

#### Backend Environment Variables Explained

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Port number for the backend server |
| `NODE_ENV` | No | `development` | Environment mode (development/production) |
| `PG_HOST` | No | `localhost` | PostgreSQL database host |
| `PG_PORT` | No | `5432` | PostgreSQL database port |
| `PG_USER` | No | `postgres` | PostgreSQL database username |
| `PG_PASS` | **Yes** | - | PostgreSQL database password |
| `PG_DB` | No | `stripe_merchant_portal` | PostgreSQL database name |
| `JWT_SECRET` | **Yes** | - | Secret key for JWT token signing (use a long random string) |
| `JWT_EXPIRES_IN` | No | `24h` | JWT token expiration time |
| `ENCRYPTION_KEY` | No | `stripe-connect-2025` | Key for encrypting Stripe keys in database (minimum 16 characters) |
| `MASTER_ADMIN_USER` | No | `admin` | Username for master admin account |
| `MASTER_ADMIN_PASSWORD` | No | `admin123` | Password for master admin account |
| `STRIPE_IMPORT_PASSWORD` | No | `stripe2024!` | Password for Stripe key validation |

**Security Notes:**
- **JWT_SECRET**: Generate a strong random string (minimum 32 characters). You can use: `openssl rand -base64 32`
- **ENCRYPTION_KEY**: Use a strong random string (minimum 16 characters) for encrypting sensitive data
- **PG_PASS**: Never commit your database password to version control
- In production, use environment variables from your hosting platform's secure storage

### Frontend Environment Variables

Create a `.env` file in the `client/` directory:

```env
# API Configuration
REACT_APP_API_BASE_URL=http://localhost:5000/api

# Environment
REACT_APP_ENVIRONMENT=development

# Application Info (optional)
REACT_APP_APP_NAME=Stripe Merchant Portal
REACT_APP_VERSION=1.0.0
```

#### Frontend Environment Variables Explained

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REACT_APP_API_BASE_URL` | No | `http://localhost:5000/api` | Backend API base URL |
| `REACT_APP_ENVIRONMENT` | No | `development` | Environment mode (development/staging/production) |
| `REACT_APP_APP_NAME` | No | `React Template FE` | Application name |
| `REACT_APP_VERSION` | No | `1.0.0` | Application version |

**Note:** All React environment variables must be prefixed with `REACT_APP_` to be accessible in the application.

### Quick Environment Setup

1. **Backend Setup**:
   ```bash
   cd server
   # Create .env file manually or copy from template if available
   # Edit .env with your values
   ```

2. **Frontend Setup**:
   ```bash
   cd client
   # Create .env file manually
   # Edit .env with your values
   ```

## Quick Start

After installation, follow these steps to get the project running:

1. **Checkout the deployment branch:**
   ```bash
   git checkout deployment
   ```

2. **Set up environment variables:**
   - Create `.env` file in `server/` directory (see [Environment Variables](#environment-variables))
   - Create `.env` file in `client/` directory (see [Environment Variables](#environment-variables))

3. **Start PostgreSQL database** (if not running):
   ```bash
   # macOS (using Homebrew)
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   
   # Or use your preferred method
   ```

4. **Create the database:**
   ```bash
   psql -U postgres
   CREATE DATABASE stripe_merchant_portal;
   \q
   ```

5. **Run the application:**
   ```bash
   # From root directory
   npm run dev
   ```

6. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000/api
   - Login with default credentials: `admin` / `admin123`

## Running the Application

### Development Mode

#### Option 1: Run Both Apps Together (Recommended)

From the root directory:
```bash
npm run dev
```

This will start both the backend (port 5000) and frontend (port 3000) concurrently.

#### Option 2: Run Separately

**Terminal 1 - Backend:**
```bash
cd server
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```

### Production Mode

**Build Backend:**
```bash
cd server
npm run build
npm run start:prod
```

**Build Frontend:**
```bash
cd client
npm run build:prod
# Serve the build folder using a static file server (nginx, serve, etc.)
# Or use: npx serve -s build
```

**Alternative Frontend Build Options:**
```bash
cd client
npm run build:dev      # Build for development
npm run build:staging  # Build for staging
npm run build:prod     # Build for production (recommended)
```

## Complete Commands Reference

### Root Directory Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run both backend and frontend in development mode concurrently |

### Backend Commands (from `server/` directory)

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start in development mode with watch (auto-reload) |
| `npm run start` | Start in production mode (no watch) |
| `npm run start:debug` | Start in debug mode with watch |
| `npm run start:prod` | Start production build (run after `npm run build`) |
| `npm run build` | Build for production |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Run tests with coverage report |
| `npm run test:debug` | Run tests in debug mode |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Run ESLint and auto-fix issues |
| `npm run format` | Format code with Prettier |

### Frontend Commands (from `client/` directory)

| Command | Description |
|---------|-------------|
| `npm start` | Start development server (with memory optimization) |
| `npm run start:dev` | Start with development environment variables |
| `npm run start:staging` | Start with staging environment |
| `npm run start:prod` | Start with production environment |
| `npm run build` | Build for production (default) |
| `npm run build:dev` | Build for development environment |
| `npm run build:staging` | Build for staging environment |
| `npm run build:prod` | Build for production environment |
| `npm test` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors automatically |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting without fixing |
| `npm run env:setup` | Copy .env-sample to .env |
| `npm run env:check` | Check current environment configuration |
| `npm run eject` | Eject from Create React App (irreversible) |

## Development Workflow

### Backend Development

1. **Start the backend server**:
   ```bash
   cd server
   npm run start:dev
   ```

2. **The server will:**
   - Start on `http://localhost:5000`
   - API endpoints available at `http://localhost:5000/api`
   - Automatically create database tables on first run
   - Create default admin user (if not exists)
   - Load Stripe keys into cache

3. **Available Scripts:**
   - `npm run start:dev` - Start in development mode with watch
   - `npm run start` - Start in production mode (no watch)
   - `npm run start:debug` - Start in debug mode with watch
   - `npm run start:prod` - Start production build (after build)
   - `npm run build` - Build for production
   - `npm run test` - Run unit tests
   - `npm run test:watch` - Run tests in watch mode
   - `npm run test:cov` - Run tests with coverage report
   - `npm run test:debug` - Run tests in debug mode
   - `npm run test:e2e` - Run end-to-end tests
   - `npm run lint` - Run ESLint and auto-fix issues
   - `npm run format` - Format code with Prettier

### Frontend Development

1. **Start the frontend server**:
   ```bash
   cd client
   npm start
   ```

2. **The application will:**
   - Start on `http://localhost:3000`
   - Automatically open in your browser
   - Hot reload on file changes

3. **Available Scripts:**
   - `npm start` - Start development server (with memory optimization)
   - `npm run start:dev` - Start development server with environment variables
   - `npm run start:staging` - Start with staging environment
   - `npm run start:prod` - Start with production environment
   - `npm run build` - Build for production
   - `npm run build:dev` - Build for development environment
   - `npm run build:staging` - Build for staging environment
   - `npm run build:prod` - Build for production environment
   - `npm test` - Run tests in watch mode
   - `npm run test:coverage` - Run tests with coverage report
   - `npm run lint` - Run ESLint
   - `npm run lint:fix` - Fix ESLint errors automatically
   - `npm run format` - Format code with Prettier
   - `npm run format:check` - Check code formatting without fixing
   - `npm run env:setup` - Copy .env-sample to .env
   - `npm run env:check` - Check current environment configuration
   - `npm run eject` - Eject from Create React App (irreversible)

## Database Setup

### Automatic Setup

The database tables are automatically created when you start the backend server for the first time. The following tables will be created:

- `users` - User accounts
- `stripe_keys` - Encrypted Stripe API keys
- `payment_intents` - Stripe payment intents data
- `charges` - Stripe charges data

### Manual Database Initialization

If you need to manually initialize the database:

1. Ensure PostgreSQL is running
2. Create the database:
   ```sql
   CREATE DATABASE stripe_merchant_portal;
   ```
3. Start the backend server - it will automatically create all tables

### Default Admin User

On first startup, the system creates a default admin user:
- **Username**: `admin` (or value from `MASTER_ADMIN_USER`)
- **Password**: `admin123` (or value from `MASTER_ADMIN_PASSWORD`)

**Important:** Change the default password after first login in production!

## Stripe Setup

### 1. Get Your Stripe API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Go to **Developers** → **API keys**
3. Copy your **Publishable key** and **Secret key**
   - Use **Test mode** keys for development
   - Use **Live mode** keys for production

### 2. Add Stripe Keys to the Application

**Option A: Via Application UI (Recommended)**
1. Start the application
2. Log in with admin credentials
3. Navigate to Stripe Keys settings
4. Enter your Stripe keys
5. Keys will be encrypted and stored in the database

**Option B: Via API**
```bash
POST http://localhost:5000/api/stripe/keys
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "secret_key": "sk_test_...",
  "publishable_key": "pk_test_..."
}
```

### 3. Initial Data Sync

After adding Stripe keys, the system will automatically:
- Validate the keys
- Trigger an initial sync of payment intents and charges
- Cache the keys for faster access

You can also manually trigger syncs:
- **Initial Sync**: First 10 payment intents and 10 charges
- **Batch Sync**: Sync in batches (default 100 records)
- **Full Sync**: Sync all available data

## API Documentation

For detailed API documentation, see [API.md](./API.md).

The API includes:
- Authentication endpoints
- Stripe transaction endpoints
- Payout endpoints
- Customer endpoints
- Data synchronization endpoints
- Stripe keys management

## Troubleshooting

### Backend Issues

**Database Connection Failed:**
- Verify PostgreSQL is running: `pg_isready` or `psql -U postgres`
- Check database credentials in `.env` file
- Ensure database exists: `CREATE DATABASE stripe_merchant_portal;`
- Check network connectivity to database host

**Port Already in Use:**
- Change `PORT` in `.env` file
- Or kill the process using the port: `lsof -ti:5000 | xargs kill`

**JWT Authentication Errors:**
- Verify `JWT_SECRET` is set in `.env` file
- Ensure JWT_SECRET is the same across all instances
- Check token expiration time

### Frontend Issues

**API Connection Failed:**
- Verify backend server is running on port 5000
- Check `REACT_APP_API_BASE_URL` in `.env` file
- Check browser console for CORS errors
- Verify backend CORS configuration

**Build Errors:**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf build`
- Check Node.js version: `node --version` (should be v18+)

### Database Issues

**Tables Not Created:**
- Check database connection in backend logs
- Verify user has CREATE TABLE permissions
- Check backend logs for initialization errors

**Migration Errors:**
- The system automatically handles schema migrations
- If issues occur, you may need to manually run SQL migrations
- Check `server/src/utilities/dbconfig.ts` for table creation scripts

### Stripe Issues

**Invalid API Keys:**
- Verify keys are from the correct Stripe account
- Check if using test keys in test mode
- Ensure keys are not expired or revoked

**Sync Not Working:**
- Check Stripe API rate limits
- Verify keys are valid and have proper permissions
- Check backend logs for sync errors
- Try manual sync via API endpoints

## Future Improvements

The following improvements are planned for future releases:

### Security Enhancements

1. **Encrypt Login Credentials in Network Requests**
   - **Current Issue**: Email and password are visible in the browser network tab when making login requests
   - **Future Solution**: Implement client-side encryption for login credentials before sending them to the backend
   - **Implementation**: Use encryption libraries (e.g., crypto-js) to encrypt credentials on the client side, and decrypt on the server side
   - **Priority**: High (Security)

### Additional Planned Features

- Enhanced error handling and user feedback
- Real-time notifications for transaction updates
- Advanced reporting and analytics
- Multi-factor authentication (MFA)
- API rate limiting and throttling
- Enhanced audit logging
- Webhook support for Stripe events
- Export functionality for transactions and reports

## Additional Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [NestJS Documentation](https://docs.nestjs.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## License

This project is licensed under the MIT License.


