#!/usr/bin/env node

/**
 * Quick diagnostic script to check if credentials file exists
 */

const fs = require('fs');
const path = require('path');

const credentialsPath = path.join(process.cwd(), '.credentials.json');

console.log('🔍 Checking credentials file...\n');
console.log(`Looking for: ${credentialsPath}\n`);

if (fs.existsSync(credentialsPath)) {
  console.log('✅ Credentials file EXISTS\n');
  
  try {
    const content = fs.readFileSync(credentialsPath, 'utf-8');
    const data = JSON.parse(content);
    
    console.log('📄 File contents:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.supabase_config) {
      console.log('\n✅ Supabase config found in file');
      console.log(`   - URL: ${data.supabase_config.url ? '✓' : '✗'}`);
      console.log(`   - Anon Key: ${data.supabase_config.anonKey ? '✓' : '✗'}`);
      console.log(`   - Service Role Key: ${data.supabase_config.serviceRoleKey ? '✓' : '✗'}`);
    } else {
      console.log('\n❌ No supabase_config key found in file');
    }
  } catch (error) {
    console.error('\n❌ Error reading file:', error.message);
  }
} else {
  console.log('❌ Credentials file does NOT exist');
  console.log('\n💡 This file should be created when you complete Step 2 of the setup wizard');
  console.log('   (Connect Supabase)');
}

console.log('\n---\n');

