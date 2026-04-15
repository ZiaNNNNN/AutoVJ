// Parses LRC files into timed lyrics array
// Supports standard LRC format: [mm:ss.xx]text
// Also supports NetEase JSON lines: {"t":0,"c":[{"tx":"text"}]}

export function parseLRC(content) {
  const lines = content.split('\n');
  const lyrics = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Try standard LRC format: [mm:ss.xx]text
    const lrcMatch = trimmed.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
    if (lrcMatch) {
      const min = parseInt(lrcMatch[1], 10);
      const sec = parseInt(lrcMatch[2], 10);
      const ms = lrcMatch[3].length === 2
        ? parseInt(lrcMatch[3], 10) * 10
        : parseInt(lrcMatch[3], 10);
      const time = min * 60 + sec + ms / 1000;
      const text = lrcMatch[4].trim();
      if (text) {
        lyrics.push({ time, text });
      }
      continue;
    }

    // Try NetEase JSON format: {"t":1000,"c":[{"tx":"text"}]}
    try {
      const json = JSON.parse(trimmed);
      if (json.t !== undefined && json.c) {
        const text = json.c.map((c) => c.tx || '').join('');
        const time = json.t / 1000;
        if (text.trim()) {
          lyrics.push({ time, text: text.trim() });
        }
        continue;
      }
    } catch {
      // Not JSON, skip
    }
  }

  // Sort by time
  lyrics.sort((a, b) => a.time - b.time);
  return lyrics;
}

// Find the current lyric index for a given time
export function getLyricIndexAtTime(lyrics, time) {
  if (!lyrics.length) return -1;
  // Binary search for the last lyric that starts before `time`
  let lo = 0, hi = lyrics.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lyrics[mid].time <= time) lo = mid + 1;
    else hi = mid - 1;
  }
  return hi;
}
