// Server-only: never import this module from src/.
export const SPOTIFY_CLIENT_ID = "2471bb39d5bd440bb3e82a0e22518cda";
export const SPOTIFY_REDIRECT_URI = "http://127.0.0.1:8889/callback";

const httpsUrl = (value, hosts) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      hosts.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
      ? url.href
      : null;
  } catch {
    return null;
  }
};

export function publicTracks(items) {
  return items
    .filter((track) => /^[a-zA-Z0-9]{22}$/.test(track.id))
    .slice(0, 5)
    .map((track) => ({
      id: track.id,
      name: track.name,
      artists: (track.artists || []).map((artist) => artist.name).join(", "),
      album: track.album?.name || "",
      artwork: httpsUrl(
        track.album?.images?.find((image) => image.width >= 300)?.url ||
          track.album?.images?.[0]?.url,
        ["scdn.co", "spotifycdn.com"],
      ),
      url: `https://open.spotify.com/track/${track.id}`,
      // Deprecated and often null. Never scrape an embed for a replacement.
      previewUrl: httpsUrl(track.preview_url, ["scdn.co", "spotifycdn.com"]),
    }));
}

export async function spotifyToken(parameters, fetcher = fetch) {
  const response = await fetcher("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(parameters),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error("Spotify authorization needs to be renewed.");
  const token = await response.json();
  if (!token.access_token)
    throw new Error("Spotify did not return an access token.");
  return token;
}

export async function getOnRepeat(env = process.env, fetcher = fetch) {
  if (!env.SPOTIFY_REFRESH_TOKEN)
    return { status: "not_connected", tracks: [] };
  const token = await spotifyToken(
    {
      client_id: env.SPOTIFY_CLIENT_ID || SPOTIFY_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    },
    fetcher,
  );
  const response = await fetcher(
    "https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5",
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new Error("Spotify listening data is temporarily unavailable.");
  const data = await response.json();
  return {
    status: "connected",
    timeRange: "short_term",
    fetchedAt: new Date().toISOString(),
    tracks: publicTracks(data.items || []),
  };
}

export async function spotifyResponse(env, fetcher) {
  try {
    const data = await getOnRepeat(env, fetcher);
    return Response.json(data, {
      headers: {
        "Cache-Control":
          data.status === "connected"
            ? "public, max-age=60, s-maxage=900, stale-while-revalidate=3600"
            : "no-store",
      },
    });
  } catch {
    // Do not forward upstream responses, tokens or account details to visitors.
    return Response.json(
      { status: "unavailable", tracks: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
