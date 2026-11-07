# Steam shelf

The spine-out cases and small horizontal stack replace the bottom-shelf books in the Three.js scene. Their
artwork and the Recently played panel use `src/data/recentGames.json`, a saved
snapshot combining the public profile's three latest games with additional
recent activity from its public XML (up to 12 games). The latest three appear
first; the additional games are ordered by recent playtime, not last-played
date. This is not a live
Steam API connection.

Choose the two visible cover faces in `src/data/gameShelfLayout.json`:

- `exposedUprightAppId`: last case in the upright row (Resident Evil Requiem).
- `topStackAppId`: top case in the horizontal stack (Black Myth: Wukong).

These choices reorder only the physical cases. The activity panel keeps its
recent-activity order. Featured covers stay pinned across syncs even if the
games leave recent activity; their artwork is stored separately from history.

Dynamic case materials use the same direct shader output as the room's baked
materials, with warm window-side shading, shelf occlusion, contact shadows,
and the shared day/night blend uniform. The panel retains original artwork.

Run `npm run sync:steam` to refresh the snapshot and local portrait covers, then
rebuild/deploy the portfolio. The sync reads only public recent-game data. It
keeps the previous snapshot if Steam returns no games, its markup changes,
or a cover download fails. Artwork URLs come from Steam's public store metadata.

Placement and the original books' measured bounds live in
`src/scripts/special-interactions/gameShelf.js`. The books are part of the
merged `texture-six` mesh in `public/models/RoomV3_export-v1.glb`; only their
306 triangles are removed at runtime. If that export changes, the replacement
stops safely rather than removing a different part of the model. The original
Blender files and GLB stay intact.
