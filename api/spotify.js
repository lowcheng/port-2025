import { spotifyResponse } from "../server/spotify.mjs";

export default async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.statusCode = 405;
    response.end();
    return;
  }
  const result = await spotifyResponse(process.env);
  response.statusCode = result.status;
  result.headers.forEach((value, key) => response.setHeader(key, value));
  response.end(await result.text());
};
