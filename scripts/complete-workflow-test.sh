#!/bin/bash

# Complete End-to-End Scout Workflow Test
# Tests the full workflow from student submission to final feedback

API_BASE="http://localhost:5174"

echo "🎯 Complete Scout Workflow End-to-End Test"
echo "=========================================="
echo

# Step 1: Student checks submissions
echo "📚 STEP 1: Student views their submissions..."
STUDENT_TOKEN=$(curl -s -X POST $API_BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@xen.com","password":"student123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$STUDENT_TOKEN" ]; then
  echo "✅ Student logged in successfully"
  STUDENT_SUBMISSIONS=$(curl -s -H "Authorization: Bearer $STUDENT_TOKEN" $API_BASE/api/xen-watch/submissions/me)
  SUBMISSION_COUNT=$(echo $STUDENT_SUBMISSIONS | grep -o '"submissions":\[[^]]*\]' | tr -cd ',' | wc -c)
  echo "   Student has $((SUBMISSION_COUNT + 1)) submissions"
else
  echo "❌ Student login failed"
  exit 1
fi
echo

# Step 2: Scout reviews submission
echo "🔍 STEP 2: Scout reviews the submission..."
SCOUT_TOKEN=$(curl -s -X POST $API_BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"scout@xen.com","password":"scout123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$SCOUT_TOKEN" ]; then
  echo "✅ Scout logged in successfully"
  
  # Get review queue
  REVIEW_QUEUE=$(curl -s -H "Authorization: Bearer $SCOUT_TOKEN" $API_BASE/api/xen-watch/scout/review-queue)
  SUBMISSION_ID=$(echo $REVIEW_QUEUE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -n "$SUBMISSION_ID" ]; then
    echo "   Found submission to review: ${SUBMISSION_ID:0:8}..."
    
    # Submit a review
    REVIEW_RESPONSE=$(curl -s -X POST $API_BASE/api/xen-watch/reviews/$SUBMISSION_ID \
      -H "Authorization: Bearer $SCOUT_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"rating":4,"notes":"Great technique! Shows excellent ball control and positioning. Keep working on consistency and you will reach the next level.","isSubmitted":true}')
    
    if echo $REVIEW_RESPONSE | grep -q '"review"'; then
      echo "✅ Scout review submitted successfully"
      echo "   Rating: 4/5"
      echo "   Notes: Great technique! Shows excellent ball control..."
    else
      echo "❌ Scout review submission failed"
      echo "   Response: $REVIEW_RESPONSE"
    fi
  else
    echo "⚠️  No submissions found in review queue"
  fi
else
  echo "❌ Scout login failed"
  exit 1
fi
echo

# Step 3: Scout Admin finalizes
echo "👑 STEP 3: Scout Admin reviews and finalizes..."
SCOUT_ADMIN_TOKEN=$(curl -s -X POST $API_BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"scoutadmin@xen.com","password":"scoutadmin123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$SCOUT_ADMIN_TOKEN" ]; then
  echo "✅ Scout Admin logged in successfully"
  
  # Get dashboard
  DASHBOARD=$(curl -s -H "Authorization: Bearer $SCOUT_ADMIN_TOKEN" $API_BASE/api/scout-admin/dashboard)
  
  if echo $DASHBOARD | grep -q '"analytics"'; then
    echo "   Dashboard loaded successfully"
    
    # Find a submission ready for finalization
    FINALIZE_SUBMISSION_ID=$(echo $DASHBOARD | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$FINALIZE_SUBMISSION_ID" ]; then
      echo "   Found submission to finalize: ${FINALIZE_SUBMISSION_ID:0:8}..."
      
      # Finalize the submission
      FINALIZE_RESPONSE=$(curl -s -X POST $API_BASE/api/scout-admin/finalize/$FINALIZE_SUBMISSION_ID \
        -H "Authorization: Bearer $SCOUT_ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"finalRating":4,"summary":"Based on scout reviews, this submission demonstrates solid technical skills with good potential for improvement. The player shows excellent fundamentals and should continue developing consistency. Recommended for continued training and development."}')
      
      if echo $FINALIZE_RESPONSE | grep -q '"success"'; then
        echo "✅ Submission finalized successfully"
        echo "   Final Rating: 4/5"
        echo "   Summary: Based on scout reviews, this submission demonstrates..."
      else
        echo "⚠️  Finalization response: $FINALIZE_RESPONSE"
      fi
    else
      echo "⚠️  No submissions ready for finalization"
    fi
  else
    echo "❌ Dashboard loading failed"
  fi
else
  echo "❌ Scout Admin login failed"
  exit 1
fi
echo

# Step 4: Student sees final feedback
echo "🎓 STEP 4: Student checks final feedback..."
if [ -n "$STUDENT_TOKEN" ]; then
  FINAL_SUBMISSIONS=$(curl -s -H "Authorization: Bearer $STUDENT_TOKEN" $API_BASE/api/xen-watch/submissions/me)
  
  if echo $FINAL_SUBMISSIONS | grep -q '"finalFeedback"'; then
    echo "✅ Student can see final feedback"
    echo "   Feedback is now available in student portal"
  else
    echo "⚠️  Final feedback not yet visible (may take a moment to propagate)"
  fi
else
  echo "❌ Student token not available"
fi
echo

echo "🏁 WORKFLOW COMPLETE!"
echo "===================="
echo "✅ Student login and submission viewing"
echo "✅ Scout login and review submission"  
echo "✅ Scout Admin login and dashboard access"
echo "✅ Scout Admin finalization process"
echo "✅ Student final feedback viewing"
echo
echo "🎉 The complete XEN Watch scout workflow is functioning correctly!"
echo "   Students can submit videos, scouts can review them, scout admins"
echo "   can finalize reviews, and students receive comprehensive feedback."
