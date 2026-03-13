import fs from "fs/promises";
import path from "path";

const JSON_URL =
  "https://raw.githubusercontent.com/Jitendra-unatti/fancode/refs/heads/main/data/fancode.json";

const PAGES_BASE = process.env.PAGES_BASE_URL || "https://msr-sagor.github.io/Fantastic-four/";

async function main() {
  const response = await fetch(JSON_URL, {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch JSON source: ${response.status}`);
  }

  const json = await response.json();
  const matches = Array.isArray(json?.matches) ? json.matches : [];

  const docsDir = path.join(process.cwd(), "docs");
  await fs.mkdir(docsDir, { recursive: true });

  await fs.writeFile(path.join(docsDir, ".nojekyll"), "", "utf8");

  const lines = ["#EXTM3U"];
  const seen = new Set();

  for (const item of matches) {
    const matchId = String(item?.match_id || "").trim();
    const language = cleanText(item?.language || "UNKNOWN");
    const master = item?.auto_streams?.[0]?.auto;

    if (!matchId || !master || typeof master !== "string") continue;

    const uniqueKey = `${matchId}_${language}`;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);

    const rawTitle = cleanTitle(item?.title || `Match ${matchId}`);
    const finalTitle = `${rawTitle} [${language}]`;

    const logo = item?.image || "";
    const category = cleanText(item?.category || "FanCode");

    let content = master.replace(/https:\/\/in-/g, "https://bd-").trim();
    if (!content.startsWith("#EXTM3U")) {
      content = "#EXTM3U\n" + content;
    }

    const fileName = `${matchId}_${safeName(language)}.m3u8`;
    const filePath = path.join(docsDir, fileName);

    await fs.writeFile(filePath, content, "utf8");

    lines.push(
      `#EXTINF:-1 tvg-id="${escapeAttr(
        matchId
      )}" tvg-name="${escapeAttr(finalTitle)}" tvg-logo="${escapeAttr(
        logo
      )}" tvg-language="${escapeAttr(
        language
      )}" group-title="${escapeAttr(category)}",${finalTitle}`
    );
    lines.push(`${PAGES_BASE}/${fileName}`);
  }

  await fs.writeFile(path.join(docsDir, "playlist.m3u"), lines.join("\n"), "utf8");

  await fs.writeFile(
    path.join(docsDir, "index.html"),
    buildIndexHtml(PAGES_BASE),
    "utf8"
  );

  console.log(`Generated ${seen.size} stream files`);
}

function buildIndexHtml(base) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FanCode Playlist</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 16px; }
    a { word-break: break-all; }
  </style>
</head>
<body>
  <h1>FanCode Playlist</h1>
  <p><a href="${base}/playlist.m3u">Open playlist.m3u</a></p>
</body>
</html>`;
}

function escapeAttr(value) {
  return String(value ?? "").replace(/"/g, "&quot;");
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .replace(/\s+Vs\s+/gi, " Vs ")
    .trim();
}

function safeName(value) {
  return String(value || "UNKNOWN")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]/g, "_");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
