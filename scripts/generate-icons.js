// Generates placeholder PWA icons using sharp.
// Replace outputs with real branded assets before public launch.
const sharp = require('sharp')
const path = require('path')

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const OUT_DIR = path.join(__dirname, '../public/icons')
const BG = '#003d9b'
const FG = '#ffffff'

// Build a minimal SVG for each size and convert to PNG via sharp
async function makeIcon(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.15) : Math.round(size * 0.12)
  const fontSize = Math.round(size * 0.28)
  const r = maskable ? Math.round(size * 0.12) : Math.round(size * 0.2)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BG}"/>
  <text
    x="${size / 2}"
    y="${size / 2 + fontSize * 0.37}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}"
    font-weight="bold"
    fill="${FG}"
    text-anchor="middle"
  >PX</text>
</svg>`

  const filename = maskable
    ? `maskable-icon-${size}x${size}.png`
    : `icon-${size}x${size}.png`

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(OUT_DIR, filename))

  console.log(`  ✓ ${filename}`)
}

async function makeAppleTouch() {
  const size = 180
  const fontSize = Math.round(size * 0.28)
  const r = Math.round(size * 0.2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BG}"/>
  <text
    x="${size / 2}"
    y="${size / 2 + fontSize * 0.37}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}"
    font-weight="bold"
    fill="${FG}"
    text-anchor="middle"
  >PX</text>
</svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT_DIR, 'apple-touch-icon.png'))
  console.log('  ✓ apple-touch-icon.png')
}

async function makeFavicon(size) {
  const fontSize = Math.round(size * 0.5)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="2" ry="2" fill="${BG}"/>
  <text
    x="${size / 2}"
    y="${size / 2 + fontSize * 0.37}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}"
    font-weight="bold"
    fill="${FG}"
    text-anchor="middle"
  >P</text>
</svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT_DIR, `favicon-${size}x${size}.png`))
  console.log(`  ✓ favicon-${size}x${size}.png`)
}

;(async () => {
  console.log('Generating PWA icons...')
  for (const size of SIZES) await makeIcon(size)
  await makeIcon(512, true) // maskable
  await makeAppleTouch()
  await makeFavicon(32)
  await makeFavicon(16)
  console.log('Done.')
})()
