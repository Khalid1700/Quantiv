#!/usr/bin/env node

/**
 * Generate Download Link with License Parameters
 * 
 * This tool generates download links that automatically activate licenses
 * when the installer is run with the generated parameters.
 * 
 * Usage:
 *   node tools/generate-download-link.js --key=ABCD-EFGH-IJKL-MNOP --email=user@example.com
 *   node tools/generate-download-link.js --key=ABCD-EFGH-IJKL-MNOP --email=user@example.com --version=1.0.5
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      if (key && value) {
        params[key] = value;
      }
    }
  });
  
  return params;
}

// Get latest version from package.json
function getLatestVersion() {
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageData.version;
  } catch (e) {
    return '1.0.0';
  }
}

// Generate download links
function generateLinks(licenseKey, email, version) {
  const baseUrl = 'https://github.com/Khalid1700/Quantiv/releases/download';
  const installerName = `Quantiv-Setup-${version}.exe`;
  
  // Method 1: Direct installer with command line parameters
  const directCommand = `${installerName} --license-key="${licenseKey}" --license-email="${email}"`;
  
  // Method 2: PowerShell download and install command
  const powershellCommand = `
# Download and auto-activate Quantiv
$url = "${baseUrl}/v${version}/${installerName}"
$output = "$env:TEMP\\${installerName}"
Invoke-WebRequest -Uri $url -OutFile $output
Start-Process -FilePath $output -ArgumentList '--license-key="${licenseKey}","--license-email="${email}"' -Wait
Remove-Item $output -Force
`.trim();

  // Method 3: Batch file content
  const batchContent = `
@echo off
echo Downloading Quantiv...
powershell -Command "Invoke-WebRequest -Uri '${baseUrl}/v${version}/${installerName}' -OutFile '%TEMP%\\${installerName}'"
echo Installing with license activation...
"%TEMP%\\${installerName}" --license-key="${licenseKey}" --license-email="${email}"
del "%TEMP%\\${installerName}"
echo Installation complete!
pause
`.trim();

  return {
    directCommand,
    powershellCommand,
    batchContent,
    downloadUrl: `${baseUrl}/v${version}/${installerName}`,
    version,
    licenseKey,
    email
  };
}

// Main function
function main() {
  const params = parseArgs();
  
  if (!params.key || !params.email) {
    console.error('Usage: node generate-download-link.js --key=LICENSE_KEY --email=EMAIL [--version=VERSION]');
    console.error('');
    console.error('Examples:');
    console.error('  node tools/generate-download-link.js --key=ABCD-EFGH-IJKL-MNOP --email=user@example.com');
    console.error('  node tools/generate-download-link.js --key=ABCD-EFGH-IJKL-MNOP --email=user@example.com --version=1.0.5');
    process.exit(1);
  }
  
  const version = params.version || getLatestVersion();
  const links = generateLinks(params.key, params.email, version);
  
  console.log('='.repeat(80));
  console.log('QUANTIV AUTO-ACTIVATION DOWNLOAD LINKS');
  console.log('='.repeat(80));
  console.log('');
  console.log(`License Key: ${links.licenseKey}`);
  console.log(`Email: ${links.email}`);
  console.log(`Version: ${links.version}`);
  console.log('');
  
  console.log('METHOD 1: Direct Download URL');
  console.log('-'.repeat(40));
  console.log(links.downloadUrl);
  console.log('');
  console.log('Then run with parameters:');
  console.log(links.directCommand);
  console.log('');
  
  console.log('METHOD 2: PowerShell One-Liner');
  console.log('-'.repeat(40));
  console.log(links.powershellCommand);
  console.log('');
  
  console.log('METHOD 3: Batch File Content');
  console.log('-'.repeat(40));
  console.log('Save this as install-quantiv.bat:');
  console.log('');
  console.log(links.batchContent);
  console.log('');
  
  console.log('METHOD 4: Customer Instructions');
  console.log('-'.repeat(40));
  console.log('Send these instructions to your customer:');
  console.log('');
  console.log('1. Download the installer from:');
  console.log(`   ${links.downloadUrl}`);
  console.log('');
  console.log('2. Open Command Prompt or PowerShell as Administrator');
  console.log('');
  console.log('3. Navigate to the download folder and run:');
  console.log(`   ${links.directCommand}`);
  console.log('');
  console.log('The application will be installed and automatically activated!');
  console.log('');
  console.log('='.repeat(80));
}

if (require.main === module) {
  main();
}

module.exports = { generateLinks, parseArgs, getLatestVersion };