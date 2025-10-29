# LockerRoom - School Sports Social Platform

**LockerRoom** is a comprehensive school-based sports social platform designed for XEN Sports Armoury. Built to empower student-athletes to showcase their skills, connect with their community, and receive professional scouting feedback through an Instagram-like social media experience tailored for sports.

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-316192?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express)](https://expressjs.com/)

## 🎯 Goals

- **Student-Athlete Empowerment** - Provide a platform for students to showcase their sports achievements and highlights
- **Community Building** - Connect students, parents, coaches, and sports enthusiasts in a safe, school-managed environment
- **Professional Scouting** - XEN Watch system enables professional scouts to review and rate student submissions
- **School Management** - Comprehensive admin tools for schools to manage students, content, alumnouncements
- **Scalable Architecture** - Modern tech stack designed for performance and scalability
- **Engagement & Analytics** - Track student engagement, views, likes, comments, and saves with detailed analytics

## ✨ Features

### 🏫 Core Platform Modules

#### 👥 **User Roles & Permissions**
- **System Admin (XEN)** - Full platform control, school approvals, global analytics
- **School Admin** - School-specific management, student enrollment, announcements
- **Students** - Content creation, profile management, social interactions
- **Viewers** - Browse content, follow students, interact with posts
- **Scout Admin** - Manage scout assignments and review submissions
- **XEN Scouts** - Professional scouts review and rate student submissions

#### 📱 **Student Portal**
- **📊 Dashboard** - Personalized feed with posts from followed students and school announcements
- **📸 Content Creation** - Upload images and videos to Cloudinary with real-time processing
- **👤 Profile Management** - Complete profile with bio, position, sport, role number, and cover photos
- **📈 Statistics** - Track views, likes, comments, saves, and follower counts
- **🔍 Discovery** - Search for students, schools, and content across the platform
- **💾 Saved Posts** - Save favorite posts for later viewing
- **📝 Following Feed** - Curated feed of content from followed students
- **🏆 XEN Watch** - Submit videos for professional scout review and feedback

#### 🏛️ **School Admin Portal**
- **👨‍🎓 Student Management** - Enroll students with OTP, manage profiles, view student analytics
- **📢 Announcements** - Create school-wide announcements with media support
- **📊 School Analytics** - Monitor student engagement, posts, likes, and activity metrics
- **🔍 Student Search** - Quick search and filter capabilities for students
- **⚙️ School Settings** - Configure school profile, subscription plans, and student limits
- **📋 Live Reports** - View and manage reported content and user issues

#### 🔧 **System Admin Portal**
- **🏫 School Management** - Approve/reject school applications, manage subscriptions
- **👥 User Management** - Manage all platform users and administrators
- **📊 Platform Analytics** - Global statistics and insights across all schools
- **⚙️ System Configuration** - Platform-wide settings, branding, appearance customization
- **🔐 Admin Management** - Create and assign admin roles with granular permissions
- **📢 Global Announcements** - Create announcements visible to all schools or specific schools
- **💳 Payment Configuration** - Configure Stripe payment settings and XEN Watch pricing

#### ⭐ **XEN Watch - Professional Scouting System**
- **📤 Student Submissions** - Students submit highlight videos for professional review
- **👀 Scout Review Queue** - Scouts review submissions and provide ratings (1-5) and feedback
- **📝 Draft Reviews** - Scouts can save draft reviews before final submission
- **🎯 Final Feedback** - Scout admins compile reviews and send final feedback to students
- **📊 Analytics** - Track submission statistics, average ratings, and scout activity
- **💳 Payment Integration** - Optional payment processing for submission reviews

### 🛠️ Technical Capabilities
- **📱 Responsive Design** - Mobile-first approach with seamless cross-device experience
- **⚡ Real-time Processing** - Cloudinary integration for automatic video/image optimization
- **🔐 Secure Authentication** - JWT-based authentication with role-based access control
- **💾 Advanced Database** - PostgreSQL with Drizzle ORM for type-safe database operations
- **📊 Analytics Dashboard** - Comprehensive analytics with Recharts visualization
- **🔔 Announcement System** - Multi-scope announcements (global, school, staff)
- **🔍 Advanced Search** - Full-text search across students, schools, and content
- **📸 Media Management** - Cloudinary CDN for fast, optimized media delivery
- **🔄 Progressive Feed Loading** - Infinite scroll with optimized pagination
- **🌓 Theme Support** - Light/dark mode with system appearance configuration

### нюансы Features

#### Content Engagement
- **❤️ Likes** - Express appreciation for student posts
- **💬 Comments** - Engage in conversations on posts
- **🔖 Saves** - Save posts to personal collections
- **👁️ Views** - Automatic view tracking for analytics
- **👥 Follow System** - Follow students and build your network
- **📊 Post Statistics** - Real-time engagement metrics

#### Announcement System
- **🌍 Global Announcements** - System-wide announcements visible to all students
- **🏫 School Announcements** - School-specific announcements managed by school admins
- **👔 Staff Announcements** - Admin-only announcements (hidden from student feeds)
- **📎 Media Support** - Attach images or videos to announcements
- **🎨 Visual Distinction** - Special styling to distinguish announcements from regular posts

## 🛠️ Tech Stack

- **Frontend**: React 18.3, TypeScript, Vite, TailwindCSS, shadcn/ui, Wouter
- **Backend**: Node.js, Express.js, TypeScript, ES Modules
- **Database**: PostgreSQL (Neon serverless), Drizzle ORM
- **Authentication**: JWT (JSON Web Tokens), Passport.js
- **File Storage**: Cloudinary (images, videos, media optimization)
- **Payments**: Stripe (XEN Watch submissions)
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form, Zod validation
- **Charts**: Recharts for analytics visualization
- **UI Components**: Radix UI primitives via shadcn/ui

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18.0 or later
- **PostgreSQL** 13 or later (or Neon serverless account)
- **npm** or **yarn** package manager
- **Cloudinary** account (for media uploads)

### Installation Steps

1. **📥 Clone the Repository**
   ```bash
   git clone https://github.com/your-org/lockerroom
   cd lockerroom
   ```

2. **📦 Install Dependencies**
   ```bash
   npm install
   ```

3. **⚙️ Environment Configuration**
   
   Create a `.env` file in the root directory:
   ```env
   # Database Configuration
   DATABASE_URL="postgresql://username:password@localhost:5432/lockerroom"
   
   # JWT Authentication
   JWT_SECRET="your-secure-jwt-secret-key-change-in-production"
   
   # Server Configuration
   PORT=5174
   NODE_ENV=development
   CLIENT_ORIGIN="http://localhost:5173"
   
   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
   CLOUDINARY_API_KEY="your-cloudinary-api-key"
   CLOUDINARY_API_SECRET="your-cloudinary-api-secret"
   
   # Stripe Configuration (Optional - for XEN Watch payments)
   STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
   STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key"
   ```

4. **🗄️ Database Setup**
   ```bash
   # Push schema to database
   npm run db:push
   
   # Seed with demo data (optional)
   npm run seed
   ```

5. **🏃‍♂️ Start Development Server**
   ```bash
   # Start both frontend and backend
   npm run dev:both
   
   # Or start separately:
   npm run dev        # Backend only (port 5174)
   npm run dev:client # Frontend only (port 5173)
   ```

6. **🌐 Access the Application**
   Open your browser and navigate to [http://localhost:5174](http://localhost:5174)

## 👥 Demo Accounts

The system comes pre-configured with demo accounts for testing:

### 🔧 System Administrator
- **Email**: `admin@lockerroom.com`
- **Password**: `admin123`
- **Role**: System Admin
- **Access**: Full platform control, school management, analytics

### 🏫 School Administrator
- **Email**: `principal@lincoln.edu`
- **Password**: `principal123`
- **School**: Lincoln High School
- **Access**: Student management, announcements, school analytics

### 👨‍🎓 Students
- **Email**: `marcus.rodriguez@student.com`
- **Password**: `student123`
- **Position**: Midfielder (#10)
- **Access**: Content creation, social interactions, XEN Watch submissions

- **Email**: `sophia.chen@student.com`
- **Password**: `student123`
- **Position**: Forward (#7)

### 👀 Viewers
- **Email**: `sarah.johnson@viewer.com`
- **Password**: `viewer123`
- **Access**: Browse content, follow students, comment on posts

> **Note**: Run `npm run reseed` to reset demo data to default state

## 🎨 Design System

### 🎨 Color Palette
- **Primary Colors**: Customizable via System Configuration
- **Default Primary**: Gold (`#FFD700`) - Representing excellence and achievement
- **Default Secondary**: Black - Professional contrast
- **Success**: Green - Positive actions and achievements
- **Warning**: Yellow/Orange - Announcements and important notices
- **Error**: Red - Errors and destructive actions

### 📝 Typography System
- **Font Family**: Inter (system fallback)
- **Responsive Sizing**: Scales appropriately across devices
- **Headings**: Bold weights for emphasis
- **Body Text**: Optimized for readability

### 🧩 Component Library
- **shadcn/ui** - Modern, accessible component primitives
- **Radix UI** - Unstyled, accessible component primitives
- **TailwindCSS** - Utility-first CSS framework
- **Custom Components** - Sports-focused UI elements

## 📱 Mobile Responsiveness

The application is fully responsive with:
- **Mobile-first design** approach
- **Touch-friendly** interface elements
- **Optimized navigation** for mobile devices (bottom nav bar)
- **Responsive media** display (images and videos)
- **Progressive Web Appance** capabilities

## 🔧 Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed development setup, project structure, and coding guidelines.

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment instructions for various platforms including Vercel, Railway, and self-hosted options.

## 📊 Database Schema

The application uses PostgreSQL with the following main entities:

### Core Tables
- **users** - Central authentication table with role-based access
- **students** - Student profiles with sports information
- **schools** - School information and subscription management
- **school_admins** - School administrator profiles
- **system_admins** - System administrator profiles
- **viewers** - Public viewer profiles

### Content Tables
- **posts** - User posts and announcements (unified table)
- **post_likes** - Like interactions
- **post_comments** - Comment threads
- **post_views** - View tracking for analytics
- **saved_posts** - User saved content

### Social Tables
- **user_follows** - User-to-user following relationships
- **student_followers** - Student-specific follower tracking

### XEN Watch Tables
- **submissions** - Student video submissions for review
- **submission_reviews** - Scout reviews and ratings
- **submission_final_feedback** - Final compiled feedback
- **scout_profiles** - Scout profile information

### System Tables
- **system_settings** - Platform-wide configuration
- **system_branding** - Customizable branding assets
- **system_appearance** - Theme and appearance settings
- **system_payment** - Payment gateway configuration
- **school_applications** - School registration requests

## 🔐 Security Features

- **JWT Authentication** with secure token handling and expiration
- **Role-based Access Control** (RBAC) with granular permissions
- **Input Validation** with Zod schemas
- **SQL Injection Protection** via Drizzle ORM parameterized queries
- **XSS Protection** with React's built-in escaping and input sanitization
- **Rate Limiting** on authentication endpoints
- **Helmet.js** for security headers
- **CORS Configuration** for controlled cross-origin access
- **Secure Password Hashing** with bcrypt
- **Session Management** with PostgreSQL-backed sessions

## 📈 Performance Optimizations

- **Cloudinary CDN** for optimized media delivery
- **Progressive Image Loading** with lazy loading
- **Infinite Scroll** with optimized pagination
- **Database Indexing** on frequently queried fields
- **Query Optimization** with efficient joins and aggregations
- **Code Splitting** for smaller bundle sizes
- **Caching Strategies** for frequently accessed data
- **Compression Middleware** for API responses

## 🧪 Testing

```bash
# Run API tests
npm run test:api

# Run end-to-end tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run all tests
npm run test:all
```

## 📚 Documentation

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development setup and guidelines
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment instructions
- **[docs/demo_credentials.md](./docs/demo_credentials.md)** - Demo account information
- **[docs/system_inputs_and_actions.md](./docs/system_inputs_and_actions.md)** - API documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Contact

### 📞 Get Help
- **📧 Email**: [support@xensportsarmoury.com](mailto:support@xensportsarmoury.com)
- **📚 Documentation**: See [docs](./docs) folder
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/your-org/lockerroom/issues)

### 🤝 Business Inquiries
- **Partnerships**: [partnerships@xensportsarmoury.com](mailto:partnerships@xensportsarmoury.com)
- **School Onboarding**: [onboarding@xensportsarmoury.com](mailto:onboarding@xensportsarmoury.com)

## 🙏 Acknowledgments

### 🏆 Core Contributors
- **Bryan Amooti** - Lead Developer & System Architect
- **XEN Sports Armoury Team** - Platform vision and requirements

### 🛠️ Technology Partners
- **React Team** - Revolutionary UI framework
- **Vercel** - Deployment and hosting platform
- **Cloudinary** - Media optimization and CDN
- **Neon** - Serverless PostgreSQL hosting
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful component library
- **Drizzle ORM** - Type-safe database toolkit

---

<div align="center">

**🚀 Built with ❤️ for Student-Athletes**

**LockerRoom - Empowering the Next Generation of Sports Stars**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/your-org/lockerroom)
[![Documentation](https://img.shields.io/badge/Documentation-4A90E2?style=for-the-badge)](./docs)

**XEN Sports Armoury - LockerRoom Platform**

</div>

