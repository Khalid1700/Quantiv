// tools/make-icons.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');
const icongen = require('icon-gen');

const SRC = path.join(__dirname, '..', 'public', 'icons', 'app.png');
const OUT = path.join(__dirname, '..', 'public', 'icons');
const TMP = path.join(__dirname, '..', 'temp_icons');

// Ensure source exists
if (!fs.existsSync(SRC)) {
  console.error('❌ Source icon not found:', SRC);
  console.error('Please place a high-resolution app.png in public/icons directory');
  process.exit(1);
}

// Create temp directory if it doesn't exist
if (!fs.existsSync(TMP)) {
  fs.mkdirSync(TMP, { recursive: true });
}

// All required sizes for different platforms
const pngSizes = [16, 32, 48, 64, 128, 256, 512];
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icnsSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

// Combine all sizes uniquely for batch processing
const allSizes = [...new Set([...pngSizes, ...icoSizes, ...icnsSizes])].sort((a, b) => a - b);

(async () => {
  try {
    console.log('🎨 Generating icons from:', SRC);

    // Generate all required PNG sizes at once
    console.log('📏 Creating PNG files...');
    for (const size of allSizes) {
      // Save to both output and temp directories
      const outFile = path.join(OUT, `app-${size}.png`);
      const tmpFile = path.join(TMP, `${size}.png`);
      
      await sharp(SRC)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(tmpFile);
      
      // Only copy to output directory if it's one of our desired final sizes
      if (pngSizes.includes(size)) {
        fs.copyFileSync(tmpFile, outFile);
        console.log(`   ✓ ${size}x${size}`);
      }
    }

    // Generate Windows ICO
    console.log('🪟 Creating Windows ICO...');
    const icoBuffers = await Promise.all(
      icoSizes.map(size => fs.readFileSync(path.join(TMP, `${size}.png`)))
    );
    const icoBuffer = await toIco(icoBuffers);
    fs.writeFileSync(path.join(OUT, 'app.ico'), icoBuffer);
    console.log('   ✓ app.ico');

    // Generate macOS ICNS
    console.log('🍎 Creating macOS ICNS...');
    await icongen(TMP, OUT, {
      report: true,
      icns: {
        name: 'app',
        sizes: icnsSizes
      },
      ico: { sizes: [] } // Disable ICO generation as we've done it manually
    });
    console.log('   ✓ app.icns');

    // Clean up temporary files
    fs.rmSync(TMP, { recursive: true, force: true });

    console.log('✅ All icons generated successfully in public/icons!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    // Clean up temporary files in case of error
    if (fs.existsSync(TMP)) {
      fs.rmSync(TMP, { recursive: true, force: true });
    }
    process.exit(1);
  }
})();
