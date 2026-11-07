// Human-facing labels, independent of Blender's material and export suffixes.
const PHOTO_LABELS = {
  "ac-card": "My Animal Crossing island",
  "baby-casper": "Casper as a puppy",
  "baby-cyrus": "My bunny Cyrus",
  "casp-cyrus": "Casper and Cyrus",
  "casper-lobster": "Casper and his posture pal",
  "casper-pawty": "Casper’s birthday",
  "casper-sideeye": "Casper’s side eye",
  "casper-sleep": "Sleepy Casper",
  "caspuh-frame": "Casper",
  "cyrus-frame": "Cyrus",
  "ded-casper": "Casper being Casper",
  "goofy-casper": "Goofy Casper",
  "me-": "A little photo of me",
  "fox-": "Fox artwork",
  "totoro-frame": "Totoro artwork",
  "totoro-wall": "Totoro artwork",
};

export function getInteractionLabel(object, { darkMode = false } = {}) {
  for (let current = object; current; current = current.parent) {
    const name = (current.name || "").toLowerCase();
    const data = current.userData || {};
    if (typeof data.tooltip === "string") return data.tooltip;
    if (data.spotifyPlayer || data.hoverGroup === "spotifyPlayer")
      return "On repeat";
    if (data.gameShelf || data.hoverGroup === "gameShelf")
      return "Recently played";
    if (data.audioSlider === "bgm") return "Music volume · drag to adjust";
    if (data.audioSlider === "sfx") return "Sound effects · drag to adjust";
    if (data.hoverGroup === "mugSet") return "Open the mug";
    if (data.hoverGroup === "mailboxSet" || name.startsWith("mailbox"))
      return "Get in touch";
    if (name.includes("lightswitch") || name === "lamp-five-raycast")
      return darkMode ? "Turn the lights on" : "Turn the lights off";
    if (name.includes("about-raycast")) return "About me";
    if (name.includes("work-raycast") || name.includes("tv-raycast"))
      return "My work";
    if (name.includes("erhu")) return "My erhu · hover to listen";
    if (name.includes("github")) return "Visit my GitHub";
    if (name.includes("linkedin")) return "Visit my LinkedIn";
    if (name.includes("whiteboard")) return "Draw on the whiteboard";
    if (
      name.includes("monitor") ||
      name === "iframeinteractionplane" ||
      data.hoverGroup === "monitorSet"
    )
      return "Explore my desktop";
    if (name.includes("perry-hat")) return "Perry’s hat";
    for (const [prefix, label] of Object.entries(PHOTO_LABELS)) {
      if (name.startsWith(prefix)) return label;
    }
  }
  // New raycast targets get a readable label until an explicit tooltip is set.
  return (object?.name || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/raycast|animateScale|animateSpin|scaleLights/gi, "")
    .replace(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi,
      "",
    )
    .replace(/[-_\d.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}
