#!/usr/bin/env node
// Generates PWA PNG icons using only Node.js built-in modules (zlib + fs).
// Run: node generate-icons.js

const zlib = require('zlib')
const fs   = require('fs')
const path = require('path')

// ── CRC32 ─────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  CRC_TABLE[i] = c
}
function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t   = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

// ── PNG builder ────────────────────────────────────────────────
function makePNG(size) {
  const BG = [0x16, 0x5D, 0xFF]   // #165DFF brand blue
  const FG = [0xFF, 0xFF, 0xFF]   // white

  // Fill background
  const px = new Uint8Array(size * size * 3)
  for (let i = 0; i < size * size; i++) {
    px[i*3] = BG[0]; px[i*3+1] = BG[1]; px[i*3+2] = BG[2]
  }

  // Draw white "U" centered (proportional to size)
  const pad  = Math.round(size * 0.22)
  const bar  = Math.max(2, Math.round(size * 0.12))
  const top  = Math.round(size * 0.18)
  const bot  = Math.round(size * 0.82)
  const crvH = Math.round(size * 0.22)  // curved bottom height
  const lx   = pad
  const rx   = size - pad - bar

  function setPixel(x, y) {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 3
    px[i] = FG[0]; px[i+1] = FG[1]; px[i+2] = FG[2]
  }

  // Left vertical bar
  for (let y = top; y < bot - crvH; y++)
    for (let x = lx; x < lx + bar; x++) setPixel(x, y)

  // Right vertical bar
  for (let y = top; y < bot - crvH; y++)
    for (let x = rx; x < rx + bar; x++) setPixel(x, y)

  // Bottom fill (connecting bottom of the U)
  for (let y = bot - crvH; y < bot; y++)
    for (let x = lx; x <= rx + bar - 1; x++) setPixel(x, y)

  // Inner cutout to make it hollow (U shape, not filled rectangle)
  const innerTop = bot - crvH
  const innerL   = lx + bar
  const innerR   = rx
  for (let y = innerTop; y < bot - bar; y++)
    for (let x = innerL; x < innerR; x++) {
      const i = (y * size + x) * 3
      px[i] = BG[0]; px[i+1] = BG[1]; px[i+2] = BG[2]
    }

  // Build scanlines (filter byte 0 = None per row)
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    row[0] = 0
    for (let x = 0; x < size; x++) {
      const p = (y * size + x) * 3
      row[1 + x*3] = px[p]; row[1 + x*3+1] = px[p+1]; row[1 + x*3+2] = px[p+2]
    }
    rows.push(row)
  }

  const raw  = Buffer.concat(rows)
  const idat = zlib.deflateSync(raw, { level: 9 })

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8]=8; ihdr[9]=2  // 8-bit depth, RGB

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),  // PNG sig
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Write files ────────────────────────────────────────────────
const pub     = path.join(__dirname, 'public')
const iconsDir = path.join(pub, 'icons')
fs.mkdirSync(iconsDir, { recursive: true })

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), makePNG(192))
console.log('✅ public/icons/icon-192.png')

fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), makePNG(512))
console.log('✅ public/icons/icon-512.png')

fs.writeFileSync(path.join(pub, 'apple-touch-icon.png'), makePNG(180))
console.log('✅ public/apple-touch-icon.png')

console.log('\n🎉 PWA icons generated!')
