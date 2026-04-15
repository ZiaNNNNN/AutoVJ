#!/usr/bin/env node
import 'dotenv/config';
import { join } from 'path';
import { homedir } from 'os';
import { LrcIndex } from './lrcIndex.js';
import { SongAnalyzer } from './songAnalyzer.js';

const MUSIC_DIRS = [join(homedir(), 'Music/网易云音乐')];

const lrcIndex = new LrcIndex(MUSIC_DIRS);
const analyzer = new SongAnalyzer();

if (!analyzer.client) {
  console.error('No ANTHROPIC_API_KEY found. Create .env file with your key.');
  process.exit(1);
}

lrcIndex.scan();

const entries = [...lrcIndex.index.entries()];
console.log(`\nPre-analyzing ${entries.length} songs...\n`);

let done = 0;
let cached = 0;

for (const [, { originalName, content }] of entries) {
  const result = await analyzer.analyze(originalName, content);
  done++;
  const isCached = result !== null && result.mood !== 'neutral';
  if (result._cached) cached++;
  console.log(`[${done}/${entries.length}] ${originalName}`);
  console.log(`  → mood: ${result.mood}, energy: ${result.energy}, keywords: ${result.keywords?.length || 0}`);
  console.log();

  // Rate limit: small delay between API calls
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\nDone! ${done} songs analyzed. Results cached in server/.cache/analysis/`);
