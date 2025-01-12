# Development Stack (Simplified)

## Frontend

### Core

- **Framework**: Next.js (latest)
- **Language**: TypeScript
- **UI Components**:
  - Tailwind CSS for styling
  - Headless UI for accessible components

### State Management & Data Fetching

- **Server State**: React Query
- **Real-time**: Socket.io-client
- **Forms**: React Hook Form

## Backend

### API & Server

- **API Routes**: Next.js API routes
- **Real-time**: Socket.io
- **Authentication**: NextAuth.js

### Database & Storage

- **Database**: PostgreSQL on AWS RDS (free tier db.t3.micro)
- **ORM**: Prisma
- **File Storage**: AWS S3 (basic bucket)

## AWS Infrastructure

- **Hosting**: AWS Amplify (full-stack hosting)
- **Database**: AWS RDS (PostgreSQL on free tier)
- **Storage**: AWS S3 (file uploads)

## Development Tools

### Code Quality

- **Linting**: ESLint
- **Formatting**: Prettier
- **Type Checking**: TypeScript

### Testing

- **Component Testing**: React Testing Library

## Development Environment

- **Package Manager**: npm
- **Node Version**: >= 18.x
- **Environment Variables**: dotenv

## Key Features

- Real-time messaging
- Basic file uploads
- User authentication
- Channel organization
- Message threading
- Emoji reactions
