#!/usr/bin/env node
// AutoVJ Library Sync
// 1. Convert .ncm → .mp3 (requires ncmdump: brew install ncmdump)
// 2. Rename meta/track-{ID}.jpg covers to match song names
// 3. Copy .lrc + .jpg + .mp3 to DJ output folder
//
// Usage: node scripts/sync-library.js [options]
//   --source ~/Music/网易云音乐     (where .ncm/.lrc files are)
//   --output ~/Desktop/dj/lyrics_and_covers  (where to sync results)
//
// Without arguments, scans common locations automatically.

import { readdirSync, copyFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, basename, extname, dirname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

// --- Parse arguments ---
const args = process.argv.slice(2);
let sourceDir = null;
let outputDir = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--source' && args[i + 1]) sourceDir = args[++i];
  if (args[i] === '--output' && args[i + 1]) outputDir = args[++i];
}

// --- Auto-detect source directories ---
const sourceDirs = [];
if (sourceDir) {
  sourceDirs.push(sourceDir);
} else {
  // Common NetEase Cloud Music locations
  const candidates = [
    join(homedir(), 'Music/网易云音乐'),
    join(homedir(), 'Music/NetEase Cloud Music'),
    join(homedir(), 'Downloads/网易云音乐'),
    join(homedir(), 'Desktop/网易云音乐'),
  ];
  // Also scan /Volumes/ for external drives
  try {
    for (const vol of readdirSync('/Volumes')) {
      if (vol === 'Macintosh HD') continue;
      candidates.push(join('/Volumes', vol, '网易云音乐'));
      candidates.push(join('/Volumes', vol, 'Music/网易云音乐'));
      candidates.push(join('/Volumes', vol, 'NetEase Cloud Music'));
    }
  } catch {}

  for (const dir of candidates) {
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      // Check if it has .ncm or .lrc files
      try {
        const files = readdirSync(dir);
        if (files.some(f => f.endsWith('.ncm') || f.endsWith('.lrc'))) {
          sourceDirs.push(dir);
        }
      } catch {}
    }
  }
}

if (sourceDirs.length === 0) {
  console.log('No music source folders found. Use --source to specify.');
  process.exit(0);
}

// --- Auto-detect output directory ---
if (!outputDir) {
  const candidates = [
    join(homedir(), 'Desktop/dj/lyrics_and_covers'),
    join(homedir(), 'Desktop/DJ/lyrics_and_covers'),
  ];
  outputDir = candidates.find(d => existsSync(dirname(d))) || candidates[0];
}
mkdirSync(outputDir, { recursive: true });

console.log('=== AutoVJ Library Sync ===');
console.log(`Sources: ${sourceDirs.join(', ')}`);
console.log(`Output:  ${outputDir}\n`);

// --- Check ncmdump ---
let hasNcmdump = false;
try {
  execSync('which ncmdump', { stdio: 'pipe' });
  hasNcmdump = true;
} catch {
  // Check common brew locations
  const brewPaths = ['/usr/local/bin/ncmdump', '/opt/homebrew/bin/ncmdump'];
  for (const p of brewPaths) {
    if (existsSync(p)) { hasNcmdump = true; break; }
  }
}

let totalConverted = 0;
let totalCovers = 0;
let totalSynced = 0;

for (const srcDir of sourceDirs) {
  console.log(`\n--- Processing: ${srcDir} ---`);

  // Step 1: Convert .ncm → .mp3
  const ncmFiles = readdirSync(srcDir).filter(f => f.endsWith('.ncm'));
  const unconverted = ncmFiles.filter(f => {
    const mp3Name = f.replace('.ncm', '.mp3');
    const flacName = f.replace('.ncm', '.flac');
    return !existsSync(join(srcDir, mp3Name)) && !existsSync(join(srcDir, flacName));
  });

  if (unconverted.length > 0) {
    if (hasNcmdump) {
      console.log(`Converting ${unconverted.length} .ncm files...`);
      for (const ncm of unconverted) {
        try {
          execSync(`ncmdump "${join(srcDir, ncm)}"`, { stdio: 'pipe', cwd: srcDir });
          console.log(`  ✓ ${ncm}`);
          totalConverted++;
        } catch (err) {
          console.log(`  ✗ ${ncm}: ${err.message.split('\n')[0]}`);
        }
      }
    } else {
      console.log(`${unconverted.length} .ncm files need conversion but ncmdump not found.`);
      console.log('Install with: brew install ncmdump');
    }
  }

  // Step 2: Rename meta/track-{ID}.jpg → song name
  const metaDir = join(srcDir, 'meta');
  const lrcFiles = readdirSync(srcDir).filter(f => f.endsWith('.lrc'));
  const songNames = lrcFiles.map(f => basename(f, '.lrc'));

  // Find songs that don't have same-name covers yet
  const needCover = songNames.filter(name =>
    !existsSync(join(srcDir, name + '.jpg')) &&
    !existsSync(join(srcDir, name + '.png'))
  );

  if (needCover.length > 0 && existsSync(metaDir)) {
    const trackFiles = readdirSync(metaDir).filter(f => /^track-\d+\.jpg$/.test(f));
    const trackIds = trackFiles.map(f => f.match(/track-(\d+)\.jpg/)[1]);

    if (trackIds.length > 0) {
      console.log(`Resolving ${needCover.length} covers via NetEase API...`);
      try {
        const url = `https://music.163.com/api/song/detail?ids=[${trackIds.join(',')}]`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await res.json();

        if (data.songs) {
          const normalize = s => s.toLowerCase().replace(/\s+/g, '').replace(/[()（）【】\[\],，、.]/g, '');

          for (const song of data.songs) {
            const id = String(song.id);
            const artists = song.artists?.map(a => a.name).join(',') || '';
            const title = song.name || '';
            const fullName = artists ? `${artists} - ${title}` : title;
            const normalizedFull = normalize(fullName);

            for (const songName of [...needCover]) {
              const normalizedSong = normalize(songName);
              if (normalizedFull.includes(normalizedSong) ||
                  normalizedSong.includes(normalizedFull) ||
                  normalizedSong.includes(normalize(title))) {
                const src = join(metaDir, `track-${id}.jpg`);
                const dest = join(srcDir, songName + '.jpg');
                if (existsSync(src) && !existsSync(dest)) {
                  copyFileSync(src, dest);
                  totalCovers++;
                  needCover.splice(needCover.indexOf(songName), 1);
                  break;
                }
              }
            }
          }
        }
      } catch (err) {
        console.log(`  API error: ${err.message}`);
      }
    }
  }

  // Step 3: Sync .lrc + .jpg + .mp3 to output folder
  const filesToSync = readdirSync(srcDir).filter(f =>
    /\.(lrc|jpg|jpeg|png|mp3|flac)$/i.test(f)
  );

  let synced = 0;
  for (const file of filesToSync) {
    const dest = join(outputDir, file);
    if (!existsSync(dest)) {
      copyFileSync(join(srcDir, file), dest);
      synced++;
    }
  }
  if (synced > 0) totalSynced += synced;
}

console.log('\n=== Summary ===');
if (totalConverted > 0) console.log(`Converted: ${totalConverted} .ncm → .mp3`);
if (totalCovers > 0) console.log(`Covers matched: ${totalCovers}`);
if (totalSynced > 0) console.log(`Files synced to output: ${totalSynced}`);
if (totalConverted + totalCovers + totalSynced === 0) console.log('Everything up to date!');
console.log('');
