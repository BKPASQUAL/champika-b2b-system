// scripts/create-first-user.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Load Environment Variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) envVars[key.trim()] = value.trim();
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing Supabase keys in .env.local');
  process.exit(1);
}

// 2. Initialize Admin Client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const NEW_USER = {
  email: "bawanthapasqual@gmail.com",
  password: "bawanthapasqual@gmail.com",
  user_metadata: {
    full_name: "Bawantha Pasqual",
    role: "admin"
  }
};

async function createAdmin() {
  console.log(`Creating user: ${NEW_USER.email}...`);

  // A. Create Auth User
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: NEW_USER.email,
    password: NEW_USER.password,
    email_confirm: true,
    user_metadata: NEW_USER.user_metadata
  });

  if (authError) {
    console.error('❌ Auth Error:', authError.message);
    return;
  }

  console.log('✅ Auth User Created ID:', authData.user.id);

  // B. Create/Update Profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email: NEW_USER.email,
      full_name: NEW_USER.user_metadata.full_name,
      username: "bkpasqual",
      role: "admin",
      is_active: true,
      updated_at: new Date().toISOString()
    });

  if (profileError) {
    console.error('❌ Profile Error:', profileError.message);
  } else {
    console.log('✅ Profile linked successfully!');
    console.log('🎉 You can now log in at http://localhost:3000/login');
  }
}

createAdmin();