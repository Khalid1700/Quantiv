// Generate NSIS installer assets (header and sidebar) aligned with app branding
// Uses sharp to compose gradients and the app icon into BMPs required by NSIS
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

async function ensureDir(p){
  if(!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function createGradient(width, height){
  // Splash dark background gradient: #0B0F16 → #111726 at 135°
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0B0F16" />
        <stop offset="100%" stop-color="#111726" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" />
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function makeHeaderBMP(){
  // Recommended NSIS header size ~ 150x57
  const outDir = path.join('public','installer');
  await ensureDir(outDir);
  const headerOut = path.join(outDir,'installerHeader.bmp');
  // If asset already exists, skip regeneration to avoid CI failures (sharp doesn't output BMP)
  if (fs.existsSync(headerOut)) {
    console.log('installerHeader.bmp exists; skipping generation');
    return;
  }
  const iconPath = path.join('public','icons','app-128.png');
  const headerPng = await createGradient(150, 57);
  let comp = sharp(headerPng).resize(150,57);
  if(fs.existsSync(iconPath)){
    // Glow and badge behind icon to match splash feel
    const glowSvg = Buffer.from(`<svg width="150" height="57" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glowH" cx="0.18" cy="0.18" r="0.35">
          <stop offset="0%" stop-color="rgba(0,184,148,0.35)" />
          <stop offset="100%" stop-color="rgba(0,184,148,0)" />
        </radialGradient>
      </defs>
      <circle cx="30" cy="30" r="24" fill="url(#glowH)" />
    </svg>`);
    const ringSvg = Buffer.from(`<svg width="150" height="57" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ringH" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#00B894" />
          <stop offset="100%" stop-color="#34D399" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="48" height="48" rx="12" ry="12" fill="#ffffff0d" stroke="#ffffff26" />
      <rect x="5" y="5" width="46" height="46" rx="11" ry="11" fill="none" stroke="url(#ringH)" stroke-width="2" opacity="0.7" />
    </svg>`);
    const glowBuf = await sharp(glowSvg).png().toBuffer();
    const ringBuf = await sharp(ringSvg).png().toBuffer();
    const iconBuf = await sharp(iconPath).resize(44,44).png().toBuffer();
    comp = comp.composite([
      { input: glowBuf, top: 0, left: 0 },
      { input: ringBuf, top: 0, left: 0 },
      { input: iconBuf, top: 6, left: 6 }
    ]);
  }
  const labelSvg = Buffer.from(`<svg width="150" height="57" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="brandText" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#00B894" />
        <stop offset="100%" stop-color="#34D399" />
      </linearGradient>
    </defs>
    <text x="56" y="26" font-family="Segoe UI, Arial" font-size="15" fill="#ffffff" font-weight="800">Quantiv</text>
    <text x="56" y="45" font-family="Segoe UI, Arial" font-size="11" fill="#94a3b8" font-weight="600">أدوات الأعمال الذكية</text>
    <!-- Developer badge: matches splash style -->
    <rect x="92" y="8" rx="8" ry="8" width="50" height="18" fill="#ffffff0d" stroke="#ffffff26" />
    <text x="117" y="21" text-anchor="middle" font-family="Segoe UI, Arial" font-size="10" font-weight="700" fill="url(#brandText)">By Khalid.Agents</text>
  </svg>`);
  comp = comp.composite([{ input: await sharp(labelSvg).png().toBuffer(), top: 0, left: 0 }]);
  // Sharp does not support BMP output; rely on committed asset or future encoder
  // Leave a friendly message if generation was attempted without asset
  throw new Error('BMP output not supported by sharp; please provide public/installer/installerHeader.bmp');
}

async function makeSidebarBMP(){
  // Recommended NSIS sidebar size ~ 164x314
  const outDir = path.join('public','installer');
  await ensureDir(outDir);
  const sidebarOut = path.join(outDir,'installerSidebar.bmp');
  // If asset already exists, skip regeneration to avoid CI failures (sharp doesn't output BMP)
  if (fs.existsSync(sidebarOut)) {
    console.log('installerSidebar.bmp exists; skipping generation');
    return;
  }
  const iconPath = path.join('public','icons','app-256.png');
  const sidebarPng = await createGradient(164, 314);
  let comp = sharp(sidebarPng).resize(164,314);
  if(fs.existsSync(iconPath)){
    // Centered icon with glow and gradient ring to match splash layout
    const glowSvg = Buffer.from(`<svg width="164" height="314" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glowS" cx="0.5" cy="0.12" r="0.25">
          <stop offset="0%" stop-color="rgba(0,184,148,0.35)" />
          <stop offset="100%" stop-color="rgba(0,184,148,0)" />
        </radialGradient>
      </defs>
      <circle cx="82" cy="64" r="38" fill="url(#glowS)" />
    </svg>`);
    const ringSvg = Buffer.from(`<svg width="164" height="314" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ringS" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#00B894" />
          <stop offset="100%" stop-color="#34D399" />
        </linearGradient>
      </defs>
      <rect x="32" y="24" width="100" height="100" rx="16" ry="16" fill="#ffffff0d" stroke="#ffffff26" />
      <rect x="34" y="26" width="96" height="96" rx="15" ry="15" fill="none" stroke="url(#ringS)" stroke-width="3" opacity="0.7" />
    </svg>`);
    const glowBuf = await sharp(glowSvg).png().toBuffer();
    const ringBuf = await sharp(ringSvg).png().toBuffer();
    const iconBuf = await sharp(iconPath).resize(84,84).png().toBuffer();
    comp = comp.composite([
      { input: glowBuf, top: 0, left: 0 },
      { input: ringBuf, top: 0, left: 0 },
      { input: iconBuf, top: 30, left: 40 }
    ]);
  }
  const labelSvg = Buffer.from(`<svg width="164" height="314" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="brandText2" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#00B894" />
        <stop offset="100%" stop-color="#34D399" />
      </linearGradient>
    </defs>
    <text x="82" y="150" text-anchor="middle" font-family="Segoe UI, Arial" font-size="14" fill="#ffffff" font-weight="800">Quantiv</text>
    <text x="82" y="170" text-anchor="middle" font-family="Segoe UI, Arial" font-size="12" fill="#94a3b8">أدوات الأعمال الذكية</text>
    <!-- Developer badge at bottom -->
    <rect x="22" y="274" rx="10" ry="10" width="120" height="24" fill="#ffffff0d" stroke="#ffffff26" />
    <text x="82" y="290" text-anchor="middle" font-family="Segoe UI, Arial" font-size="12" font-weight="700" fill="url(#brandText2)">By Khalid.Agents</text>
  </svg>`);
  comp = comp.composite([{ input: await sharp(labelSvg).png().toBuffer(), top: 0, left: 0 }]);
  // Sharp does not support BMP output; rely on committed asset or future encoder
  throw new Error('BMP output not supported by sharp; please provide public/installer/installerSidebar.bmp');
}

async function main(){
  try{
    await makeHeaderBMP();
    await makeSidebarBMP();
    console.log('Installer assets generated in public/installer');
  }catch(e){
    console.error('Failed to generate installer assets:', e);
    process.exitCode = 1;
  }
}

main();

