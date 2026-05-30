import fs from "fs";
import path from "path";

let cachedBase64: string | null = null;

// For emails — returns a hosted HTTPS URL that email clients can fetch.
// data: URLs are stripped by Gmail and most clients, so we use the public URL instead.
export function getLogoUrl(): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  return `${base}/images/inspire9Logo.png`;
}

// For PDFs only — base64 so the PDF renderer can embed it server-side.
export function getLogoDataUrl(): string {
  if (cachedBase64) return cachedBase64;

  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "images",
      "inspire9Logo.png",
    );
    const buffer = fs.readFileSync(filePath);
    cachedBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
    return cachedBase64;
  } catch {
    console.warn("[email] inspire9Logo.png not found in public/images/");
    return "";
  }
}
