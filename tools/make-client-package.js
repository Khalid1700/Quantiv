#!/usr/bin/env node
/**
 * Make a minimal client package containing only what the customer needs
 * to install and run the app: the Windows installer, an install script
 * with embedded license params, a README with SmartScreen instructions,
 * and a SHA256 checksum.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.+)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function readVersion() {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function safeName(str, fallback = 'client') {
  if (!str) return fallback;
  return String(str).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function main() {
  const { key, email, version } = parseArgs();
  if (!key || !email) {
    console.error('Usage: node tools/make-client-package.js --key=LICENSE_KEY --email=CUSTOMER_EMAIL [--version=1.0.x]');
    process.exit(1);
  }

  const ver = version || readVersion();
  const distDir = path.resolve(process.cwd(), 'App Dist Windows');
  const installerName = `Quantiv-Setup-${ver}.exe`;
  const installerPath = path.join(distDir, installerName);

  if (!fs.existsSync(installerPath)) {
    console.error(`Installer not found: ${installerPath}`);
    console.error('Please build first: npm run dist:win');
    process.exit(2);
  }

  const baseOutDir = path.resolve(process.cwd(), 'Client Packages');
  if (!fs.existsSync(baseOutDir)) fs.mkdirSync(baseOutDir, { recursive: true });
  const clientFolderName = `${safeName(email)}-${ver}`;
  const outDir = path.join(baseOutDir, clientFolderName);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Copy installer
  const targetInstaller = path.join(outDir, installerName);
  fs.copyFileSync(installerPath, targetInstaller);

  // Generate SHA256SUMS.txt
  const sum = sha256File(targetInstaller);
  const sumsTxt = `# SHA256 sums for client package\n${sum}  ${installerName}\n`;
  fs.writeFileSync(path.join(outDir, 'SHA256SUMS.txt'), sumsTxt, 'utf8');

  // Create install script (batch)
  const installCmd = `@echo off\n` +
    `setlocal enableextensions enabledelayedexpansion\n` +
    `set INST=\"${installerName}\"\n` +
    `echo Running installer for %USERNAME%...\n` +
    `echo.\n` +
    `%INST% --license-key=\"${key}\" --license-email=\"${email}\"\n` +
    `echo.\n` +
    `echo If Windows SmartScreen appears, click \'More info\' then \'Run anyway\'.\n` +
    `echo Done.\n`;
  fs.writeFileSync(path.join(outDir, 'install-Quantiv.cmd'), installCmd, 'utf8');

  // README with minimal instructions
  const readme = [
    'Quantiv — Client Package',
    '',
    `Version: ${ver}`,
    `Customer: ${email}`,
    '',
    'Files:',
    `- ${installerName}  (Windows installer)`,
    '- install-Quantiv.cmd  (runs installer with your license)',
    '- SHA256SUMS.txt  (checksum for verification)',
    '',
    'How to install:',
    '1) Double-click install-Quantiv.cmd',
    '2) If Windows SmartScreen appears: click "More info" then "Run anyway"',
    '3) After installation, launch Quantiv from Start Menu or Desktop shortcut',
    '',
    'Your license will be auto-activated on first app start.',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'README-INSTALL.txt'), readme, 'utf8');

  console.log('Client package created:');
  console.log(outDir);
  console.log('Contents:');
  console.log('- ' + installerName);
  console.log('- install-Quantiv.cmd');
  console.log('- README-INSTALL.txt');
  console.log('- SHA256SUMS.txt');
}

main();

