"""Build the reusable bedside player in the open Blender MCP scene."""
import bpy
import math
import os
from mathutils import Vector, Quaternion

ROOT = 'C:/Users/curtl/Desktop/port-2025/port-2025'
ASSET_DIR = os.path.join(ROOT, '3D-Related', 'SpotifyPlayer')
os.makedirs(ASSET_DIR, exist_ok=True)
COLLECTION = 'Spotify_Player_Asset'
if bpy.data.collections.get(COLLECTION):
    raise RuntimeError('Spotify_Player_Asset already exists; inspect it before rebuilding')
collection = bpy.data.collections.new(COLLECTION)
bpy.context.scene.collection.children.link(collection)

def move_to_collection(obj):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def material(name, hex_color, roughness=0.75, metallic=0.0, emission=0.0):
    values = [int(hex_color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*linear, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if emission:
        shader.inputs['Emission Color'].default_value = (*linear, 1)
        shader.inputs['Emission Strength'].default_value = emission
    return mat

blue = material('Player_Soft_Blue', '91aebe')
back_blue = material('Player_Back_Blue', '6d8798')
ivory = material('Player_Warm_Ivory', 'e5ddcb')
button_mat = material('Player_Button_Blue', 'afc3c7')
bezel_mat = material('Player_Screen_Bezel', '425653')
screen_mat = material('Player_Screen', '263c38', 0.45)
screen_ink = material('Player_Screen_Ink', 'b8d5b5', emission=0.12)
mark_mat = material('Player_Control_Ink', '6e8990')
rubber = material('Player_Rubber', '46545b')

def cube(name, location, dimensions, mat, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = move_to_collection(bpy.context.object)
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('Soft molded edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier='Weighted face normals')
    if parent:
        obj.parent = parent
    return obj

def cylinder(name, location, radius, depth, mat, parent=None, front=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth, location=location)
    obj = move_to_collection(bpy.context.object)
    obj.name = name
    if front:
        obj.rotation_euler.x = math.pi / 2
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Rounded rim', 'BEVEL')
    bevel.width = min(depth * 0.28, 0.003)
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if parent:
        obj.parent = parent
    return obj

def text(name, value, x, y, z, size, mat, parent):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = value
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = size
    curve.extrude = 0.00015
    curve.resolution_u = 4
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.location = (x, y, z)
    obj.rotation_euler.x = math.pi / 2
    obj.data.materials.append(mat)
    obj.parent = parent
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj

# Z=0 is the tabletop contact point. Front is Blender -Y / glTF +Z.
dock = cube('spotify-player-dock', (0, 0, 0.0275), (0.31, 0.23, 0.055), ivory, 0.018)
cube('spotify-player-dock-slot', (0, 0.005, 0.055), (0.225, 0.058, 0.012), rubber, 0.005)
for x in (-0.105, 0.105):
    for y in (-0.072, 0.072):
        cylinder('spotify-player-dock-foot', (x, y, 0.004), 0.016, 0.008, rubber, front=False)

body_root = bpy.data.objects.new('spotify-player-body-pivot', None)
collection.objects.link(body_root)
body_root.location = (0, 0, 0.063)
body_root.rotation_euler.x = math.radians(-9)
body_root['interaction'] = 'spotify-on-repeat'
body_root['display_status'] = 'not_connected'
cube('spotify-player-shell', (0, 0, 0.215), (0.265, 0.048, 0.43), blue, 0.018, body_root)
cube('spotify-player-back', (0, 0.021, 0.215), (0.247, 0.012, 0.412), back_blue, 0.015, body_root)
cube('spotify-player-screen-bezel', (0, -0.025, 0.318), (0.224, 0.009, 0.177), bezel_mat, 0.009, body_root)
cube('spotify-player-screen', (0, -0.0302, 0.318), (0.203, 0.002, 0.154), screen_mat, 0.004, body_root)

# A permanent label and music symbol, without invented listening data.
text('spotify-player-on-repeat', 'ON REPEAT', 0, -0.032, 0.369, 0.022, screen_ink, body_root)
text('spotify-player-spotify-label', 'SPOTIFY', 0, -0.032, 0.262, 0.014, screen_ink, body_root)
for x, z in [(-0.029, 0.301), (0.025, 0.313)]:
    cylinder('spotify-player-note', (x, -0.0324, z), 0.010, 0.0015, screen_ink, body_root)
    cube('spotify-player-note-stem', (x + 0.008, -0.0324, z + 0.024), (0.004, 0.0015, 0.047), screen_ink, 0, body_root)
beam = cube('spotify-player-note-beam', (0.005, -0.0324, 0.353), (0.059, 0.0015, 0.006), screen_ink, 0, body_root)
beam.rotation_euler.y = math.radians(-12)

cylinder('spotify-player-click-wheel', (0, -0.029, 0.112), 0.081, 0.009, ivory, body_root)
cylinder('spotify-player-center-button', (0, -0.035, 0.112), 0.031, 0.006, button_mat, body_root)
text('spotify-player-menu-mark', 'MENU', 0, -0.035, 0.164, 0.012, mark_mat, body_root)
text('spotify-player-back-mark', '<<', -0.054, -0.035, 0.112, 0.014, mark_mat, body_root)
text('spotify-player-next-mark', '>>', 0.054, -0.035, 0.112, 0.014, mark_mat, body_root)
text('spotify-player-play-mark', '>', 0, -0.035, 0.058, 0.017, mark_mat, body_root)
cube('spotify-player-hold-switch', (0.073, 0, 0.432), (0.047, 0.015, 0.007), ivory, 0.003, body_root)
cylinder('spotify-player-headphone-jack', (-0.078, 0, 0.432), 0.010, 0.004, rubber, body_root, front=False)

# Stage the standalone asset for Blender review; exclude stage from the GLB.
stage = bpy.data.collections.new('Spotify_Player_Preview_Stage')
bpy.context.scene.collection.children.link(stage)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.003))
ground = bpy.context.object
ground.name = 'preview-ground'
for old in list(ground.users_collection):
    old.objects.unlink(ground)
stage.objects.link(ground)
ground.data.materials.append(material('Player_Preview_Backdrop', 'd6c8b6'))

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

bpy.ops.object.camera_add(location=(0.73, -1.15, 0.76))
camera = bpy.context.object
camera.name = 'Player_Preview_Camera'
aim(camera, (0, 0, 0.24))
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 0.76
bpy.context.scene.camera = camera
for name, location, power, size in [('Player_Key', (-1.0, -1.2, 1.8), 85, 1.2), ('Player_Fill', (1.0, -0.2, 0.8), 30, 1.0)]:
    bpy.ops.object.light_add(type='AREA', location=location)
    lamp = bpy.context.object
    lamp.name = name
    lamp.data.energy = power
    lamp.data.shape = 'DISK'
    lamp.data.size = size
    aim(lamp, (0, 0, 0.2))

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 700
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.world.color = (0.18, 0.18, 0.18)
scene.view_settings.view_transform = 'AgX'
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = os.path.join(ROOT, '_spotify_player_blender.png')

bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = dock
bpy.context.view_layer.update()
export_path = os.path.join(ROOT, 'public', 'models', 'spotify-player.glb')
bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=True, export_animations=False, export_extras=True, export_yup=True)
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_perspective = 'CAMERA'
        area.spaces.active.shading.type = 'MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ASSET_DIR, 'SpotifyPlayer.blend'))
print('SPOTIFY_PLAYER_CREATED', {'blend': bpy.data.filepath, 'glb': export_path, 'asset_objects': len(collection.objects), 'mesh_faces': sum(len(obj.data.polygons) for obj in collection.objects if obj.type == 'MESH')})
