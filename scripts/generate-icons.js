// PWA Icon Generator for Equilibrium
// Converts the SVG icon to PNG in various sizes

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
try {
  const sharp = require('sharp');
  
  const sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
  ];

  const svgPath = path.join(__dirname, '../public/icon.svg');
  const publicDir = path.join(__dirname, '../public');

  if (!fs.existsSync(svgPath)) {
    console.error('❌ icon.svg not found in public/ folder');
    process.exit(1);
  }

  console.log('🎨 Generating PWA icons from SVG...\n');

  Promise.all(
    sizes.map(({ size, name }) => {
      const outputPath = path.join(publicDir, name);
      return sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath)
        .then(() => {
          console.log(`✅ Generated ${name} (${size}x${size})`);
        })
        .catch((err) => {
          console.error(`❌ Failed to generate ${name}:`, err.message);
        });
    })
  )
    .then(() => {
      console.log('\n🎉 All icons generated successfully!');
      console.log('\nYou can now:');
      console.log('1. Run `npm run dev` and open in Chrome');
      console.log('2. Click the install icon in the address bar');
      console.log('3. Or deploy and test on mobile device\n');
    })
    .catch((err) => {
      console.error('❌ Error generating icons:', err);
      process.exit(1);
    });

} catch (err) {
  console.error('\n❌ Sharp is not installed.');
  console.log('\n📦 Please install it first:');
  console.log('   npm install --save-dev sharp\n');
  console.log('OR use one of these alternatives:\n');
  console.log('1. Online tool: https://realfavicongenerator.net/');
  console.log('2. ImageMagick: magick icon.svg -resize 192x192 icon-192.png\n');
  process.exit(1);
}
