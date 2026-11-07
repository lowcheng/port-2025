import { mkdir, readFile, writeFile } from "node:fs/promises";

// This creates a public, static snapshot. No API keys or profile status are stored.
const profileUrl = "https://steamcommunity.com/profiles/76561198076864296/";
const layout = JSON.parse(
  await readFile(
    new URL("../src/data/gameShelfLayout.json", import.meta.url),
    "utf8",
  ),
);
const featuredIds = [
  ...new Set(
    [layout.exposedUprightAppId, layout.topStackAppId].filter(Number.isInteger),
  ),
];
const response = await fetch(profileUrl, {
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw new Error(`Steam profile returned ${response.status}`);
const html = await response.text();
const decode = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
const games = [
  ...html.matchAll(
    /<div class="recent_game">([\s\S]*?)(?=<div class="recent_game">|<div class="recentgame_quicklinks")/g,
  ),
].map(([, block]) => {
  const title = block.match(
    /class="game_name">\s*<a[^>]*href="https:\/\/steamcommunity.com\/app\/(\d+)"[^>]*>([^<]+)<\/a>/,
  );
  if (!title) throw new Error("Steam recent games markup changed");
  return {
    appId: Number(title[1]),
    name: decode(title[2]),
    hoursOnRecord: Number(
      block.match(/([\d.,]+) hrs on record/)?.[1]?.replaceAll(",", "") ?? 0,
    ),
    lastPlayedLabel:
      block.match(/last played on\s+([^<\t\r\n]+)/)?.[1]?.trim() ?? null,
    cover: `/images/steam/${title[1]}.jpg`,
    url: `https://store.steampowered.com/app/${title[1]}/`,
  };
});
// The profile homepage exposes three latest games. Its public XML exposes
// additional recent activity, ordered by recent playtime rather than date.
const activityResponse = await fetch(`${profileUrl}?xml=1`, {
  signal: AbortSignal.timeout(20000),
});
if (!activityResponse.ok)
  throw new Error(`Steam activity returned ${activityResponse.status}`);
const activityXml = await activityResponse.text();
const xmlValue = (block, tag) => {
  const value =
    block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? "";
  return decode(value.replace(/^<!\[CDATA\[|\]\]>$/g, "").trim());
};
for (const [, block] of activityXml.matchAll(
  /<mostPlayedGame>([\s\S]*?)<\/mostPlayedGame>/g,
)) {
  if (games.length >= 12) break;
  const appId = Number(xmlValue(block, "gameLink").match(/\/app\/(\d+)/)?.[1]);
  const name = xmlValue(block, "gameName");
  if (!appId || !name) continue;
  const existing = games.find((game) => game.appId === appId);
  if (existing) continue;
  games.push({
    appId,
    name,
    hoursOnRecord: Number(xmlValue(block, "hoursOnRecord")),
    lastPlayedLabel: null,
    cover: `/images/steam/${appId}.jpg`,
    url: `https://store.steampowered.com/app/${appId}/`,
  });
}
if (!games.length)
  throw new Error(
    "No public recent games found; keeping the previous snapshot",
  );
await mkdir(new URL("../public/images/steam/", import.meta.url), {
  recursive: true,
});
const artworkQuery = new URLSearchParams({
  input_json: JSON.stringify({
    ids: [...new Set([...games.map((game) => game.appId), ...featuredIds])].map(
      (appid) => ({ appid }),
    ),
    context: { language: "english", country_code: "SG" },
    data_request: { include_assets: true },
  }),
});
const artworkResponse = await fetch(
  `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?${artworkQuery}`,
  {
    signal: AbortSignal.timeout(20000),
  },
);
if (!artworkResponse.ok)
  throw new Error(`Steam artwork metadata returned ${artworkResponse.status}`);
const artworkItems = (await artworkResponse.json()).response?.store_items ?? [];
// Featured cases stay on display even after leaving the recent-activity list.
const featuredGames = featuredIds
  .filter((id) => !games.some((game) => game.appId === id))
  .map((appId) => {
    const item = artworkItems.find((entry) => entry.appid === appId);
    if (!item?.name)
      throw new Error(
        `Featured game ${appId} is unavailable; keeping the previous snapshot`,
      );
    return {
      appId,
      name: item.name,
      cover: `/images/steam/${appId}.jpg`,
      url: `https://store.steampowered.com/app/${appId}/`,
    };
  });
for (const game of [...games, ...featuredGames]) {
  const assets = artworkItems.find((item) => item.appid === game.appId)?.assets;
  const portrait = assets?.library_capsule_2x ?? assets?.library_capsule;
  const artworkUrl =
    portrait && assets?.asset_url_format
      ? `https://shared.fastly.steamstatic.com/store_item_assets/${assets.asset_url_format.replace("${FILENAME}", portrait)}`
      : `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/library_600x900.jpg`;
  const cover = await fetch(artworkUrl, { signal: AbortSignal.timeout(20000) });
  if (!cover.ok || !cover.headers.get("content-type")?.startsWith("image/"))
    throw new Error(`Missing portrait artwork for ${game.name}`);
  await writeFile(
    new URL(`../public${game.cover}`, import.meta.url),
    Buffer.from(await cover.arrayBuffer()),
  );
}
await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../src/data/recentGames.json", import.meta.url),
  JSON.stringify(
    { profileUrl, fetchedAt: new Date().toISOString(), games, featuredGames },
    null,
    2,
  ) + "\n",
);
console.log(`Updated shelf: ${games.map((game) => game.name).join(", ")}`);
