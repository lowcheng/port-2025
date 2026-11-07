import test from "node:test";
import assert from "node:assert/strict";
import { getOnRepeat, spotifyResponse } from "../server/spotify.mjs";

test("unconnected account never contacts Spotify", async () => {
  const result = await spotifyResponse({}, () => {
    throw new Error("must not fetch");
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.deepEqual(await result.json(), {
    status: "not_connected",
    tracks: [],
  });
});

test("refreshes privately and returns only safe display metadata", async () => {
  const calls = [];
  const result = await getOnRepeat(
    {
      SPOTIFY_CLIENT_ID: "test-client",
      SPOTIFY_REFRESH_TOKEN: "private-refresh",
    },
    async (url, options) => {
      calls.push([url, options]);
      if (url.includes("/api/token"))
        return Response.json({ access_token: "private-access" });
      return Response.json({
        items: [
          {
            id: "1234567890123456789012",
            name: "Song",
            artists: [{ name: "Artist" }],
            album: {
              name: "Album",
              images: [{ width: 300, url: "https://i.scdn.co/image/cover" }],
            },
            preview_url: null,
            private_field: "private",
          },
          {
            id: "2234567890123456789012",
            name: "Other",
            preview_url: "https://p.scdn.co/mp3-preview/clip",
          },
          {
            id: "3234567890123456789012",
            name: "Unsafe",
            preview_url: "https://scdn.co.attacker.example/clip",
          },
          { id: "bad/url", name: "Invalid" },
        ],
      });
    },
  );
  assert.equal(calls[0][1].body.get("grant_type"), "refresh_token");
  assert.equal(calls[0][1].body.get("refresh_token"), "private-refresh");
  assert.equal(calls[1][1].headers.Authorization, "Bearer private-access");
  assert.match(calls[1][0], /time_range=short_term&limit=5$/);
  assert.equal(result.tracks.length, 3);
  assert.equal(result.tracks[0].previewUrl, null);
  assert.equal(
    result.tracks[1].previewUrl,
    "https://p.scdn.co/mp3-preview/clip",
  );
  assert.equal(result.tracks[2].previewUrl, null);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private|access_token|refresh_token/,
  );
});

test("authentication errors do not expose details and cannot be cached", async () => {
  const result = await spotifyResponse(
    { SPOTIFY_REFRESH_TOKEN: "secret" },
    async () => Response.json({ error: "secret-token" }, { status: 400 }),
  );
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.deepEqual(await result.json(), { status: "unavailable", tracks: [] });
});
