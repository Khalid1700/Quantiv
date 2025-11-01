#!/usr/bin/env node

/**
 * License Key Generator for Quantiv
 * 
 * Usage:
 *   node license-generator.js "Customer Name" "customer@email.com"
 * 
 * This generates a customer-specific license key that can be used to activate the application.
 */

const crypto = require('crypto');

// Secret key for generating license keys (keep this secure!)
const LICENSE_SECRET = 'ABTK-2024-SECRET-KEY-DO-NOT-SHARE';

function generateCustomerLicenseKey(customerName, customerEmail) {
  if (!customerName || !customerEmail) {
    throw new Error('Customer name and email are required');
  }

  // Normalize inputs
  const normalizedName = customerName.trim().toLowerCase();
  const normalizedEmail = customerEmail.trim().toLowerCase();
  
  // Create a hash from customer info and secret
  const customerData = `${normalizedName}:${normalizedEmail}:${LICENSE_SECRET}`;
  const hash = crypto.createHash('sha256').update(customerData).digest('hex');
  
  // Take first 16 characters and format as license key
  const keyData = hash.substring(0, 16).toUpperCase();
  
  // Format as ABTK-XXXX-XXXX-XXXX-XXXX
  const formatted = `ABTK-${keyData.substring(0, 4)}-${keyData.substring(4, 8)}-${keyData.substring(8, 12)}-${keyData.substring(12, 16)}`;
  
  return formatted;
}

function validateLicenseKeyFormat(key) {
  const pattern = /^ABTK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(key);
}

function verifyLicenseKey(key, customerName, customerEmail) {
  if (!validateLicenseKeyFormat(key)) {
    return false;
  }
  
  const expectedKey = generateCustomerLicenseKey(customerName, customerEmail);
  return key === expectedKey;
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node license-generator.js "Customer Name" "customer@email.com"');
    console.log('');
    console.log('Examples:');
    console.log('  node license-generator.js "John Smith" "john@example.com"');
    console.log('  node license-generator.js "شركة الأعمال المتقدمة" "info@company.com"');
    process.exit(1);
  }
  
  const customerName = args[0];
  const customerEmail = args[1];
  
  try {
    const licenseKey = generateCustomerLicenseKey(customerName, customerEmail);
    
    console.log('='.repeat(60));
console.log('Quantiv - License Key Generated');
    console.log('='.repeat(60));
    console.log(`Customer Name: ${customerName}`);
    console.log(`Customer Email: ${customerEmail}`);
    console.log(`License Key: ${licenseKey}`);
    console.log('='.repeat(60));
    console.log('');
    console.log('Instructions for customer:');
console.log('1. Install the Quantiv application');
    console.log('2. When prompted for activation, enter the license key above');
    console.log('3. Enter the same email address used for purchase');
    console.log('4. The application will be activated for this device');
    console.log('');
    console.log('Note: This license is tied to the customer information provided.');
    console.log('The customer must use the exact same email address for activation.');
    
  } catch (error) {
    console.error('Error generating license key:', error.message);
    process.exit(1);
  }
}

module.exports = {
  generateCustomerLicenseKey,
  validateLicenseKeyFormat,
  verifyLicenseKey
};
