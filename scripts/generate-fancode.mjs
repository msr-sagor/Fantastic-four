import fs from "fs/promises";
import path from "path";

const JSON_URL =
  "https://raw.githubusercontent.com/Jitendra-unatti/fancode/refs/heads/main/data/fancode.json";

const BASE_URL = "https://msr-sagor.github.io/Fantastic-four";

async function main() {
  const response = await fetch(JSON_URL, {
    cache: "no-store",
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

  // পুরনো generated files delete
  const oldFiles = await fs.readdir(docsDir).catch(() => []);
  for (const file of oldFiles) {
    if (
      file.endsWith(".m3u8") ||
      file === "playlist.m3u"
    ) {
      await fs.unlink(path.join(docsDir, file)).catch(() => {});
    }
  }

  // required static files recreate
  await fs.writeFile(path.join(docsDir, ".nojekyll"), "", "utf8");

  await fs.writeFile(
    path.join(docsDir, "index.html"),
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>FanCode Playlist</title>
</head>
<body style="font-family:Arial;text-align:center;padding:40px">
  <h1>FanCode Playlist</h1>
  <p><a href="./playlist.m3u">Open playlist.m3u</a></p>
</body>
</html>`,
    "utf8"
  );

  const playlist = ["#EXTM3U"];
  const seen = new Set();

  for (const item of matches) {
    const matchId = String(item?.match_id || "").trim();
    const language = cleanText(item?.language || "UNKNOWN");
    const master = item?.auto_streams?.[0]?.auto;

    // playable stream না থাকলে skip
    if (!matchId || !master || typeof master !== "string") continue;

    const key = `${matchId}_${language}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let content = master.replace(/https:\/\/in-/g, "https://bd-").trim();
    if (!content.startsWith("#EXTM3U")) {
      content = "#EXTM3U\n" + content;
    }

    const rawTitle = cleanTitle(item?.title || `Match ${matchId}`);
    const finalTitle = `${rawTitle} [${language}]`;
    const logo = item?.image || "";
    const category = cleanText(item?.category || "FanCode");
    const fileName = `${matchId}_${safeName(language)}.m3u8`;

    await fs.writeFile(path.join(docsDir, fileName), content, "utf8");

    playlist.push(
      `#EXTINF:-1 tvg-id="${escapeAttr(
        matchId
      )}" tvg-name="${escapeAttr(finalTitle)}" tvg-logo="${escapeAttr(
        logo
      )}" tvg-language="${escapeAttr(
        language
      )}" group-title="${escapeAttr(category)}",${finalTitle}`
    );
    playlist.push(`${BASE_URL}/${fileName}`);
  }

  await fs.writeFile(
    path.join(docsDir, "playlist.m3u"),
    playlist.join("\n"),
    "utf8"
  );

  console.log(`Generated ${seen.size} active streams`);
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

function escapeAttr(value) {
  return String(value ?? "").replace(/"/g, "&quot;");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
