# Spotify / On repeat

Click the bedside iPod or choose **On repeat** in the menu. This shows the owner's top five tracks from Spotify's `short_term` (approximately four weeks), rather than the personal Spotify-generated On Repeat playlist. Visitors do not sign in.

## Connect once locally

1. Open the app with Client ID `2471bb39d5bd440bb3e82a0e22518cda` in the [Spotify developer dashboard](https://developer.spotify.com/dashboard).
2. Register **exactly** `http://127.0.0.1:8889/callback` as a redirect URI. Enable Web API. Spotify currently requires the development app owner to have Premium and permission to use the app.
3. Run `npm run connect:spotify`, visit `http://127.0.0.1:8889/connect`, and approve `user-top-read` with the account whose favourites should appear.
4. The local PKCE helper saves the refresh token in ignored `.env.local`. No client secret is needed. Never share or commit that file. Reopen the panel; Vite reads the credentials without a restart.

The OAuth helper listens only on loopback. The public `/api/spotify` endpoint returns sanitized display metadata without credentials. Successful responses can be cached by the CDN for 15 minutes; failures are not cached.

## Playback

Hover reveals the listening button. Keyboard focus and touch reveal it too. Clicking plays a Spotify-provided preview only if `preview_url` exists. This field is deprecated and nullable; available clips last up to 30 seconds. Missing or failed previews open a visible official Spotify embed instead. The visitor presses Play there; Spotify determines preview/full playback availability for the listener and browser. We do not scrape missing preview URLs or stream through the portfolio owner's account.

Only one preview/player is active. Closing the dialog, switching tracks or hiding the tab stops it. The room soundtrack pauses while listening and resumes afterward if it was playing.

## Hosting

`api/spotify.js` is a Node Vercel Function. Configure `SPOTIFY_CLIENT_ID` and server-only `SPOTIFY_REFRESH_TOKEN` in the hosting project's environment using the values in `.env.local`, then redeploy. Never prefix credentials with `VITE_`. The OAuth helper is local setup only and is not deployed. A purely static host needs an equivalent endpoint at `/api/spotify`.

If Spotify revokes the grant or the app/account changes, run the helper again and update the deployed refresh token. The local setup script does not deploy the site.

References: [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [top items](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks), [embeds](https://developer.spotify.com/documentation/embeds).
