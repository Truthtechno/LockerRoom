# Demo Data Injection Script

This script populates the LockerRoom database with comprehensive demo data for development and testing.

## Features

The script creates:
- **3 Schools**: Elite Soccer Academy, Champions Football Club, Rising Stars Academy
- **12+ Users**: System admin, school admins, students, and viewers
- **6 Student Profiles**: Complete with sports information, photos, and bios
- **Multiple Posts**: Each student gets 2-4 posts with realistic content
- **Interactions**: Likes, comments, saves, and follows between users
- **Realistic Data**: Professional profile pictures, detailed bios, and engaging captions

## Usage

### Prerequisites
- Ensure your `DATABASE_URL` environment variable is set
- Make sure the database is running and accessible

### Running the Script

**Option 1: Direct execution**
```bash
tsx scripts/inject-demo-data.ts
```

**Option 2: Via npm script (if available)**
```bash
npm run demo-data
```

### What the Script Does

1. **Clears existing data** - Removes all current data from the database
2. **Creates schools** - Sets up 3 demo soccer academies
3. **Creates users** - Generates users with different roles and hashed passwords
4. **Creates student profiles** - Complete athlete profiles with sports details
5. **Creates posts** - Multiple posts per student with realistic content
6. **Creates interactions** - Simulates user engagement with likes, comments, saves, and follows

## Demo Account Credentials

After running the script, you can log in with these accounts:

### System Admin
- **Email**: admin@lockerroom.com
- **Password**: Admin123!
- **Access**: Full system administration

### School Admin
- **Email**: school@lockerroom.com
- **Password**: School123!
- **Access**: Elite Soccer Academy management

### Student
- **Email**: student@lockerroom.com
- **Password**: Student123!
- **Access**: Diego Rodriguez (student athlete)

### Viewer
- **Email**: viewer@lockerroom.com
- **Password**: Viewer123!
- **Access**: John Viewer (platform viewer)

### Additional Accounts
Many additional accounts are created with either:
- **Password**: Demo123! (for students and additional school admins)
- **Password**: Viewer123! (for additional viewers)

## Data Statistics

The script typically creates:
- 3 schools
- 12+ users (1 system admin, 2 school admins, 6 students, 4+ viewers)
- 6 student profiles with complete information
- 12-24 posts (2-4 per student)
- 50+ likes across all posts
- 20+ comments with realistic messages
- 15+ saved posts
- 12+ follow relationships

## Important Notes

⚠️ **WARNING**: This script will **DELETE ALL EXISTING DATA** before inserting demo data. Only use in development environments.

✅ **Safe for Development**: Perfect for testing features, UI development, and demonstrations.

🔄 **Repeatable**: Can be run multiple times - each run starts with a clean slate.

## Troubleshooting

**Database Connection Error**
- Verify your `DATABASE_URL` environment variable
- Ensure the database server is running
- Check database permissions

**TypeScript Errors**
- Run `npm run check` to verify TypeScript compilation
- Ensure all dependencies are installed

**Permission Errors**
- Verify database user has CREATE, INSERT, DELETE permissions
- Check if tables exist and are accessible

## Development Usage

This script is ideal for:
- Setting up fresh development environments
- Testing new features with realistic data
- Demonstrating the platform to stakeholders
- QA testing with consistent data sets
- Learning the platform structure and relationships

## Script Structure

```
scripts/inject-demo-data.ts
├── Database connection setup
├── Demo data arrays (schools, users, students, posts)
├── Helper functions (password hashing, etc.)
├── Creation functions (schools, users, students, posts, interactions)
└── Main execution flow
```

The script is well-documented and modular, making it easy to modify or extend for specific testing needs.