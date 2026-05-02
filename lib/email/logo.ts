import fs from "fs";
import path from "path";

// Cache so the file is only read once per server process
let cached: string | null = null;

// Returns the Inspire9 logo as a base64 data URL.
// This embeds the image directly in emails and PDFs so it works in any
// environment (localhost dev, Vercel, email clients) without needing a public URL.
export function getLogoDataUrl(): string {
  if (cached) return cached;

  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "images",
      "inspire9Logo.png",
    );
    const buffer = fs.readFileSync(filePath);
    cached = `data:image/png;base64,${buffer.toString("base64")}`;
    return cached;
  } catch {
    // Fallback — logo file missing or unreadable
    console.warn("[email] inspire9Logo.png not found in public/images/");
    return "";
  }
}
