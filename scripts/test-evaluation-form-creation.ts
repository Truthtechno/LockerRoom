import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

async function testEvaluationFormCreation() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🧪 Testing Evaluation Form Creation...\n');
  
  const sql = neon(databaseUrl);
  
  try {
    // Test 1: Verify tables exist
    console.log('✅ Test 1: Verify tables exist');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'evaluation%'
      ORDER BY table_name;
    `;
    
    const expectedTables = [
      'evaluation_form_access',
      'evaluation_form_fields',
      'evaluation_form_templates',
      'evaluation_submission_responses',
      'evaluation_submissions'
    ];
    
    const foundTables = tables.map((t: any) => t.table_name);
    const missingTables = expectedTables.filter(t => !foundTables.includes(t));
    
    if (missingTables.length > 0) {
      throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    }
    
    console.log(`   ✓ All ${expectedTables.length} tables exist\n`);
    
    // Test 2: Get a system admin user ID
    console.log('✅ Test 2: Get system admin user');
    const adminUsers = await sql`
      SELECT u.id, u.email, u.role
      FROM users u
      WHERE u.role = 'system_admin'
      LIMIT 1;
    `;
    
    if (adminUsers.length === 0) {
      throw new Error('No system admin user found. Cannot test form creation.');
    }
    
    const adminUser = adminUsers[0];
    console.log(`   ✓ Found admin user: ${adminUser.email} (${adminUser.id})\n`);
    
    // Test 3: Create a test form template
    console.log('✅ Test 3: Create test form template');
    const testForm = {
      name: 'Test Evaluation Form',
      description: 'Test form created by migration test',
      status: 'draft',
      created_by: adminUser.id,
      version: 1
    };
    
    const [createdTemplate] = await sql`
      INSERT INTO evaluation_form_templates (name, description, status, created_by, version)
      VALUES (${testForm.name}, ${testForm.description}, ${testForm.status}, ${testForm.created_by}, ${testForm.version})
      RETURNING id, name, status, created_by;
    `;
    
    console.log(`   ✓ Form template created: ${createdTemplate.name} (ID: ${createdTemplate.id})\n`);
    
    // Test 4: Create a test field
    console.log('✅ Test 4: Create test form field');
    const testField = {
      form_template_id: createdTemplate.id,
      field_type: 'short_text',
      label: 'Test Field',
      placeholder: 'Enter text',
      help_text: 'This is a test field',
      required: false,
      order_index: 0,
      options: null,
      validation_rules: null
    };
    
    const [createdField] = await sql`
      INSERT INTO evaluation_form_fields (
        form_template_id, field_type, label, placeholder, help_text, 
        required, order_index, options, validation_rules
      )
      VALUES (
        ${testField.form_template_id}, ${testField.field_type}, ${testField.label},
        ${testField.placeholder}, ${testField.help_text}, ${testField.required},
        ${testField.order_index}, ${testField.options}, ${testField.validation_rules}
      )
      RETURNING id, label, field_type;
    `;
    
    console.log(`   ✓ Form field created: ${createdField.label} (Type: ${createdField.field_type})\n`);
    
    // Test 5: Retrieve the complete form
    console.log('✅ Test 5: Retrieve complete form');
    const retrievedForm = await sql`
      SELECT 
        t.*,
        json_agg(
          json_build_object(
            'id', f.id,
            'fieldType', f.field_type,
            'label', f.label,
            'placeholder', f.placeholder,
            'helpText', f.help_text,
            'required', f.required,
            'orderIndex', f.order_index,
            'options', f.options,
            'validationRules', f.validation_rules
          ) ORDER BY f.order_index
        ) FILTER (WHERE f.id IS NOT NULL) as fields
      FROM evaluation_form_templates t
      LEFT JOIN evaluation_form_fields f ON f.form_template_id = t.id
      WHERE t.id = ${createdTemplate.id}
      GROUP BY t.id;
    `;
    
    if (retrievedForm.length === 0) {
      throw new Error('Failed to retrieve created form');
    }
    
    const form = retrievedForm[0];
    console.log(`   ✓ Form retrieved: ${form.name}`);
    console.log(`   ✓ Fields count: ${form.fields?.length || 0}\n`);
    
    // Test 6: Clean up test data
    console.log('✅ Test 6: Clean up test data');
    await sql`DELETE FROM evaluation_form_fields WHERE form_template_id = ${createdTemplate.id}`;
    await sql`DELETE FROM evaluation_form_templates WHERE id = ${createdTemplate.id}`;
    console.log('   ✓ Test data cleaned up\n');
    
    console.log('🎉 All tests passed! Form creation is working correctly.\n');
    console.log('📝 The database is ready for evaluation forms.');
    console.log('✅ You can now create forms through the UI.\n');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testEvaluationFormCreation()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });


