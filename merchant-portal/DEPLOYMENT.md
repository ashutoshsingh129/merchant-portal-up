# React Template Frontend Deployment Configuration

## Environment Variables
Make sure to set the following environment variables in your deployment platform:

- `REACT_APP_API_BASE_URL`: Your API base URL
- `REACT_APP_ENVIRONMENT`: Environment (development/staging/production)
- `REACT_APP_APP_NAME`: Application name
- `REACT_APP_VERSION`: Application version
- `REACT_APP_DEBUG`: Enable debug mode (optional, development only)

## Environment Setup

1. **Copy the sample environment file:**
   ```bash
   npm run env:setup
   ```

2. **Check current environment:**
   ```bash
   npm run env:check
   ```

3. **Modify `.env` file** with your deployment-specific values

## Build Commands

### Development
```bash
npm start
# or
npm run start:dev
```

### Staging
```bash
npm run build:staging
```

### Production
```bash
npm run build:prod
```

## Deployment Platforms

### Netlify
1. Connect your repository
2. Set build command: `npm run build:production`
3. Set publish directory: `build`
4. Add environment variables in site settings

### Vercel
1. Import your repository
2. Set build command: `npm run build:production`
3. Set output directory: `build`
4. Add environment variables in project settings

### AWS S3 + CloudFront
1. Build the project: `npm run build:production`
2. Upload `build` folder contents to S3 bucket
3. Configure CloudFront distribution
4. Set environment variables in your CI/CD pipeline

## Docker Deployment
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build:production

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```
