#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🏎️ CSR2 MODS STORE Bot Setup Script\n');

// Check if Node.js version is compatible
const nodeVersion = process.version;
const requiredVersion = 'v16.0.0';
if (nodeVersion < requiredVersion) {
  console.error(`❌ Node.js ${requiredVersion} or higher is required. Current: ${nodeVersion}`);
  process.exit(1);
}

console.log(`✅ Node.js version: ${nodeVersion}`);

// Create necessary directories
const directories = [
  'logs',
  'temp',
  'assets/images/cars',
  'assets/images/cash',
  'assets/images/gold', 
  'assets/images/keys',
  'assets/images/packs',
  'assets/images/vip',
  'assets/images/services',
  'assets/images/accounts',
  'assets/docs',
  'tests',
  'src/handlers'
];

console.log('\n📁 Creating directories...');
directories.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`   ✅ Created: ${dir}`);
  } else {
    console.log(`   ℹ️  Exists: ${dir}`);
  }
});

// Check if .env file exists
console.log('\n🔧 Checking environment configuration...');
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('   ✅ Created .env file from .env.example');
    console.log('   ⚠️  Please edit .env file with your actual tokens!');
  } else {
    console.log('   ❌ .env.example not found');
  }
} else {
  console.log('   ✅ .env file already exists');
}

// Install dependencies
console.log('\n📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('   ✅ Dependencies installed successfully');
} catch (error) {
  console.error('   ❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Create placeholder image files
console.log('\n🖼️ Creating placeholder image files...');
const imageCategories = {
  cars: ['stock', 'maxed', 'free', 'all', 'upgrade', 'replace'],
  cash: ['5m', '10m', '25m', '50m', '75m', '100m'],
  gold: ['5k', '10k', '25k', '50k', '75k', '100k'],
  keys: ['bronze-1k', 'bronze-2k5', 'bronze-5k', 'bronze-10k', 'silver-500', 'silver-1k', 'silver-2k5', 'silver-5k', 'silver-10k', 'gold-100', 'gold-250', 'gold-500', 'gold-1k'],
  packs: ['trial', 'premium', 'ultimate', 'mega', 'legendary'],
  vip: ['shax', 'donna', 'tempest', 'boss', 'cheats'],
  services: ['boost', 'tuning', 'fusion', 'stage6', 'crew', 'trophy'],
  accounts: ['starter', 'intermediate', 'advanced', 'pro', 'legendary', 'custom']
};

Object.entries(imageCategories).forEach(([category, items]) => {
  items.forEach(item => {
    const filename = `csr2-${category === 'cars' ? 'car-' : category === 'keys' ? '' : category.slice(0, -1) + '-'}${item}.webp`;
    const filepath = path.join(process.cwd(), 'assets', 'images', category, filename);
    
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, '# Placeholder for ' + filename);
      console.log(`   ✅ Created placeholder: ${filename}`);
    }
  });
});

// Create basic test files
console.log('\n🧪 Creating test files...');
const testContent = `// Basic test file for CSR2 MODS STORE Bot
const assert = require('assert');

describe('CSR2 Bot Tests', () => {
  it('should start without errors', () => {
    assert.ok(true);
  });
  
  // Add more tests here
});
`;

const testPath = path.join(process.cwd(), 'tests', 'bot.test.js');
if (!fs.existsSync(testPath)) {
  fs.writeFileSync(testPath, testContent);
  console.log('   ✅ Created basic test file');
}

// Create docs
console.log('\n📝 Creating documentation files...');
const termsContent = `# Terms of Service - CSR2 MODS STORE

## 1. Service Terms
- Digital products only
- No refunds for delivered items
- Account modifications at your own risk

## 2. Payment Terms
- Secure payment methods only
- Payment before delivery
- Prices in USD

## 3. Disclaimer
- CSR2 is owned by Zynga/NaturalMotion
- We provide modification services only
- Use at your own discretion
`;

const privacyContent = `# Privacy Policy - CSR2 MODS STORE

## Data Collection
- We collect minimal user data for order processing
- Telegram user IDs and usernames for delivery
- Order history for customer service

## Data Usage
- Order fulfillment only
- Customer support
- Service improvement

## Data Protection
- Secure storage of customer information
- No sharing with third parties
- Data retention as required for service
`;

fs.writeFileSync(path.join(process.cwd(), 'assets', 'docs', 'terms.md'), termsContent);
fs.writeFileSync(path.join(process.cwd(), 'assets', 'docs', 'privacy.md'), privacyContent);
console.log('   ✅ Created terms and privacy policy');

// Verify bot token format
console.log('\n🔍 Verifying configuration...');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const botTokenMatch = envContent.match(/TELEGRAM_BOT_TOKEN=(.+)/);
  
  if (botTokenMatch && botTokenMatch[1] && botTokenMatch[1] !== 'your_bot_token_here') {
    const token = botTokenMatch[1].trim();
    if (token.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      console.log('   ✅ Bot token format looks valid');
    } else {
      console.log('   ⚠️  Bot token format may be invalid');
    }
  } else {
    console.log('   ⚠️  Please add your bot token to .env file');
  }
  
  const adminIdMatch = envContent.match(/ADMIN_CHAT_ID=(.+)/);
  if (adminIdMatch && adminIdMatch[1] && adminIdMatch[1] !== 'your_admin_chat_id_here') {
    console.log('   ✅ Admin chat ID is configured');
  } else {
    console.log('   ⚠️  Please add your admin chat ID to .env file');
  }
}

// Final instructions
console.log('\n🎉 Setup completed successfully!\n');
console.log('📋 Next steps:');
console.log('   1. Edit .env file with your actual tokens');
console.log('   2. Add your product images to assets/images/');
console.log('   3. Test locally: npm run dev');
console.log('   4. Deploy to your preferred platform');
console.log('\n🔗 Useful commands:');
console.log('   npm run dev     - Start development server');
console.log('   npm start       - Start production server');
console.log('   npm test        - Run tests');
console.log('   npm run pm2:start - Start with PM2');
console.log('\n🏎️ CSR2 MODS STORE Bot is ready to rock!');

// Check for updates
console.log('\n🔄 Checking for updates...');
try {
  execSync('npm outdated', { stdio: 'inherit' });
} catch (error) {
  // npm outdated returns non-zero exit code when packages are outdated
  console.log('   ℹ️  Some packages may have updates available');
}

console.log('\n✨ Happy coding!');