# System Reset and Stabilization Guide

This guide provides comprehensive instructions for resetting and stabilizing the LockerRoom system data integrity while preserving system admin accounts and ensuring proper school-student linkages.

## 🎯 Overview

The system reset and stabilization process includes:

1. **Database Reset (Safe Deletion)** - Removes all data except system admins
2. **System Admin Powers** - Adds school management capabilities
3. **Verification & Testing** - Creates test data and verifies integrity
4. **Extra Stability** - Adds validation and logging

## 🚀 Quick Start

To perform a complete system reset and stabilization:

```bash
npm run reset-and-stabilize-system
```

This single command will:
- Reset the database (preserving system admins)
- Create test schools and students
- Verify system integrity
- Report on success/failure

## 📋 Individual Scripts

### 1. Database Reset
```bash
npm run reset-system-data
```
- Safely deletes all records except system admins
- Preserves system admin credentials
- Logs the reset operation

### 2. Test Data Seeding
```bash
npm run seed-test-data
```
- Creates 2 test schools (Test Academy A & B)
- Creates school admins for each school
- Creates 3 students per school
- Verifies proper linkages

### 3. System Integrity Verification
```bash
npm run verify-system-integrity
```
- Runs comprehensive integrity checks
- Verifies school-student linkages
- Checks for cross-linking issues
- Reports detailed results

## 🏫 Test Data Created

### Schools
- **Test Academy A** (Premium Plan, 200 students max)
  - Address: 123 Education Street, Learning City, LC 12345
  - Contact: admin@testacademya.edu, (555) 123-4567

- **Test Academy B** (Standard Plan, 150 students max)
  - Address: 456 Knowledge Avenue, Wisdom Town, WT 67890
  - Contact: admin@testacademyb.edu, (555) 987-6543

### School Admins
- **Alice Johnson** (Principal at Test Academy A)
  - Email: alice.johnson@testacademya.edu
  - Password: admin123

- **Bob Smith** (Principal at Test Academy B)
  - Email: bob.smith@testacademyb.edu
  - Password: admin123

### Students

#### Test Academy A Students
- **Alex Thompson** - Basketball Point Guard (11th Grade)
  - Email: alex.thompson@testacademya.edu
  - Password: student123

- **Sarah Davis** - Soccer Forward (10th Grade)
  - Email: sarah.davis@testacademya.edu
  - Password: student123

- **Mike Wilson** - Football Quarterback (12th Grade)
  - Email: mike.wilson@testacademya.edu
  - Password: student123

#### Test Academy B Students
- **Emma Brown** - Volleyball Setter (11th Grade)
  - Email: emma.brown@testacademyb.edu
  - Password: student123

- **James Miller** - Baseball Pitcher (10th Grade)
  - Email: james.miller@testacademyb.edu
  - Password: student123

- **Lisa Garcia** - Track & Field Sprinter (12th Grade)
  - Email: lisa.garcia@testacademyb.edu
  - Password: student123

## 🔧 System Admin Features Added

### School Management API Endpoints

#### Disable School
```http
PUT /api/system-admin/schools/:schoolId/disable
```
- Disables school and all associated accounts
- Prevents login for school admins and students
- Preserves data for potential reactivation

#### Delete School Permanently
```http
DELETE /api/system-admin/schools/:schoolId
```
- Permanently deletes school and all associated data
- Cascading delete of students, admins, posts, etc.
- Cannot be undone

#### Enhanced Schools List
```http
GET /api/system-admin/schools
```
- Returns schools with student/admin/post counts
- Includes management statistics
- Sorted by creation date

### Frontend Management Options

The system admin dashboard now includes:
- **Disable School** button in school dropdown menus
- **Delete School** button with confirmation dialog
- **Manage Schools** section in system management
- Real-time loading states and error handling

## 🔍 Verification Checks

The system integrity verification includes:

1. **System Admin Preservation** - Ensures system admins are preserved
2. **Test Schools Creation** - Verifies both test schools exist
3. **School Admin Linkages** - Confirms admins are linked to correct schools
4. **Student-School Linkages** - Verifies students are linked to correct schools
5. **Cross-School Linkage Prevention** - Ensures no cross-linking between schools
6. **School Isolation** - Confirms correct student/admin counts per school
7. **Data Consistency** - Checks for orphaned records

## 🛡️ Security & Validation

### Backend Validation Added
- School admins can only create students for their own school
- Student schoolId must match admin's schoolId
- Request body schoolId validation prevents cross-school operations

### Logging & Transparency
- All school assignment events are logged to `analytics_logs`
- Detailed metadata includes who assigned what to which school
- System reset operations are logged with timestamps
- Verification results are stored for audit purposes

## 📊 Database Schema Changes

### Migration: `2025-01-27_system_data_reset.sql`
- Safe deletion of all tables except system admins
- Maintains referential integrity during deletion
- Logs reset operations for audit trail

### Enhanced Validation
- Student creation validates schoolId matches admin's schoolId
- School assignment events are logged with full context
- Cross-school operations are prevented at the API level

## 🚨 Troubleshooting

### Common Issues

#### "No system admin accounts found"
- Ensure system admins exist before running reset
- Check that users with `role = 'system_admin'` exist in database

#### "School linkage errors detected"
- Run verification script to identify specific issues
- Check that students are properly linked to schools
- Verify no cross-linking between schools

#### "Database connection failed"
- Ensure database is running and accessible
- Check connection string in environment variables
- Verify database permissions

### Recovery Steps

1. **If reset fails mid-process:**
   ```bash
   # Check database state
   npm run verify-system-integrity
   
   # Re-run reset if needed
   npm run reset-system-data
   ```

2. **If test data seeding fails:**
   ```bash
   # Check what was created
   npm run verify-system-integrity
   
   # Re-run seeding
   npm run seed-test-data
   ```

3. **If verification fails:**
   - Review detailed error messages
   - Check specific failed tests
   - Fix underlying issues before proceeding

## 📈 Monitoring & Maintenance

### Regular Checks
- Run `npm run verify-system-integrity` periodically
- Monitor analytics logs for school assignment events
- Check for orphaned records or linkage issues

### System Admin Responsibilities
- Monitor school registration and management
- Use disable/delete features responsibly
- Review verification reports regularly

## 🔄 Future Enhancements

Potential improvements for the system:
- Automated integrity checks on schedule
- Email notifications for system admin actions
- Bulk operations for school management
- Advanced reporting and analytics
- Integration with external school management systems

## 📞 Support

For issues or questions regarding the system reset and stabilization process:
1. Check this documentation first
2. Review error logs and verification results
3. Run individual scripts to isolate issues
4. Contact system administrators for assistance

---

**Note:** This system reset process is designed for development and testing environments. Use caution when applying to production systems and always backup data before running reset operations.
