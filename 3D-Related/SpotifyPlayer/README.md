# Bedside music player

- Editable source: `SpotifyPlayer.blend` (also open in Blender).
- Web export: `public/models/spotify-player.glb` from the repository root.
- Reproduction: run `scripts/blender/create_spotify_player.py` in an empty scene,
  followed by `scripts/blender/refine_spotify_player_screen.py` for the current display and rotation.
- Preview render: `_spotify_player_blender.png` in the repository root.

The asset is modeled in Blender Z-up, facing -Y, with the dock's contact plane
at Z=0. The selected `Spotify_Player_Asset` collection exports to glTF Y-up
facing +Z before a 90° pivot turns the display right into the room (+X).
The asset pivot applies a uniform
0.8 scale (20% smaller) while keeping the dock grounded at the origin.
Preview ground, cameras and lights are excluded from the GLB.

The portfolio places the asset beside the existing bedside lamp through
`src/scripts/special-interactions/musicPlayer.js`, using shading compatible
with the room's baked day/night materials. Its black LCD has a green Spotify
logo under a recessed glass lens with view-dependent skybox reflections.
Logo silhouette: Simple Icons (`spotify-logo.svg`), sourced from the
`simple-icons` package via jsDelivr. It contains no fabricated track data. Account
authorization and the track-list interaction are not connected yet.
