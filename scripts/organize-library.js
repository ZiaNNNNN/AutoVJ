#!/usr/bin/env node
// Organizes a NetEase Cloud Music library by renaming meta/track-{ID}.jpg
// to match the song filenames, so covers can be matched by name.
//
// Usage: node scripts/organize-library.js [music-dir]
// Default: ~/Music/网易云音乐/

import { readdirSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename, extname } from 'path';
import { homedir } from 'os';

const musicDir = process.argv[2] || join(homedir(), 'Music/网易云音乐');
const metaDir = join(musicDir, 'meta');

console.log(`Organizing: ${musicDir}\n`);

// Step 1: Find all song names (from .lrc files)
const songNames = [];
for (const file of readdirSync(musicDir)) {
  if (extname(file).toLowerCase() === '.lrc') {
    songNames.push(basename(file, '.lrc'));
  }
}
console.log(`Found ${songNames.length} songs with lyrics`);

// Step 2: Check which already have same-name covers
let alreadyHave = 0;
let needCover = [];
for (const name of songNames) {
  const hasJpg = existsSync(join(musicDir, name + '.jpg'));
  const hasPng = existsSync(join(musicDir, name + '.png'));
  if (hasJpg || hasPng) {
    alreadyHave++;
  } else {
    needCover.push(name);
  }
}
console.log(`${alreadyHave} already have same-name covers`);
console.log(`${needCover.length} need covers\n`);

if (needCover.length === 0) {
  console.log('All songs have covers! Nothing to do.');
  process.exit(0);
}

// Step 3: Resolve track IDs from meta/ folder via NetEase API
if (!existsSync(metaDir)) {
  console.log('No meta/ folder found. Cannot resolve covers.');
  console.log('You can manually add .jpg files with the same name as your .lrc files.');
  process.exit(0);
}

const trackFiles = readdirSync(metaDir).filter(f => /^track-\d+\.jpg$/.test(f));
const trackIds = trackFiles.map(f => f.match(/track-(\d+)\.jpg/)[1]);

console.log(`Found ${trackFiles.length} covers in meta/ folder`);
console.log('Resolving track IDs via NetEase API...\n');

try {
  const url = `https://music.163.com/api/song/detail?ids=[${trackIds.join(',')}]`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = await res.json();

  if (!data.songs) {
    console.error('NetEase API returned no data');
    process.exit(1);
  }

  let copied = 0;
  for (const song of data.songs) {
    const id = String(song.id);
    const artists = song.artists?.map(a => a.name).join(',') || '';
    const title = song.name || '';

    // Try to match against songs that need covers
    const fullName = artists ? `${artists} - ${title}` : title;

    // Fuzzy match: find the best matching song name
    const normalize = s => s.toLowerCase().replace(/\s+/g, '').replace(/[()（）【】\[\],，、.]/g, '');
    const normalizedFull = normalize(fullName);

    for (const songName of needCover) {
      const normalizedSong = normalize(songName);
      if (normalizedFull.includes(normalizedSong) ||
          normalizedSong.includes(normalizedFull) ||
          normalize(title) === normalizedSong.split('-').pop() ||
          normalizedSong.includes(normalize(title))) {

        const src = join(metaDir, `track-${id}.jpg`);
        const dest = join(musicDir, songName + '.jpg');

        if (existsSync(src) && !existsSync(dest)) {
          copyFileSync(src, dest);
          console.log(`  ${songName}.jpg ← track-${id}.jpg`);
          copied++;
          // Remove from needCover
          needCover = needCover.filter(n => n !== songName);
          break;
        }
      }
    }
  }

  console.log(`\nCopied ${copied} covers.`);
  if (needCover.length > 0) {
    console.log(`\n${needCover.length} songs still missing covers:`);
    needCover.forEach(n => console.log(`  - ${n}`));
  } else {
    console.log('All songs now have same-name covers!');
  }
} catch (err) {
  console.error('Error:', err.message);
}
