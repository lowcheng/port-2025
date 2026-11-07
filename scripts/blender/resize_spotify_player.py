import bpy
import math
import os

ROOT = 'C:/Users/curtl/Desktop/port-2025/port-2025'
collection = bpy.data.collections.get('Spotify_Player_Asset')
pivot = bpy.data.objects.get('spotify-player-outward-pivot')
if not collection or not pivot:
    raise RuntimeError('Open SpotifyPlayer.blend before adjusting its placement')

# Face right into the room, retaining the smaller bedside size.
pivot.rotation_euler.z = math.pi / 2
pivot.scale = (0.8, 0.8, 0.8)
pivot['portfolio_yaw_degrees'] = 90
pivot['portfolio_scale'] = 0.8
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = pivot
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, 'public', 'models', 'spotify-player.glb'), export_format='GLB', use_selection=True, export_animations=False, export_extras=True, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, '3D-Related', 'SpotifyPlayer', 'SpotifyPlayer.blend'))
print('PLAYER_POSE_UPDATED', {'scale': 0.8, 'yaw_degrees': 90})
