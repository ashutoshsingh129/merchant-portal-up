# NestJS Clean Architecture Project

A NestJS application implementing Clean Architecture principles for building scalable and maintainable applications.

## Architecture Overview

This project follows Clean Architecture with the following layers:

- **APIs Layer** (`src/apis/`)
  - Controllers and DTOs
  - Handles HTTP requests/responses
  - Routes API endpoints

- **Use Cases Layer** (`src/usecase/`)
  - Business logic implementation
  - Orchestrates data flow between APIs and Data Services
  - Contains business rules

- **Data Services Layer** (`src/dataservice/`)
  - Handles data access operations
  - Implements repository interfaces
  - Manages data transformations

- **Data Store Layer** (`src/datastore/`)
  - Contains database models and entities
  - Base repository implementations
  - Database configurations

- **Utilities Layer** (`src/utilities/`)
  - Common utilities and helpers
  - Shared services

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm/yarn
- PostgreSQL

### Installation

```bash
$ npm install
```

### Running the Application

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

### Testing

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Project Structure

```
src/
├── apis/               # API Layer
│   └── product/       # Product API endpoints
├── usecase/           # Use Cases Layer
│   └── product-usecase/
├── dataservice/       # Data Services Layer
│   └── product-data/
├── datastore/         # Data Store Layer
│   ├── models/
│   └── repositories/
└── utilities/         # Utilities Layer
```

## Features

- Clean Architecture implementation
- TypeORM for database operations
- Repository pattern
- Dependency injection
- Unit testing setup
- E2E testing setup
- ESLint and Prettier configuration

## API Documentation

### Product Endpoints

- `GET /product` - Get all products
- `POST /product/add` - Create a new product
- `GET /product/:id` - Get product by ID
- `PUT /product/:id` - Update product

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.