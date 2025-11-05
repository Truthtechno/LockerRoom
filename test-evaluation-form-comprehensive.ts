/**
 * Comprehensive Test Script for Evaluation Form Creation
 * Tests various scenarios to ensure form creation is working properly
 */

const API_BASE = process.env.API_BASE || "http://localhost:5000";
const TEST_TOKEN = process.env.TEST_TOKEN || "";

interface TestCase {
  name: string;
  data: any;
  expectedStatus: number;
  expectedError?: string;
  shouldSucceed?: boolean;
}

const testCases: TestCase[] = [
  // Test 1: Simple form with one short text field
  {
    name: "Simple form with short text field",
    data: {
      name: "Test Form 1",
      description: "Simple test form",
      fields: [
        {
          fieldType: "short_text",
          label: "Name",
          placeholder: "Enter your name",
          required: true,
          orderIndex: 0,
        },
      ],
    },
    expectedStatus: 201,
    shouldSucceed: true,
  },

  // Test 2: Form with paragraph field
  {
    name: "Form with paragraph field",
    data: {
      name: "Test Form 2 - Paragraph",
      description: "Testing paragraph field",
      fields: [
        {
          fieldType: "paragraph",
          label: "Comments",
          placeholder: "Enter your comments here",
          helpText: "Please provide detailed feedback",
          required: false,
          orderIndex: 0,
        },
      ],
    },
    expectedStatus: 201,
    shouldSucceed: true,
  },

  // Test 3: Form with star rating
  {
    name: "Form with star rating",
    data: {
      name: "Test Form 3 - Rating",
      fields: [
        {
          fieldType: "star_rating",
          label: "Overall Rating",
          required: true,
          orderIndex: 0,
        },
      ],
    },
    expectedStatus: 201,
    shouldSucceed: true,
  },

  // Test 4: Form with multiple choice
  {
    name: "Form with multiple choice",
    data: {
      name: "Test Form 4 - Multiple Choice",
      fields: [
        {
          fieldType: "multiple_choice",
          label: "Position",
          required: true,
          orderIndex: 0,
          options: [
            { value: "guard", label: "Guard" },
            { value: "forward", label: "Forward" },
            { value: "center", label: "Center" },
          ],
        },
      ],
    },
    expectedStatus: 201,
    shouldSucceed: true,
  },

  // Test 5: Form with dropdown
  {
    name: "Form with dropdown",
    data: {
      name: "Test Form 5 - Dropdown",
      fields: [
        {
          fieldType: "dropdown",
          label: "Skill Level",
          required: true,
          orderIndex: 0,
          options: [
            { value: "beginner", label: "Beginner" },
            { value: "intermediate", label: "Intermediate" },
            { value: "advanced", label: "Advanced" },
            { value: "expert", label: "Expert" },
          ],
        },
      ],
    },
    expectedStatus: 201,
    shouldSucceed: true,
  },

  // Test 6: Form with multiple selection
  {
    name: "Form with multiple selection",
    data: {
      name: "Test Form 6 - Multiple Selection",
      fields: [
        {
          fieldType: "multiple_selection",
          label: "Skills",
          required: false,
          orderIndex: 0,
          options: [
            { value: "shooting", label: "Shooting" },
            { value: "dribbling", label: "Dribbling" },
            { value: "passing", label: "Passing" },
            { value: "defense", label: "Defense" },
          ],
        },
      ],
    },
    expectedStatus: 201,
    shouldSucceed: true,
  },

  // Test 7: Form with number field
  {
    name: "Form with number field",
    data: {
      name: "Test Form 7 - Number",
      fields: [
        {
          fieldType: "number",
          label: "Age",
          placeholder: "Enter age",
          required: true,
          orderIndex: 0,
        },
      ],
    },
    expectedStatus: 201,
    shouldSucceed: true,
  },

  // Test 8: Form with date field
  {
    name: "Form with date field",
    data: {
      name: "Test Form 8 - Date",
      fields: [
        {
          fieldType: "date",
          label: "Date of Birth",
          required: true,
          orderIndex: 0,
        },
      ],
    },
    expectedStatus: 201,
    shouldSucceed: true,
  },

  // Test 9: Complex form with multiple field types
  {
    name: "Complex form with multiple field types",
    data: {
      name: "Comprehensive Evaluation Form",
      description: "A comprehensive form testing all field types",
      fields: [
        {
          fieldType: "short_text",
          label: "Student Name",
          placeholder: "Enter student name",
          required: true,
          orderIndex: 0,
        },
        {
          fieldType: "number",
          label: "Age",
          placeholder: "Enter age",
          required: true,
          orderIndex: 1,
        },
        {
          fieldType: "dropdown",
          label: "Position",
          required: true,
          orderIndex: 2,
          options: [
            { value: "pg", label: "Point Guard" },
            { value: "sg", label: "Shooting Guard" },
            { value: "sf", label: "Small Forward" },
            { value: "pf", label: "Power Forward" },
            { value: "c", label: "Center" },
          ],
        },
        {
          fieldType: "star_rating",
          label: "Overall Performance",
          required: true,
          orderIndex: 3,
        },
        {
          fieldType: "multiple_selection",
          label: "Strengths",
          required: false,
          orderIndex: 4,
          options: [
            { value: "speed", label: "Speed" },
            { value: "agility", label: "Agility" },
            { value: "strength", label: "Strength" },
            { value: "endurance", label: "Endurance" },
          ],
        },
        {
          fieldType: "paragraph",
          label: "Additional Notes",
          placeholder: "Enter any additional notes",
          helpText: "Provide detailed feedback here",
          required: false,
          orderIndex: 5,
        },
      ],
    },
    expectedStatus: 201,
    shouldSucceed: true,
  },

  // Test 10: Form without name (should fail)
  {
    name: "Form without name - should fail",
    data: {
      name: "",
      fields: [
        {
          fieldType: "short_text",
          label: "Field",
          required: false,
          orderIndex: 0,
        },
      ],
    },
    expectedStatus: 400,
    expectedError: "Form name is required",
    shouldSucceed: false,
  },

  // Test 11: Form without fields (should fail)
  {
    name: "Form without fields - should fail",
    data: {
      name: "Test Form",
      fields: [],
    },
    expectedStatus: 400,
    expectedError: "At least one field is required",
    shouldSucceed: false,
  },

  // Test 12: Form with field without label (should fail)
  {
    name: "Form with field without label - should fail",
    data: {
      name: "Test Form",
      fields: [
        {
          fieldType: "short_text",
          label: "",
          required: false,
          orderIndex: 0,
        },
      ],
    },
    expectedStatus: 400,
    expectedError: "Label is required",
    shouldSucceed: false,
  },

  // Test 13: Dropdown without options (should fail)
  {
    name: "Dropdown without options - should fail",
    data: {
      name: "Test Form",
      fields: [
        {
          fieldType: "dropdown",
          label: "Category",
          required: false,
          orderIndex: 0,
        },
      ],
    },
    expectedStatus: 400,
    expectedError: "requires at least one option",
    shouldSucceed: false,
  },

  // Test 14: Multiple choice with empty option value (should fail)
  {
    name: "Multiple choice with empty option value - should fail",
    data: {
      name: "Test Form",
      fields: [
        {
          fieldType: "multiple_choice",
          label: "Category",
          required: false,
          orderIndex: 0,
          options: [
            { value: "", label: "Option 1" },
          ],
        },
      ],
    },
    expectedStatus: 400,
    expectedError: "Option value is required",
    shouldSucceed: false,
  },

  // Test 15: Form with very long name (should fail)
  {
    name: "Form with very long name - should fail",
    data: {
      name: "A".repeat(201), // Exceeds 200 character limit
      fields: [
        {
          fieldType: "short_text",
          label: "Field",
          required: false,
          orderIndex: 0,
        },
      ],
    },
    expectedStatus: 400,
    expectedError: "Name must be less than 200 characters",
    shouldSucceed: false,
  },
];

async function runTest(testCase: TestCase): Promise<{ passed: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/evaluation-forms/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(TEST_TOKEN && { Authorization: `Bearer ${TEST_TOKEN}` }),
      },
      body: JSON.stringify(testCase.data),
    });

    const result = await response.json().catch(() => ({}));

    // Check status code
    if (response.status !== testCase.expectedStatus) {
      return {
        passed: false,
        error: `Expected status ${testCase.expectedStatus}, got ${response.status}. Response: ${JSON.stringify(result)}`,
      };
    }

    // If expecting success, verify we got a valid response
    if (testCase.shouldSucceed && response.status === 201) {
      if (!result.id || !result.name) {
        return {
          passed: false,
          error: `Expected valid form object with id and name, got: ${JSON.stringify(result)}`,
        };
      }
    }

    // If expecting error, verify error message
    if (testCase.expectedError && !testCase.shouldSucceed) {
      const errorMessage = result.error?.message || result.message || JSON.stringify(result);
      if (!errorMessage.toLowerCase().includes(testCase.expectedError.toLowerCase())) {
        return {
          passed: false,
          error: `Expected error containing "${testCase.expectedError}", got "${errorMessage}"`,
        };
      }
    }

    return { passed: true };
  } catch (error: any) {
    return {
      passed: false,
      error: `Exception: ${error.message}`,
    };
  }
}

async function runAllTests() {
  console.log("🧪 Running comprehensive evaluation form creation tests...\n");
  console.log(`API Base: ${API_BASE}\n`);

  let passed = 0;
  let failed = 0;
  const failures: Array<{ name: string; error: string }> = [];

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    if (result.passed) {
      console.log(`✅ ${testCase.name}`);
      passed++;
    } else {
      console.log(`❌ ${testCase.name}`);
      console.log(`   Error: ${result.error}`);
      failed++;
      failures.push({ name: testCase.name, error: result.error || "Unknown error" });
    }
    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total: ${testCases.length}`);
  console.log(`   📉 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

  if (failures.length > 0) {
    console.log(`\n❌ Failures:`);
    failures.forEach((f) => {
      console.log(`   - ${f.name}: ${f.error}`);
    });
  }

  if (failed === 0) {
    console.log("\n✅ All tests passed! Form creation is working correctly.");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests failed. Please review the errors above.");
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error("Fatal error running tests:", error);
    process.exit(1);
  });
}

export { runAllTests, testCases };
