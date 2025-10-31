# LockerRoom - Sports Social Platform

## Overview

LockerRoom is a full-stack school-based sports social platform for XEN Sports Armoury. The application allows students to upload and share sports content (videos/images), while providing engagement features like likes, comments, and saves. The platform supports multiple user roles including system administrators, school administrators, students, and public viewers, each with specific permissions and dashboard access.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Routing**: Wouter for client-side routing with role-based route protection
- **State Management**: TanStack Query for server state management and caching
- **Forms**: React Hook Form with Zod validation for type-safe form handling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: Simple credential-based authentication with localStorage (demo implementation)
- **API Design**: RESTful APIs with consistent error handling and logging middleware
- **File Storage**: Cloudinary integration for media upload and management

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Session Storage**: PostgreSQL-based sessions using connect-pg-simple
- **Media Storage**: Cloudinary for image and video assets

### Authentication and Authorization
- **Authentication Method**: Email/password with role-based access control
- **User Roles**: System admin, school admin, student, and public viewer
- **Route Protection**: Component-based route guards with role validation
- **Demo Accounts**: Pre-configured accounts for each user role for testing

### Database Schema Design
- **Users Table**: Core user information with role-based permissions and school associations
- **Schools Table**: School management with subscription plans and student limits
- **Students Table**: Extended student profiles with sports-specific information
- **Posts Table**: Media content with captions and metadata
- **Interactions**: Separate tables for likes, comments, and saves with proper relationships

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL serverless driver for database connectivity
- **drizzle-orm**: Type-safe ORM for PostgreSQL database operations
- **@tanstack/react-query**: Server state management and data fetching
- **@radix-ui/***: Headless UI component primitives for accessibility
- **wouter**: Lightweight React router for client-side navigation

### Development Tools
- **Vite**: Fast build tool with HMR and TypeScript support
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **esbuild**: Fast JavaScript bundler for production builds
- **tsx**: TypeScript execution for development server

### UI and Styling
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe variant API for component styling
- **clsx**: Conditional className utility
- **lucide-react**: Icon library for consistent iconography

### Form and Validation
- **react-hook-form**: Performant forms with easy validation
- **@hookform/resolvers**: Form validation resolvers
- **zod**: TypeScript-first schema validation
- **drizzle-zod**: Generate Zod schemas from Drizzle tables

### Media and Content
- **embla-carousel-react**: Touch-friendly carousel component
- **date-fns**: Date manipulation and formatting library

### Session Management
- **connect-pg-simple**: PostgreSQL session store for Express sessions
- **express-session**: Session middleware for user authentication state