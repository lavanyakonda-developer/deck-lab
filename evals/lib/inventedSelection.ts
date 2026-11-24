// Phrases that say or imply a slide is selected. Used only on replies to
// requests sent with no selected slide, where any such claim is invented:
// the deck context marks no slide in that case.
const SELECTION_CLAIMS: RegExp[] = [
  /\b(?:currently|now)\s+(?:selected|being viewed|viewed|open)\b/i,
  /\b(?:shown|marked|highlighted|displayed)\s+as\s+(?:the\s+)?selected\b/i,
  /\b(?:is|are)\s+(?:currently\s+)?selected\b/i,
  /\bthe\s+selected\s+slide\b/i,
  /\bslide\s+(?:that\s+)?you(?:'ve|\s+have)?\s+selected\b/i,
  /\byou(?:'re|\s+are)\s+(?:currently\s+)?(?:viewing|looking\s+at|on)\s+slide\b/i,
];

// The first phrase in `reply` claiming a slide is selected, or undefined.
export function claimedSelection(reply: string): string | undefined {
  for (const pattern of SELECTION_CLAIMS) {
    const match = reply.match(pattern);
    if (match) return match[0];
  }
  return undefined;
}
