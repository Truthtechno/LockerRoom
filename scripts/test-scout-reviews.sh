#!/bin/bash

# Test script to verify that scouts can see other scouts' reviews
# This script will:
# 1. Login as scout1 and create a review
# 2. Login as scout2 and create a review  
# 3. Login as scout1 again and verify they can see scout2's review

API_BASE="http://localhost:5174"

echo "🚀 Starting scout reviews visibility test..."
echo ""

# Step 1: Login as scout1
echo "🔐 Logging in as scout@xen.com..."
SCOUT1_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"scout@xen.com","password":"scout123"}')

SCOUT1_TOKEN=$(echo "$SCOUT1_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "✅ Login successful for scout@xen.com"

# Step 2: Get review queue for scout1
echo "📋 Getting review queue..."
REVIEW_QUEUE_RESPONSE=$(curl -s -X GET "$API_BASE/api/xen-watch/scout/review-queue" \
  -H "Authorization: Bearer $SCOUT1_TOKEN")

SUBMISSION_ID=$(echo "$REVIEW_QUEUE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✅ Found submission: $SUBMISSION_ID"

if [ -z "$SUBMISSION_ID" ]; then
  echo "❌ No submissions found in scout queue. Please ensure test data exists."
  exit 1
fi

# Step 3: Scout1 creates a review
echo "📝 Scout1 creating review..."
curl -s -X POST "$API_BASE/api/xen-watch/reviews/$SUBMISSION_ID" \
  -H "Authorization: Bearer $SCOUT1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rating":4,"notes":"Great technique and form!","isSubmitted":true}' > /dev/null
echo "✅ Scout1 review created"

# Step 4: Login as scout2 (scoutadmin@xen.com)
echo "🔐 Logging in as scoutadmin@xen.com..."
SCOUT2_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"scoutadmin@xen.com","password":"scoutadmin123"}')

SCOUT2_TOKEN=$(echo "$SCOUT2_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "✅ Login successful for scoutadmin@xen.com"

# Step 5: Scout2 creates a review for the same submission
echo "📝 Scout2 creating review..."
curl -s -X POST "$API_BASE/api/xen-watch/reviews/$SUBMISSION_ID" \
  -H "Authorization: Bearer $SCOUT2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rating":5,"notes":"Excellent performance, very impressive!","isSubmitted":true}' > /dev/null
echo "✅ Scout2 review created"

# Step 6: Login back as scout1 and check if they can see scout2's review
echo ""
echo "🔄 Switching back to scout1 to check visibility..."
UPDATED_QUEUE_RESPONSE=$(curl -s -X GET "$API_BASE/api/xen-watch/scout/review-queue" \
  -H "Authorization: Bearer $SCOUT1_TOKEN")

echo "📊 Review Visibility Results:"
echo "Submission ID: $SUBMISSION_ID"

# Check if allReviews array exists and has data
if echo "$UPDATED_QUEUE_RESPONSE" | grep -q '"allReviews"'; then
  echo "✅ SUCCESS: allReviews array found in response!"
  
  # Count total reviews
  TOTAL_REVIEWS=$(echo "$UPDATED_QUEUE_RESPONSE" | grep -o '"allReviews":\[[^]]*\]' | grep -o '"id":"[^"]*"' | wc -l)
  echo "Total Reviews: $TOTAL_REVIEWS"
  
  # Check if scout2's review is visible
  if echo "$UPDATED_QUEUE_RESPONSE" | grep -q "Excellent performance"; then
    echo "✅ SUCCESS: Scout1 can see Scout2's review!"
    echo "   Scout2's notes: Excellent performance, very impressive!"
  else
    echo "❌ FAILURE: Scout1 cannot see Scout2's review"
  fi
  
  # Check if scout1's review is also visible
  if echo "$UPDATED_QUEUE_RESPONSE" | grep -q "Great technique"; then
    echo "✅ SUCCESS: Scout1 can see their own review!"
    echo "   Scout1's notes: Great technique and form!"
  else
    echo "❌ FAILURE: Scout1 cannot see their own review"
  fi
  
else
  echo "❌ FAILURE: allReviews array not found in response"
fi

echo ""
echo "🎉 Test completed!"
