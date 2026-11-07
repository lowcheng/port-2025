import http from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_REDIRECT_URI,
  spotifyToken,
} from "../server/spotify.mjs";

const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
const pending = new Map();
const html = (heading, detail) =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connect Spotify</title><style>body{font:18px/1.6 system-ui;max-width:580px;margin:15vh auto;padding:24px;background:#eef4f8;color:#183042}a{color:inherit}h1{line-height:1.2}</style><h1>${heading}</h1><p>${detail}</p><a href="http://localhost:5174/">Back to your portfolio</a></html>`;
const server = http.createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  if (request.headers.host !== "127.0.0.1:8889" || request.method !== "GET") {
    response.writeHead(400).end("Invalid request.");
    return;
  }
  const url = new URL(request.url, "http://127.0.0.1:8889");
  if (url.pathname === "/connect") {
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(64).toString("base64url");
    for (const [key, value] of pending)
      if (Date.now() - value.created > 600000) pending.delete(key);
    pending.set(state, { verifier, created: Date.now() });
    const authorize = new URL("https://accounts.spotify.com/authorize");
    authorize.search = new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID || SPOTIFY_CLIENT_ID,
      response_type: "code",
      redirect_uri: SPOTIFY_REDIRECT_URI,
      scope: "user-top-read",
      state,
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    });
    response.writeHead(302, { Location: authorize.href }).end();
    return;
  }
  if (url.pathname !== "/callback") {
    response.end(
      html(
        "Connect your listening",
        '<a href="/connect">Continue with Spotify</a>. This reads your top songs for the On repeat panel.',
      ),
    );
    return;
  }
  const state = url.searchParams.get("state") || "";
  const session = pending.get(state);
  pending.delete(state);
  if (!session || Date.now() - session.created > 600000) {
    response
      .writeHead(400)
      .end(
        html(
          "Connection expired",
          '<a href="/connect">Try connecting again</a>.',
        ),
      );
    return;
  }
  if (url.searchParams.has("error") || !url.searchParams.get("code")) {
    response
      .writeHead(400)
      .end(
        html(
          "Connection cancelled",
          'No account was connected. <a href="/connect">Try again</a> when you are ready.',
        ),
      );
    return;
  }
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID || SPOTIFY_CLIENT_ID;
    const token = await spotifyToken({
      client_id: clientId,
      grant_type: "authorization_code",
      code: url.searchParams.get("code"),
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_verifier: session.verifier,
    });
    if (!token.refresh_token) throw new Error("Missing refresh token");
    let contents = await readFile(envPath, "utf8").catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    for (const [key, value] of Object.entries({
      SPOTIFY_CLIENT_ID: clientId,
      SPOTIFY_REFRESH_TOKEN: token.refresh_token,
    })) {
      const line = `${key}=${JSON.stringify(value)}`;
      const pattern = new RegExp(`^${key}=.*$`, "m");
      contents = pattern.test(contents)
        ? contents.replace(pattern, () => line)
        : `${contents.trimEnd()}\n${line}\n`;
    }
    await writeFile(envPath, contents, { mode: 0o600 });
    response.end(
      html(
        "Spotify is connected",
        "Your top five songs can now appear in On repeat. Return to the portfolio and reopen the panel.",
      ),
    );
    console.log(
      "Spotify connected. Credentials saved privately in .env.local; no tokens printed.",
    );
    server.close();
  } catch {
    response
      .writeHead(502)
      .end(
        html(
          "Could not connect",
          'Check the registered redirect URI, then <a href="/connect">try again</a>.',
        ),
      );
  }
});
server.listen(8889, "127.0.0.1", () =>
  console.log(
    `Connect Spotify: http://127.0.0.1:8889/connect\nRegister this exact redirect in Spotify: ${SPOTIFY_REDIRECT_URI}`,
  ),
);
server.on("error", (error) => {
  console.error(`Spotify helper: ${error.code || "could not start"}`);
  process.exitCode = 1;
});
