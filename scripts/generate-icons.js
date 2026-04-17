/**
 * Generate all app icon sizes from a single 1024x1024 source PNG.
 *
 * Usage: node scripts/generate-icons.js <source-icon.png>
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = process.argv[2];
if (!SOURCE) {
  console.error('Usage: node scripts/generate-icons.js <source-1024x1024.png>');
  process.exit(1);
}

const MOBILE_ASSETS = path.join(__dirname, '..', 'apps', 'mobile', 'assets');
const COMPANION_ICONS = path.join(__dirname, '..', 'apps', 'companion', 'src-tauri', 'icons');
const MSIX_ICONS = path.join(__dirname, '..', 'apps', 'companion', 'msix-staging', 'icons');

const targets = [
  // iOS / Expo (mobile assets)
  { path: path.join(MOBILE_ASSETS, 'icon.png'), size: 1024 },
  { path: path.join(MOBILE_ASSETS, 'splash-icon.png'), size: 512 },
  { path: path.join(MOBILE_ASSETS, 'adaptive-icon.png'), size: 1024 },

  // Companion (Tauri icons)
  { path: path.join(COMPANION_ICONS, 'icon.png'), size: 512 },
  { path: path.join(COMPANION_ICONS, '128x128.png'), size: 128 },
  { path: path.join(COMPANION_ICONS, '128x128@2x.png'), size: 256 },
  { path: path.join(COMPANION_ICONS, '32x32.png'), size: 32 },

  // MSIX staging
  { path: path.join(MSIX_ICONS, 'icon.png'), size: 512 },
  { path: path.join(MSIX_ICONS, '128x128.png'), size: 128 },
  { path: path.join(MSIX_ICONS, '128x128@2x.png'), size: 256 },
  { path: path.join(MSIX_ICONS, '32x32.png'), size: 32 },
];

async function generateIco(source, output, sizes) {
  // Generate individual PNGs for ICO
  const buffers = await Promise.all(
    sizes.map(size => sharp(source).resize(size, size).png().toBuffer())
  );

  // Simple ICO file format
  const numImages = buffers.length;
  const headerSize = 6 + numImages * 16;
  let offset = headerSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // ICO type
  header.writeUInt16LE(numImages, 4); // Number of images

  const entries = [];
  for (let i = 0; i < numImages; i++) {
    const entry = Buffer.alloc(16);
    const size = sizes[i];
    entry.writeUInt8(size >= 256 ? 0 : size, 0);  // Width
    entry.writeUInt8(size >= 256 ? 0 : size, 1);  // Height
    entry.writeUInt8(0, 2);    // Color palette
    entry.writeUInt8(0, 3);    // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buffers[i].length, 8);  // Size of image data
    entry.writeUInt32LE(offset, 12);            // Offset
    offset += buffers[i].length;
    entries.push(entry);
  }

  const ico = Buffer.concat([header, ...entries, ...buffers]);
  fs.writeFileSync(output, ico);
}

async function main() {
  console.log(`Source: ${SOURCE}`);

  // Ensure directories exist
  for (const dir of [MOBILE_ASSETS, COMPANION_ICONS, MSIX_ICONS]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generate PNGs
  for (const target of targets) {
    await sharp(SOURCE)
      .resize(target.size, target.size)
      .png()
      .toFile(target.path);
    console.log(`  ✓ ${path.relative(path.join(__dirname, '..'), target.path)} (${target.size}x${target.size})`);
  }

  // Generate ICO for Windows
  const icoPath = path.join(COMPANION_ICONS, 'icon.ico');
  await generateIco(SOURCE, icoPath, [16, 32, 48, 256]);
  console.log(`  ✓ ${path.relative(path.join(__dirname, '..'), icoPath)} (ico: 16,32,48,256)`);

  // Copy ICO to MSIX staging too
  fs.copyFileSync(icoPath, path.join(MSIX_ICONS, 'icon.ico'));

  console.log(`\nDone! Generated ${targets.length + 1} icon files.`);
}

main().catch(e => { console.error(e); process.exit(1); });
