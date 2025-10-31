#!/bin/bash

# Manual Scout Workflow Test Script
# Tests the key API endpoints to verify scout functionality

API_BASE="http://localhost:5174"

echo "🧪 Manual Scout Workflow Test"
echo "============================="
echo

# Test 1: Student Login
echo "1️⃣ Testing Student Login..."
STUDENT_TOKEN=$(curl -s -X POST $API_BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@xen.com","password":"student123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$STUDENT_TOKEN" ]; then
  echo "✅ Student login successful"
  echo "   Token: ${STUDENT_TOKEN:0:50}..."
else
  echo "❌ Student login failed"
fi
echo

# Test 2: Student /api/users/me
echo "2️⃣ Testing Student Profile..."
if [ -n "$STUDENT_TOKEN" ]; then
  STUDENT_PROFILE=$(curl -s -H "Authorization: Bearer $STUDENT_TOKEN" $API_BASE/api/users/me)
  STUDENT_ROLE=$(echo $STUDENT_PROFILE | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
  STUDENT_NAME=$(echo $STUDENT_PROFILE | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  
  if [ "$STUDENT_ROLE" = "student" ]; then
    echo "✅ Student profile loaded successfully"
    echo "   Name: $STUDENT_NAME"
    echo "   Role: $STUDENT_ROLE"
  else
    echo "❌ Student profile failed or wrong role: $STUDENT_ROLE"
  fi
else
  echo "⏭️ Skipping student profile test (no token)"
fi
echo

# Test 3: Scout Login
echo "3️⃣ Testing Scout Login..."
SCOUT_TOKEN=$(curl -s -X POST $API_BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"scout@xen.com","password":"scout123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$SCOUT_TOKEN" ]; then
  echo "✅ Scout login successful"
  echo "   Token: ${SCOUT_TOKEN:0:50}..."
else
  echo "❌ Scout login failed"
fi
echo

# Test 4: Scout /api/users/me
echo "4️⃣ Testing Scout Profile..."
if [ -n "$SCOUT_TOKEN" ]; then
  SCOUT_PROFILE=$(curl -s -H "Authorization: Bearer $SCOUT_TOKEN" $API_BASE/api/users/me)
  SCOUT_ROLE=$(echo $SCOUT_PROFILE | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
  SCOUT_NAME=$(echo $SCOUT_PROFILE | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  
  if [ "$SCOUT_ROLE" = "xen_scout" ]; then
    echo "✅ Scout profile loaded successfully"
    echo "   Name: $SCOUT_NAME"
    echo "   Role: $SCOUT_ROLE"
  else
    echo "❌ Scout profile failed or wrong role: $SCOUT_ROLE"
    echo "   Response: $SCOUT_PROFILE"
  fi
else
  echo "⏭️ Skipping scout profile test (no token)"
fi
echo

# Test 5: Scout Review Queue
echo "5️⃣ Testing Scout Review Queue..."
if [ -n "$SCOUT_TOKEN" ]; then
  REVIEW_QUEUE=$(curl -s -H "Authorization: Bearer $SCOUT_TOKEN" $API_BASE/api/xen-watch/scout/review-queue)
  SUBMISSIONS_COUNT=$(echo $REVIEW_QUEUE | grep -o '"submissions":\[[^]]*\]' | wc -c)
  
  if echo $REVIEW_QUEUE | grep -q '"submissions"'; then
    echo "✅ Scout review queue loaded successfully"
    echo "   Response contains submissions array"
  else
    echo "❌ Scout review queue failed"
    echo "   Response: $REVIEW_QUEUE"
  fi
else
  echo "⏭️ Skipping scout review queue test (no token)"
fi
echo

# Test 6: Scout Admin Login
echo "6️⃣ Testing Scout Admin Login..."
SCOUT_ADMIN_TOKEN=$(curl -s -X POST $API_BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"scoutadmin@xen.com","password":"scoutadmin123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$SCOUT_ADMIN_TOKEN" ]; then
  echo "✅ Scout Admin login successful"
  echo "   Token: ${SCOUT_ADMIN_TOKEN:0:50}..."
else
  echo "❌ Scout Admin login failed"
fi
echo

# Test 7: Scout Admin Dashboard
echo "7️⃣ Testing Scout Admin Dashboard..."
if [ -n "$SCOUT_ADMIN_TOKEN" ]; then
  ADMIN_DASHBOARD=$(curl -s -H "Authorization: Bearer $SCOUT_ADMIN_TOKEN" $API_BASE/api/scout-admin/dashboard)
  
  if echo $ADMIN_DASHBOARD | grep -q '"analytics"'; then
    echo "✅ Scout Admin dashboard loaded successfully"
    echo "   Response contains analytics data"
  else
    echo "❌ Scout Admin dashboard failed"
    echo "   Response: $ADMIN_DASHBOARD"
  fi
else
  echo "⏭️ Skipping scout admin dashboard test (no token)"
fi
echo

# Summary
echo "🏁 Test Summary"
echo "==============="

TESTS_PASSED=0
TOTAL_TESTS=7

[ -n "$STUDENT_TOKEN" ] && ((TESTS_PASSED++))
[ "$STUDENT_ROLE" = "student" ] && ((TESTS_PASSED++))
[ -n "$SCOUT_TOKEN" ] && ((TESTS_PASSED++))
[ "$SCOUT_ROLE" = "xen_scout" ] && ((TESTS_PASSED++))
echo $REVIEW_QUEUE | grep -q '"submissions"' && ((TESTS_PASSED++))
[ -n "$SCOUT_ADMIN_TOKEN" ] && ((TESTS_PASSED++))
echo $ADMIN_DASHBOARD | grep -q '"analytics"' && ((TESTS_PASSED++))

echo "Tests passed: $TESTS_PASSED/$TOTAL_TESTS"

if [ $TESTS_PASSED -eq $TOTAL_TESTS ]; then
  echo "🎉 ALL TESTS PASSED! Scout system is working correctly."
  exit 0
else
  echo "⚠️  Some tests failed. Please check the output above."
  exit 1
fi
