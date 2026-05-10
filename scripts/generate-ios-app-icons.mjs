/**
 * Fills ios/…/AppIcon.appiconset from hopechat-web/logo.png.
 * Run: node scripts/generate-ios-app-icons.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require(
  require.resolve('sharp', {
    paths: [path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'react-native-bootsplash')],
  }),
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const LOGO_SRC = path.resolve(root, '..', 'hopechat-web', 'logo.png');
const OUT_DIR = path.join(root, 'ios', 'hopeChat', 'Images.xcassets', 'AppIcon.appiconset');

/** pixel side length -> output filename */
const SIZES = [
  [40, 'AppIcon-20@2x.png'],
  [60, 'AppIcon-20@3x.png'],
  [58, 'AppIcon-29@2x.png'],
  [87, 'AppIcon-29@3x.png'],
  [80, 'AppIcon-40@2x.png'],
  [120, 'AppIcon-40@3x.png'],
  [120, 'AppIcon-60@2x.png'],
  [180, 'AppIcon-60@3x.png'],
  [1024, 'AppIcon-1024.png'],
];

const CONTENTS = {
  images: [
    { filename: 'AppIcon-20@2x.png', idiom: 'iphone', scale: '2x', size: '20x20' },
    { filename: 'AppIcon-20@3x.png', idiom: 'iphone', scale: '3x', size: '20x20' },
    { filename: 'AppIcon-29@2x.png', idiom: 'iphone', scale: '2x', size: '29x29' },
    { filename: 'AppIcon-29@3x.png', idiom: 'iphone', scale: '3x', size: '29x29' },
    { filename: 'AppIcon-40@2x.png', idiom: 'iphone', scale: '2x', size: '40x40' },
    { filename: 'AppIcon-40@3x.png', idiom: 'iphone', scale: '3x', size: '40x40' },
    { filename: 'AppIcon-60@2x.png', idiom: 'iphone', scale: '2x', size: '60x60' },
    { filename: 'AppIcon-60@3x.png', idiom: 'iphone', scale: '3x', size: '60x60' },
    { filename: 'AppIcon-1024.png', idiom: 'ios-marketing', scale: '1x', size: '1024x1024' },
  ],
  info: { author: 'xcode', version: 1 },
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const buf = await readFile(LOGO_SRC);
  for (const [px, name] of SIZES) {
    const out = path.join(OUT_DIR, name);
    const resized = await sharp(buf)
      .resize(px, px, { fit: 'contain', background: '#FFFFFF' })
      .png()
      .toBuffer();
    await writeFile(out, resized);
  }

  await writeFile(path.join(OUT_DIR, 'Contents.json'), JSON.stringify(CONTENTS, null, 2) + '\n');
  console.log('iOS AppIcon.appiconset written:', OUT_DIR);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
