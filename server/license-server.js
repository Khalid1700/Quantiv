// Simple Dockerized License Server for Quantiv
// Endpoints:
// - POST /issue: { name, email, assetName?, version? } -> { licenseKey, downloadUrl?, message }
// - POST /resolve: { os, version? } -> { ok, assetName, downloadUrl }
// - POST /activate: { key, email, device } -> { ok, reason }
// - GET  /health -> { ok: true }

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const crypto = require('crypto');
const path = require('path');

// Reuse local generator logic
const { generateCustomerLicenseKey, validateLicenseKeyFormat } = require('../tools/license-generator');

const PORT = process.env.PORT || 8088;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'your-org-or-user';
const GITHUB_REPO = process.env.GITHUB_REPO || 'Quantiv';
const ALLOW_ANY_ASSET = process.env.ALLOW_ANY_ASSET === 'true';

// Basic in-memory store (replace with persistent DB if needed)
const issued = new Map(); // key -> { name, email, at, assetName, version }
const activations = new Map(); // key -> { email, device, at }

const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan('tiny'));
// Serve landing page static files
app.use(express.static(path.join(__dirname, 'public')));
// Also serve app icons and styles from main app to keep branding consistent
app.use('/app-icons', express.static(path.join(__dirname, '..', 'public', 'icons')));
app.use('/app-styles', express.static(path.join(__dirname, '..', 'public', 'styles')));

// Root serves landing page
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// Helper: build GitHub download URL for release assets
function buildDownloadUrl(assetName, version) {
  // If version provided, you may target a specific tag: /download/v1.0.0/<asset>
  // Otherwise, use latest: /releases/latest/download/<asset>
  if (version) {
    return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/${assetName}`;
  }
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/${assetName}`;
}

// Detect OS from User-Agent to choose asset extension
function detectOSFromUA(ua = '') {
  const u = ua.toLowerCase();
  if (u.includes('mac os') || u.includes('macintosh')) return 'macos';
  if (u.includes('windows')) return 'windows';
  return 'windows';
}

// Resolve asset via GitHub API when assetName is not provided
async function resolveAssetUrl({ assetName, version, os }) {
  if (assetName) {
    return { assetName, downloadUrl: buildDownloadUrl(assetName, version) };
  }
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Quantiv-License-Server'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = version
    ? `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/v${version}`
    : `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    throw new Error(`GitHub API error ${resp.status}`);
  }
  const rel = await resp.json();
  const assets = Array.isArray(rel.assets) ? rel.assets : [];
  const pick = assets.find(a => {
    const name = (a && a.name) || '';
    const lower = name.toLowerCase();
    switch (os) {
      case 'windows-x86':
        return lower.endsWith('.exe') && lower.includes('x86');
      case 'windows-x64':
        return lower.endsWith('.exe') && !lower.includes('x86');
      case 'macos-apple':
        return lower.endsWith('.dmg') && (lower.includes('arm64') || lower.includes('apple') || lower.includes('aarch64'));
      case 'macos-intel':
        return lower.endsWith('.dmg') && !(lower.includes('arm64') || lower.includes('aarch64'));
      default:
        // Fallback generic
        if (os && os.startsWith('mac')) return lower.endsWith('.dmg');
        return lower.endsWith('.exe') || lower.endsWith('.msi');
    }
  });
  if (!pick) {
    throw new Error('No matching asset for OS');
  }
  return { assetName: pick.name, downloadUrl: pick.browser_download_url };
}

// Issue a new license and provide a download URL through the gateway
app.post('/issue', (req, res) => {
  try {
    const { name, email, assetName, version } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ ok: false, reason: 'missing_name_or_email' });
    }
    const licenseKey = generateCustomerLicenseKey(name, email);
    const at = new Date().toISOString();
    issued.set(licenseKey, { name, email, at, assetName, version });

    const downloadUrl = assetName ? buildDownloadUrl(assetName, version) : undefined;
    return res.json({ ok: true, licenseKey, downloadUrl, message: 'License issued. Use this key during activation.' });
  } catch (e) {
    console.error('Issue error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Resolve endpoint: manual OS selection mapped to latest GitHub asset
app.post('/resolve', async (req, res) => {
  try {
    const { os, version } = req.body || {};
    if (!os) {
      return res.status(400).json({ ok: false, reason: 'missing_os' });
    }
    const { assetName, downloadUrl } = await resolveAssetUrl({ assetName: null, version, os });
    return res.json({ ok: true, assetName, downloadUrl });
  } catch (e) {
    console.error('Resolve error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Auto endpoint: detect OS, resolve asset from GitHub, issue license, return key + URL
app.post('/auto', async (req, res) => {
  try {
    const { name, email, version } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ ok: false, reason: 'missing_name_or_email' });
    }
    const os = detectOSFromUA(req.headers['user-agent'] || '');
    const { assetName, downloadUrl } = await resolveAssetUrl({ assetName: null, version, os });

    const licenseKey = generateCustomerLicenseKey(name, email);
    issued.set(licenseKey, { name, email, at: new Date().toISOString(), assetName, version });
    return res.json({ ok: true, licenseKey, downloadUrl, os, assetName });
  } catch (e) {
    console.error('Auto issue error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Provide a downloadable license file containing key and email
app.get('/license-file', (req, res) => {
  try {
    const key = String(req.query.key || '').trim();
    const email = String(req.query.email || '').trim();
    if (!key || !email) {
      return res.status(400).json({ ok: false, reason: 'missing_key_or_email' });
    }
    const payload = { licenseKey: key, customerEmail: email };
    res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="Quantiv-license.json"');
    return res.send(JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error('License file error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Activate a license: bind to device fingerprint and email
app.post('/activate', (req, res) => {
  try {
    const { key, email, device } = req.body || {};
    if (!key || !email || !device) {
      return res.status(400).json({ ok: false, reason: 'missing_fields' });
    }
    if (!validateLicenseKeyFormat(key)) {
      return res.status(400).json({ ok: false, reason: 'invalid_key_format' });
    }

    const record = issued.get(key);
    if (!record || record.email.toLowerCase() !== String(email).toLowerCase()) {
      return res.status(404).json({ ok: false, reason: 'license_not_found_or_email_mismatch' });
    }

    // Prevent sharing: allow one activation per license (or enforce policy)
    if (activations.has(key)) {
      const prev = activations.get(key);
      if (prev.device !== device) {
        return res.status(409).json({ ok: false, reason: 'device_mismatch_existing_activation' });
      }
      // Same device re-activation
      return res.json({ ok: true, reason: 'already_activated' });
    }

    activations.set(key, { email, device, at: new Date().toISOString() });
    return res.json({ ok: true });
  } catch (e) {
    console.error('Activate error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Verify endpoint (optional) to check current activation state
app.post('/verify', (req, res) => {
  try {
    const { key, device } = req.body || {};
    if (!key || !device) {
      return res.status(400).json({ ok: false, reason: 'missing_fields' });
    }
    const act = activations.get(key);
    if (!act) return res.json({ ok: false, reason: 'not_activated' });
    if (act.device !== device) return res.json({ ok: false, reason: 'device_mismatch' });
    return res.json({ ok: true, email: act.email, activatedAt: act.at });
  } catch (e) {
    console.error('Verify error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`License server running on port ${PORT}`);
});
