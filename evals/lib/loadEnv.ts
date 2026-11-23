import { existsSync } from "node:fs";
import path from "node:path";

// Loads OPENAI_API_KEY / OPENAI_MODEL from the same files Next.js reads, so
// the evals use the app's configuration. Earlier files win (loadEnvFile
// never overrides a variable that is already set), giving Next's
// precedence: real environment > .env.local > .env.
// Must be the first import of every runner: openaiClient reads
// OPENAI_MODEL when it is first imported.
const ROOT = path.join(import.meta.dirname, "..", "..");

for (const name of [".env.local", ".env"]) {
  const file = path.join(ROOT, name);
  if (existsSync(file)) process.loadEnvFile(file);
}
