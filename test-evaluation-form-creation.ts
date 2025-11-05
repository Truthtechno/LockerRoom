/**
 * Test script for evaluation form creation
 * This script tests the form creation API endpoint with various scenarios
 */

const API_BASE = process.env.API_BASE || "http://localhost:5000";
const TEST_TOKEN = process.env.TEST_TOKEN || "";

interface TestCase {
  name: string;
  data: any;
  expectedStatus: number;
  expectedError?: string;
}

const testCases: TestCase[] = [
  {
    name: "Valid form with short text field",
    data: {
      name: "Test Form 1",
      description: "Test description",
      fields: [
        {
          fieldType: "short_text",
          label: "Name",
          placeholder: "Enter name",
          helpText: "Enter your full name",
          required: true,
          orderIndex: 0,
        },
      ],
    },
    expectedStatus: 201,
  },
  {
    name: "Valid form with star rating field",
    data: {
      name: "Test Form 2",
      fields: [
        {
          fieldType: "star_rating",
          label: "Rating",
          required: false,
          orderIndex: 0,
        },
      ],
    },
    expectedStatus: 201,
  },
  {
    name: "Valid form with dropdown field",
    data: {
      name: "Test Form 3",
      fields: [
        {
          fieldType: "dropdown",
          label: "Category",
          required: true,
          orderIndex: 0,
          options: [
            { value: "option1", label: "Option 1" },
            { value: "option2", label: "Option 2" },
          ],
        },
      ],
    },
    expectedStatus: 201,
  },
  {
    name: "Form without name (should fail)",
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
  },
  {
    name: "Form without fields (should fail)",
    data: {
      name: "Test Form",
      fields: [],
    },
    expectedStatus: 400,
    expectedError: "At least one field is required",
  },
  {
    name: "Form with field without label (should fail)",
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
  },
  {
    name: "Form with dropdown without options (should fail)",
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
  },
  {
    name: "Form with dropdown with empty option (should fail)",
    data: {
      name: "Test Form",
      fields: [
        {
          fieldType: "dropdown",
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
  },
];

async function runTest(testCase: TestCase): Promise<boolean> {
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

    if (response.status !== testCase.expectedStatus) {
      console.error(`❌ ${testCase.name}: Expected status ${testCase.expectedStatus}, got ${response.status}`);
      console.error(`   Response:`, result);
      return false;
    }

    if (testCase.expectedError) {
      const errorMessage = result.error?.message || result.message || "";
      if (!errorMessage.toLowerCase().includes(testCase.expectedError.toLowerCase())) {
        console.error(`❌ ${testCase.name}: Expected error containing "${testCase.expectedError}", got "${errorMessage}"`);
        return false;
      }
    }

    console.log(`✅ ${testCase.name}: Passed`);
    return true;
  } catch (error: any) {
    console.error(`❌ ${testCase.name}: Exception - ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log("🧪 Running evaluation form creation tests...\n");
  
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    if (result) {
      passed++;
    } else {
      failed++;
    }
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
  
  if (failed === 0) {
    console.log("✅ All tests passed!");
    process.exit(0);
  } else {
    console.log("❌ Some tests failed");
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests, testCases };

