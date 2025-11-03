# Comprehensive Testing Guide - School Enrollment System

## Prerequisites

1. **Run Database Migration:**
   ```bash
   # Option 1: Run SQL file directly
   psql $DATABASE_URL -f migrations/2025-02-06_school_payment_records.sql
   
   # Option 2: Use TypeScript script (if DATABASE_URL is set)
   tsx scripts/run-enrollment-migration.ts
   ```

2. **Verify Migration:**
   ```sql
   -- All schools should have maxStudents = 10
   SELECT id, name, max_students FROM schools;
   
   -- Payment records table should exist
   SELECT COUNT(*) FROM school_payment_records;
   ```

3. **Start Server:**
   ```bash
   npm run dev
   ```

---

## Test Suite

### ✅ Test 1: Create School with Student Limit

**Steps:**
1. Log in as System Admin
2. Navigate to "Create School"
3. Fill in form:
   - School Name: "Test Academy"
   - Contact Email: "test@academy.com"
   - Payment Amount: "500.00"
   - Payment Frequency: "monthly"
   - **Student Limit: "5"**
4. Submit form

**Expected Results:**
- ✅ School created successfully
- ✅ Success modal shows student limit = 5
- ✅ In database: `max_students = 5`
- ✅ Payment record created in `school_payment_records` table

**Verify:**
```sql
SELECT name, max_students FROM schools WHERE name = 'Test Academy';
SELECT * FROM school_payment_records WHERE school_id = (SELECT id FROM schools WHERE name = 'Test Academy');
```

---

### ✅ Test 2: Student Enrollment Limit Enforcement

**Setup:**
- School with maxStudents = 5

**Steps:**
1. Log in as School Admin for the test school
2. Navigate to "Add Student"
3. Verify enrollment status card shows:
   - Current: 0/5
   - Available: 5 slots
4. Add 5 students (one by one)
5. Try to add 6th student

**Expected Results:**
- ✅ First 5 students added successfully
- ✅ Enrollment status updates: 1/5, 2/5, ..., 5/5
- ✅ At 5/5, progress bar turns red
- ✅ Red alert banner appears: "Enrollment Limit Reached"
- ✅ "Add Student" button is disabled
- ✅ Attempting to add 6th student shows error:
   - Frontend: Toast error message
   - Backend: 403 error with message about limit reached

**API Test:**
```bash
# Add 6th student (should fail)
curl -X POST http://localhost:5173/api/school-admin/add-student \
  -H "Authorization: Bearer <token>" \
  -F "name=Student6" \
  -F "email=student6@test.com" \
  -F "schoolId=<schoolId>"
  
# Expected: 403 Forbidden
# Response: { "error": { "code": "enrollment_limit_reached", "message": "..." } }
```

---

### ✅ Test 3: School Admin Dashboard Enrollment Display

**Steps:**
1. Log in as School Admin
2. View dashboard
3. Check enrollment card

**Expected Results:**
- ✅ "Student Enrollment" card visible
- ✅ Shows "X / Y" format
- ✅ Progress bar with color coding:
  - Green: < 80%
  - Yellow: 80-95%
  - Red: 95-100%
- ✅ Shows available slots
- ✅ Shows utilization percentage
- ✅ Alert banner appears when:
  - Approaching (≥80%): Yellow warning
  - At limit (100%): Red error

**Test Scenarios:**
- School with 0/10 students → Green, no alert
- School with 8/10 students → Yellow progress, yellow alert
- School with 10/10 students → Red progress, red alert

---

### ✅ Test 4: Manage Schools - Dropdown Menu

**Steps:**
1. Log in as System Admin
2. Navigate to "Manage Schools"
3. Click three-dot menu (MoreHorizontal icon) on any school
4. Verify dropdown menu options

**Expected Results:**
- ✅ Dropdown shows:
  - View School Details (with Eye icon)
  - Update School Information (with Edit icon)
  - School Payments (with CreditCard icon)
  - Renew Subscription (with RefreshCw icon)
  - Separator line
  - Disable/Enable School (with Ban/Power icon)
  - Delete School (with Trash2 icon)

---

### ✅ Test 5: Renew Subscription (Separated from Payment)

**Steps:**
1. In Manage Schools, click "Renew Subscription" for a school
2. Modal opens showing:
   - Current subscription info (frequency, amount)
   - Renewal date picker (defaults to today)
3. Submit renewal

**Expected Results:**
- ✅ Modal shows current payment frequency and amount (read-only)
- ✅ Renewal date defaults to today
- ✅ Can change renewal date
- ✅ Renewal calculates expiration: `renewalDate + paymentFrequency`
- ✅ Updates `subscriptionExpiresAt` in database
- ✅ Updates `lastPaymentDate` to renewal date
- ✅ **Does NOT** create payment record (separate action)
- ✅ Success toast shown

**Verify:**
```sql
SELECT subscription_expires_at, last_payment_date, payment_frequency 
FROM schools 
WHERE id = '<schoolId>';
```

---

### ✅ Test 6: Payment Recording (Separate from Renewal)

**API Test:**
```bash
# Record a payment
curl -X POST http://localhost:5173/api/system-admin/schools/<schoolId>/payments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentAmount": "600.00",
    "paymentFrequency": "monthly",
    "paymentType": "renewal",
    "notes": "Monthly renewal payment"
  }'

# Expected: 200 OK
# Response: { "success": true, "paymentRecord": { ... } }
```

**Steps:**
1. Use API or implement UI (when modal is ready)
2. Record payment with type "renewal"

**Expected Results:**
- ✅ Payment record created in `school_payment_records`
- ✅ **Does NOT** update subscription expiration
- ✅ **Does NOT** restart timer
- ✅ Payment history available via GET endpoint

**Verify:**
```sql
SELECT * FROM school_payment_records WHERE school_id = '<schoolId>' ORDER BY recorded_at DESC;
```

---

### ✅ Test 7: Payment History

**API Test:**
```bash
curl http://localhost:5173/api/system-admin/schools/<schoolId>/payments \
  -H "Authorization: Bearer <token>"

# Expected: 200 OK
# Response: { "success": true, "payments": [...] }
```

**Expected Results:**
- ✅ Returns all payment records for school
- ✅ Ordered by date (newest first)
- ✅ Includes recorded by user name
- ✅ Shows payment type, amount, frequency

---

### ✅ Test 8: Update Student Limit via Payment

**API Test:**
```bash
# Increase limit from 10 to 20
curl -X POST http://localhost:5173/api/system-admin/schools/<schoolId>/payments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentAmount": "1000.00",
    "paymentFrequency": "monthly",
    "paymentType": "student_limit_increase",
    "studentLimitBefore": 10,
    "studentLimitAfter": 20,
    "notes": "Increased capacity"
  }'
```

**Expected Results:**
- ✅ Payment record created with type "student_limit_increase"
- ✅ School's `maxStudents` updated to 20
- ✅ School admin can now enroll more students

**Verify:**
```sql
SELECT max_students FROM schools WHERE id = '<schoolId>';
SELECT * FROM school_payment_records WHERE payment_type = 'student_limit_increase';
```

---

### ✅ Test 9: Enrollment Status Endpoint

**API Test:**
```bash
curl http://localhost:5173/api/school-admin/enrollment-status \
  -H "Authorization: Bearer <schoolAdminToken>"

# Expected: 200 OK
# Response: {
#   "success": true,
#   "enrollmentStatus": {
#     "currentCount": 5,
#     "maxStudents": 10,
#     "availableSlots": 5,
#     "utilizationPercentage": 50.0,
#     "warningLevel": "none",
#     "canEnroll": true
#   }
# }
```

**Expected Results:**
- ✅ Returns accurate enrollment status
- ✅ Calculates utilization correctly
- ✅ Sets warningLevel appropriately:
  - "none": < 80%
  - "approaching": 80-99%
  - "at_limit": 100%
- ✅ `canEnroll` is false when at limit

---

### ✅ Test 10: Create School Validation

**Test Cases:**

1. **Missing maxStudents:**
   - Submit form without student limit
   - Expected: Defaults to 10

2. **Invalid maxStudents (< 1):**
   - Enter 0 or negative
   - Expected: Validation error

3. **Invalid maxStudents (> 10000):**
   - Enter 10001
   - Expected: Validation error

4. **Valid range:**
   - Enter 5, 50, 1000, 10000
   - Expected: All accepted

---

## Edge Cases

### Edge Case 1: Concurrent Student Registration
- Two admins try to add student simultaneously when at 9/10
- Expected: One succeeds, one fails with limit error

### Edge Case 2: Decrease Limit Below Current Enrollment
```bash
# Try to decrease from 10 to 5 when school has 7 students
curl -X POST .../payments \
  -d '{
    "paymentType": "student_limit_decrease",
    "studentLimitAfter": 5
  }'
```
- Expected: 400 error - cannot decrease below current enrollment

### Edge Case 3: Renewal Without Payment Record
- Renew subscription without recording payment first
- Expected: Works (renewal is separate action)

### Edge Case 4: Payment Record Without Renewal
- Record payment but don't renew
- Expected: Payment recorded, subscription not extended

---

## Performance Tests

1. **Large Student Lists:**
   - School with 100+ students
   - Test enrollment status endpoint response time
   - Expected: < 200ms

2. **Many Payment Records:**
   - School with 50+ payment records
   - Test payment history endpoint
   - Expected: < 500ms

---

## Integration Test Scenarios

### Scenario 1: Complete School Lifecycle
1. Create school with limit = 5
2. Add 5 students (verify each increment)
3. Try to add 6th (verify blocked)
4. Record payment for limit increase
5. Update limit to 10
6. Add 5 more students (6-10)
7. Renew subscription

### Scenario 2: Payment & Renewal Workflow
1. Record renewal payment
2. Update payment frequency (if needed)
3. Renew subscription
4. Verify expiration calculated correctly

---

## Manual UI Testing Checklist

### Create School Page
- [ ] Student Limit field visible and functional
- [ ] Validation works (1-10000)
- [ ] Default value is 10
- [ ] Shows in success modal

### Add Student Page
- [ ] Enrollment alert banner visible
- [ ] Progress updates correctly
- [ ] Submit button disables at limit
- [ ] Error message clear when limit reached

### School Admin Dashboard
- [ ] Student Limit card visible
- [ ] Progress bar color changes correctly
- [ ] Alert banners appear at right thresholds
- [ ] Data refreshes automatically

### Manage Schools Page
- [ ] Dropdown menu has all options
- [ ] Actions trigger correct modals/actions
- [ ] Renew modal shows current subscription info
- [ ] Can renew subscription

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## Mobile Responsiveness

Test on:
- [ ] Mobile view (< 768px)
- [ ] Tablet view (768px - 1024px)
- [ ] Desktop view (> 1024px)

---

## Error Handling

Test error scenarios:
- [ ] Network failure during enrollment check
- [ ] Invalid school ID
- [ ] Missing authentication token
- [ ] Database connection error

---

## Security Tests

- [ ] School admin cannot bypass enrollment limit
- [ ] School admin cannot modify other schools
- [ ] System admin required for limit changes
- [ ] Payment records tracked with user ID

---

## Test Results Template

```
Test: [Test Name]
Date: [Date]
Status: ✅ PASS / ❌ FAIL
Notes: [Any issues found]

[Repeat for each test]
```

---

**Last Updated:** After implementation
**Status:** Ready for testing

