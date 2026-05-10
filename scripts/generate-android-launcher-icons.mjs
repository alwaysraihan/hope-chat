/**
 * Builds legacy launcher PNGs for each mipmap density from hopechat-web/logo.png.
 * Run: node scripts/generate-android-launcher-icons.mjs
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
const ANDROID_RES = path.join(root, 'android', 'app', 'src', 'main', 'res');

/** Launcher bitmap side length (square) per density bucket. */
const DENSITIES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function main() {
  const buf = await readFile(LOGO_SRC);

  for (const [folder, size] of Object.entries(DENSITIES)) {
    const dir = path.join(ANDROID_RES, folder);
    await mkdir(dir, { recursive: true });

    const resized = await sharp(buf)
      .resize(size, size, { fit: 'contain', background: '#FFFFFF' })
      .png()
      .toBuffer();

    await writeFile(path.join(dir, 'ic_launcher.png'), resized);
    await writeFile(path.join(dir, 'ic_launcher_round.png'), resized);
    await writeFile(path.join(dir, 'ic_launcher_foreground.png'), resized);
  }

  console.log('Android launcher mipmaps written:', Object.keys(DENSITIES).join(', '));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
