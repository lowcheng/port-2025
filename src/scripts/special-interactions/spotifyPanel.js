import appState from "../core/AppState.js";
import audioManager from "../core/audio.js";

export function initializeSpotifyPanel() {
  const dialog = document.createElement("dialog");
  dialog.className = "spotify-panel";
  dialog.setAttribute("aria-labelledby", "spotify-title");
  dialog.innerHTML = `
    <button class="spotify-close" type="button" aria-label="Close On repeat">&#215;</button>
    <p class="spotify-eyebrow"><span aria-hidden="true">&#9835;</span> A little soundtrack</p>
    <h2 id="spotify-title">On repeat</h2>
    <p class="spotify-intro">My top five songs over the last four weeks.</p>
    <div class="spotify-status" role="status" aria-live="polite"></div>
    <ol class="spotify-tracks"></ol>
    <div class="spotify-embed" hidden></div>
    <footer><span>From Spotify</span><span class="spotify-updated"></span></footer>`;
  document.body.append(dialog);
  const list = dialog.querySelector(".spotify-tracks");
  const status = dialog.querySelector(".spotify-status");
  const embed = dialog.querySelector(".spotify-embed");
  const audio = new Audio();
  audio.preload = "none";
  audio.volume = 0.65;
  let selected = null;
  let previousFocus;
  let previousControls;
  let previousRaycast;
  let musicWasPlaying = false;
  let requestVersion = 0;
  let refreshTimer;

  function pauseRoomMusic() {
    if (audioManager.bgm.playing()) {
      musicWasPlaying = true;
      audioManager.bgm.pause();
    }
  }
  function restoreRoomMusic() {
    if (musicWasPlaying) audioManager.bgm.play();
    musicWasPlaying = false;
  }
  function stopPlayback() {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    embed.replaceChildren(); // Removing the iframe also stops its audio.
    embed.hidden = true;
    if (selected) {
      selected.button.textContent = selected.track.previewUrl ? "▶" : "↗";
      selected.button.setAttribute(
        "aria-label",
        `${selected.track.previewUrl ? "Play preview of" : "Open Spotify player for"} ${selected.track.name}`,
      );
      selected.button.setAttribute("aria-pressed", "false");
      selected.row.classList.remove("is-playing");
      status.textContent = "Choose a song to preview or open in Spotify.";
    }
    selected = null;
    restoreRoomMusic();
  }
  function openEmbed(track) {
    audio.pause();
    if (!embed.hidden) return;
    embed.hidden = false;
    const note = document.createElement("p");
    note.textContent =
      "No direct preview for this song. Press Play in Spotify below; playback availability depends on Spotify.";
    const iframe = document.createElement("iframe");
    iframe.title = `Spotify player: ${track.name}`;
    iframe.src = `https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=0`;
    iframe.width = "100%";
    iframe.height = "152";
    iframe.allow =
      "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    iframe.setAttribute("allowfullscreen", "");
    embed.replaceChildren(note, iframe);
    embed.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  async function play(entry) {
    if (selected === entry) {
      stopPlayback();
      return;
    }
    stopPlayback();
    selected = entry;
    pauseRoomMusic();
    entry.button.textContent = "■";
    entry.button.setAttribute("aria-label", `Stop ${entry.track.name}`);
    entry.button.setAttribute("aria-pressed", "true");
    entry.row.classList.add("is-playing");
    status.textContent = "";
    if (!entry.track.previewUrl) {
      openEmbed(entry.track);
      return;
    }
    audio.src = entry.track.previewUrl;
    try {
      await audio.play();
      if (selected !== entry) return;
      status.textContent = `Previewing ${entry.track.name} · up to 30 seconds`;
    } catch {
      if (selected !== entry) return;
      audio.pause();
      status.textContent = "This preview could not play.";
      openEmbed(entry.track);
    }
  }
  audio.addEventListener("ended", stopPlayback);
  audio.addEventListener("timeupdate", () => {
    if (audio.currentTime >= 30) stopPlayback();
  });
  audio.addEventListener("error", () => {
    if (selected && audio.getAttribute("src")) {
      status.textContent = "This preview could not play.";
      openEmbed(selected.track);
    }
  });

  function renderTracks(tracks) {
    list.replaceChildren();
    tracks.forEach((track, index) => {
      const row = document.createElement("li");
      row.className = "spotify-track";
      const number = document.createElement("span");
      number.className = "spotify-rank";
      number.textContent = String(index + 1).padStart(2, "0");
      const artwork = document.createElement("img");
      if (track.artwork) artwork.src = track.artwork;
      artwork.alt = `${track.album} album cover`;
      artwork.width = artwork.height = 64;
      const link = document.createElement("a");
      link.href = track.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "spotify-track-info";
      const title = document.createElement("strong");
      title.textContent = track.name;
      const artist = document.createElement("span");
      artist.textContent = track.artists;
      link.append(title, artist);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "spotify-play";
      button.textContent = track.previewUrl ? "▶" : "↗";
      button.setAttribute(
        "aria-label",
        `${track.previewUrl ? "Play preview of" : "Open Spotify player for"} ${track.name}`,
      );
      button.setAttribute("aria-pressed", "false");
      button.title = track.previewUrl
        ? "Play 30-second preview"
        : "Listen with Spotify";
      const entry = { track, row, button };
      button.addEventListener("click", () => play(entry));
      row.append(number, artwork, link, button);
      list.append(row);
    });
  }
  async function loadTracks() {
    const version = ++requestVersion;
    status.replaceChildren(
      document.createTextNode("Finding my current favourites…"),
    );
    list.setAttribute("aria-busy", "true");
    try {
      const response = await fetch("/api/spotify", {
        signal: AbortSignal.timeout(25000),
      });
      const data = await response.json();
      if (version !== requestVersion || !dialog.open) return;
      if (!response.ok) throw new Error("unavailable");
      if (data.status === "not_connected") {
        status.textContent =
          "My Spotify favourites are getting connected. Check back soon.";
        if (import.meta.env.DEV) {
          const connect = document.createElement("a");
          connect.href = "http://127.0.0.1:8889/connect";
          connect.target = "_blank";
          connect.rel = "noopener noreferrer";
          connect.textContent = "Connect my Spotify";
          connect.className = "spotify-connect";
          status.append(connect);
          refreshTimer = setTimeout(loadTracks, 15000);
        }
        return;
      }
      renderTracks(data.tracks);
      status.textContent = data.tracks.length
        ? "Choose a song to preview or open in Spotify."
        : "Still building this month's soundtrack. Check back soon.";
      dialog.querySelector(".spotify-updated").textContent = "Last four weeks";
    } catch {
      if (version !== requestVersion || !dialog.open) return;
      status.textContent = "Spotify is taking a break. Try again in a moment.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "spotify-retry";
      retry.textContent = "Try again";
      retry.addEventListener("click", loadTracks);
      status.append(retry);
    } finally {
      if (version === requestVersion) list.removeAttribute("aria-busy");
    }
  }
  dialog
    .querySelector(".spotify-close")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    event.stopPropagation();
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    ++requestVersion;
    clearTimeout(refreshTimer);
    stopPlayback();
    appState.cameraManager.controls.enabled = previousControls;
    if (previousRaycast) appState.enableRaycast();
    previousFocus?.focus();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPlayback();
  });
  return () => {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    if (previousFocus?.closest(".side-panel"))
      previousFocus = document.querySelector(".hamburger-btn");
    previousControls = appState.cameraManager.controls.enabled;
    previousRaycast = appState.isRaycastEnabled;
    appState.cameraManager.controls.enabled = false;
    appState.raycasterController.clearHover();
    appState.disableRaycast();
    stopPlayback();
    list.replaceChildren();
    dialog.showModal();
    loadTracks();
  };
}
