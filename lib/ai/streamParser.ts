// String-aware extractor of complete top-level JSON objects from a text
// feed that may arrive in arbitrary chunks. Deliberately narrow: it only
// tracks "{" / "}" depth (string-aware, escape-aware) and ignores "[" / "]"
// entirely. That's sufficient - and much simpler than a full incremental
// JSON tokenizer - because every element we ever feed through this starts
// with "{", and any "[" / "]" inside it is always balanced within a "{ }"
// we're already tracking, so it can never cause a false boundary.
export class IncrementalJsonObjectExtractor {
  private inString = false;
  private escapeNext = false;
  private depth = 0;
  private itemBuffer = "";

  // Returns any objects (JSON.parse'd) whose closing "}" arrived in this
  // chunk, in order. Malformed boundaries are skipped, not thrown - a
  // corrupted/truncated stream should degrade, not crash, the caller.
  feed(chunk: string): unknown[] {
    const completed: unknown[] = [];
    for (const ch of chunk) {
      if (this.escapeNext) {
        this.escapeNext = false;
        if (this.depth > 0) this.itemBuffer += ch;
        continue;
      }
      if (this.inString) {
        if (this.depth > 0) this.itemBuffer += ch;
        if (ch === "\\") {
          this.escapeNext = true;
        } else if (ch === '"') {
          this.inString = false;
        }
        continue;
      }
      if (ch === '"') {
        this.inString = true;
        if (this.depth > 0) this.itemBuffer += ch;
        continue;
      }
      if (ch === "{") {
        this.depth += 1;
        this.itemBuffer += ch;
        continue;
      }
      if (ch === "}") {
        this.itemBuffer += ch;
        this.depth -= 1;
        if (this.depth === 0) {
          const raw = this.itemBuffer;
          this.itemBuffer = "";
          try {
            completed.push(JSON.parse(raw));
          } catch {
            // Malformed object boundary - skip it rather than crash the stream.
          }
        }
        continue;
      }
      if (this.depth > 0) this.itemBuffer += ch;
    }
    return completed;
  }
}

const SLIDES_KEY_PATTERN = /"slides"\s*:\s*\[/;

// Schema-specific: locates the "slides":[ key in a streaming
// {"title": ..., "slides": [...]} feed, then extracts each slide object
// as soon as it's complete - well before the overall response finishes.
export class DeckSlideStreamParser {
  private buffer = "";
  private arrayEntered = false;
  private extractor = new IncrementalJsonObjectExtractor();

  feed(chunk: string): unknown[] {
    if (!this.arrayEntered) {
      this.buffer += chunk;
      const match = SLIDES_KEY_PATTERN.exec(this.buffer);
      if (!match) return [];
      this.arrayEntered = true;
      const rest = this.buffer.slice(match.index + match[0].length);
      this.buffer = "";
      return this.extractor.feed(rest);
    }
    return this.extractor.feed(chunk);
  }
}
