#!/usr/bin/env node

/**
 * Quick script to update Supabase anon key in .env file
 * Usage: node update-env-key.js YOUR_ANON_KEY_HERE
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const anonKey = process.argv[2];

if (!anonKey) {
  console.error('❌ Error: Anon key required!');
  console.log('\nUsage:');
  console.log('  node update-env-key.js YOUR_ANON_KEY_HERE');
  console.log('\nExample:');
  console.log('  node update-env-key.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  process.exit(1);
}

const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ Error: .env file not found!');
  console.log('Creating .env file...');
  fs.writeFileSync(envPath, `VITE_SUPABASE_URL=https://hswgdeldouyclpeqbbgq.supabase.co\nVITE_SUPABASE_ANON_KEY=${anonKey}\n`);
  console.log('✅ .env file created with your key!');
} else {
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update or add VITE_SUPABASE_ANON_KEY
  if (envContent.includes('VITE_SUPABASE_ANON_KEY=')) {
    envContent = envContent.replace(
      /VITE_SUPABASE_ANON_KEY=.*/,
      `VITE_SUPABASE_ANON_KEY=${anonKey}`
    );
  } else {
    envContent += `\nVITE_SUPABASE_ANON_KEY=${anonKey}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file updated with your anon key!');
}

console.log('\n📝 Next step: Restart your dev server');
console.log('   npm run dev\n');

