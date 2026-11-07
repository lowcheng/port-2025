// Reorder only the physical cases; the activity panel keeps its recent order.
export function arrangeShelfGames(
  games,
  { exposedUprightAppId, topStackAppId },
) {
  const unique = [...new Map(games.map((game) => [game.appId, game])).values()];
  const upright = unique.find((game) => game.appId === exposedUprightAppId);
  const top = unique.find(
    (game) => game.appId === topStackAppId && game !== upright,
  );
  const featured = [upright, top].filter(Boolean);
  const selected = [
    ...featured,
    ...unique.filter((game) => !featured.includes(game)),
  ].slice(0, 12);
  const remaining = selected.filter((game) => !featured.includes(game));
  const uprightCount = Math.min(8, Math.max(0, selected.length - 2));
  const result = [...remaining];
  if (upright) result.splice(Math.max(0, uprightCount - 1), 0, upright);
  if (top) result.push(top);
  return result;
}
