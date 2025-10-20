# React Template Frontend

A modern React TypeScript boilerplate application built with Create React App, Material-UI, Redux Toolkit, and React Router.

## Features

- ⚛️ **React 19** with TypeScript
- 🎨 **Material-UI (MUI)** with custom theme support
- 🔄 **Redux Toolkit** for state management
- 🧭 **React Router** for navigation
- 🌙 **Dark/Light theme** toggle
- 📱 **Responsive design**
- 🧪 **Testing setup** with Jest and React Testing Library
- 🔧 **ESLint & Prettier** for code quality
- 🌍 **Environment configuration** for multiple environments
- 📦 **Build optimization** for production

## Project Structure

```
src/
├── components/           # Reusable components
│   ├── Dashboard/       # Dashboard component
│   │   ├── Dashboard.tsx
│   │   └── Dashboard.styles.ts
│   └── Layout/          # Layout component
│       ├── Layout.tsx
│       └── Layout.styles.ts
├── store/               # Redux store configuration
│   ├── index.ts
│   └── slices/
│       └── appSlice.ts
├── theme/               # MUI theme configuration
│   └── index.ts
├── types/               # TypeScript type definitions
│   └── index.ts
├── utils/               # Utility functions
│   └── index.ts
├── hooks/               # Custom React hooks
├── App.tsx              # Main App component
└── index.tsx            # Application entry point
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd react-template-fe
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000`.

## Available Scripts

- `npm start` - Start development server
- `npm start:staging` - Start with staging environment
- `npm start:production` - Start with production environment
- `npm build` - Build for production
- `npm build:staging` - Build for staging
- `npm build:production` - Build for production
- `npm test` - Run tests
- `npm test:coverage` - Run tests with coverage
- `npm lint` - Run ESLint
- `npm lint:fix` - Fix ESLint errors
- `npm format` - Format code with Prettier
- `npm format:check` - Check code formatting

## Environment Configuration

The application uses a single `.env-sample` file with comprehensive documentation for all environments.

### Quick Setup

1. **Copy the sample file:**
   ```bash
   npm run env:setup
   # or manually: cp .env-sample .env
   ```

2. **Check current environment:**
   ```bash
   npm run env:check
   ```

3. **Modify `.env` file** with your specific values

### Environment Variables

The `.env-sample` file contains detailed documentation for all available environment variables:

- `REACT_APP_API_BASE_URL` - Your API base URL
- `REACT_APP_ENVIRONMENT` - Current environment (development/staging/production)
- `REACT_APP_APP_NAME` - Application name
- `REACT_APP_VERSION` - Application version
- `REACT_APP_DEBUG` - Enable debug mode (development only)

### Environment-Specific Scripts

- `npm start` - Start with current .env settings
- `npm start:dev` - Force development environment
- `npm start:staging` - Force staging environment  
- `npm start:prod` - Force production environment
- `npm build:dev` - Build for development
- `npm build:staging` - Build for staging
- `npm build:prod` - Build for production

## Customization

### Adding New Components

1. Create a new folder in `src/components/` with your component name
2. Add your component file (e.g., `ComponentName.tsx`)
3. Add styles file (e.g., `ComponentName.styles.ts`)
4. Export your component

Example:
```typescript
// src/components/MyComponent/MyComponent.tsx
import React from 'react';
import { MyComponentStyles } from './MyComponent.styles';

const MyComponent: React.FC = () => {
    const classes = MyComponentStyles();
    
    return (
        <div className={classes.container}>
            {/* Your component content */}
        </div>
    );
};

export default MyComponent;
```

### Adding New Redux Slices

1. Create a new slice file in `src/store/slices/`
2. Add the slice to the store configuration in `src/store/index.ts`

Example:
```typescript
// src/store/slices/mySlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MyState {
    data: any[];
    loading: boolean;
}

const initialState: MyState = {
    data: [],
    loading: false,
};

const mySlice = createSlice({
    name: 'mySlice',
    initialState,
    reducers: {
        setData: (state, action: PayloadAction<any[]>) => {
            state.data = action.payload;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
    },
});

export const { setData, setLoading } = mySlice.actions;
export default mySlice.reducer;
```

### Customizing Theme

Modify the theme configuration in `src/theme/index.ts`:

```typescript
const customTheme: ThemeOptions = {
    palette: {
        primary: {
            main: '#your-color',
        },
        // ... other theme options
    },
    // ... other theme configurations
};
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.