import { defineConfig, loadEnv } from "vite";
import { spotifyResponse } from "./server/spotify.mjs";

export default defineConfig({
  plugins: [
    {
      name: "local-spotify-api",
      configureServer(server) {
        server.middlewares.use("/api/spotify", async (request, response) => {
          if (request.method !== "GET") {
            response.writeHead(405, { Allow: "GET" }).end();
            return;
          }
          // Read on every request so finishing the local OAuth flow needs no restart.
          const env = {
            ...loadEnv(server.config.mode, server.config.envDir, "SPOTIFY_"),
            ...process.env,
          };
          const result = await spotifyResponse(env);
          response.writeHead(result.status, Object.fromEntries(result.headers));
          response.end(await result.text());
        });
      },
    },
  ],
});
