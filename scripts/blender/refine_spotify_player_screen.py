"""Replace the original flat display with a recessed black Spotify screen."""
import bpy
import math
import os
import re
import xml.etree.ElementTree as ET

ROOT = 'C:/Users/curtl/Desktop/port-2025/port-2025'
collection = bpy.data.collections.get('Spotify_Player_Asset')
if not collection or not bpy.data.objects.get('spotify-player-body-pivot'):
    raise RuntimeError('Open the SpotifyPlayer Blender asset before running this script')
body = bpy.data.objects['spotify-player-body-pivot']

def material(name, hex_color, roughness=0.6):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    channels = [int(hex_color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    channels = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in channels]
    mat.diffuse_color = (*channels, 1)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*channels, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat

black = material('Player_Black_LCD', '010203', 0.42)
rim = material('Player_Display_Rim', '293638', 0.28)
green = material('Player_Spotify_Green', '1ed760', 0.45)
green_shader = green.node_tree.nodes.get('Principled BSDF')
green_shader.inputs['Emission Color'].default_value = (*green.diffuse_color[:3], 1)
green_shader.inputs['Emission Strength'].default_value = 0.25
glass = material('Player_Screen_Glass', 'ffffff', 0.12)
glass_shader = glass.node_tree.nodes.get('Principled BSDF')
glass_shader.inputs['Transmission Weight'].default_value = 1.0
glass_shader.inputs['IOR'].default_value = 1.46

# Remove only the former display parts and any earlier run of this refinement.
for obj in list(collection.objects):
    if (obj.name.startswith(('spotify-player-note', 'spotify-player-on-repeat', 'spotify-player-spotify-label', 'spotify-player-display-', 'spotify-player-logo'))
            or obj.name in {'spotify-player-screen', 'spotify-player-screen-bezel'}):
        bpy.data.objects.remove(obj, do_unlink=True)

def rounded_rectangle(width, height, radius, steps=8):
    points = []
    for cx, cy, start in [(width/2-radius, height/2-radius, 0), (-width/2+radius, height/2-radius, 90), (-width/2+radius, -height/2+radius, 180), (width/2-radius, -height/2+radius, 270)]:
        for i in range(steps):
            a = math.radians(start + i * 90 / (steps-1))
            points.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
    return points

def mesh_object(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = body
    obj.data.materials.append(mat)
    return obj

# Four continuous rings give the rim an actual opening and sloping inner wall.
outer = rounded_rectangle(0.224, 0.177, 0.011)
inner = rounded_rectangle(0.202, 0.155, 0.006)
well = rounded_rectangle(0.194, 0.147, 0.005)
n = len(outer)
vertices = []
for contour, depth in [(outer, -0.025), (outer, -0.036), (inner, -0.036), (well, -0.027)]:
    vertices.extend((x, depth, z + 0.318) for x, z in contour)
faces = []
for ring_a, ring_b in [(0, 1), (1, 2), (2, 3)]:
    for i in range(n):
        j = (i+1) % n
        faces.append((ring_a*n+i, ring_a*n+j, ring_b*n+j, ring_b*n+i))
bezel = mesh_object('spotify-player-display-recessed-rim', vertices, faces, rim)

def panel(name, width, height, depth, mat, thickness=0.001):
    contour = rounded_rectangle(width, height, 0.005)
    vertices = [(x, depth, z + 0.318) for x, z in contour]
    obj = mesh_object(name, vertices, [tuple(range(len(vertices)))], mat)
    # Front normal points toward -Y, matching the rest of the player.
    if obj.data.polygons[0].normal.y > 0:
        obj.data.polygons[0].flip()
    if thickness:
        solid = obj.modifiers.new('Display thickness', 'SOLIDIFY')
        solid.thickness = thickness
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=solid.name)
    return obj

panel('spotify-player-display-black-lcd', 0.195, 0.148, -0.0273, black)
panel('spotify-player-display-glass', 0.201, 0.154, -0.032, glass, 0.0012)

# Import the actual Simple Icons Spotify outline as filled Bezier splines.
# Its SVG consists only of M/C/S/Z commands, including the three wave cutouts.
svg = ET.parse(os.path.join(ROOT, '3D-Related', 'SpotifyPlayer', 'spotify-logo.svg')).getroot()
path = svg.find('{http://www.w3.org/2000/svg}path').attrib['d']
tokens = re.findall(r'[MmCcSsZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?', path)
contours = []
command = None
current = (0.0, 0.0)
previous_control = None
points = None
i = 0
while i < len(tokens):
    if tokens[i].isalpha():
        command = tokens[i]
        i += 1
    if command in 'Zz':
        if points:
            contours.append(points)
            current = points[0]['co']
        points = None
        previous_control = None
        command = None
        continue
    count = {'M': 2, 'C': 6, 'S': 4}[command.upper()]
    values = [float(v) for v in tokens[i:i+count]]
    i += count
    relative = command.islower()
    def point(x, y):
        return (x + current[0], y + current[1]) if relative else (x, y)
    if command.upper() == 'M':
        current = point(*values)
        points = [{'co': current, 'left': current, 'right': current}]
        previous_control = None
        continue
    if command.upper() == 'C':
        c1, c2, end = point(*values[:2]), point(*values[2:4]), point(*values[4:6])
    else:
        c1 = (2*current[0]-previous_control[0], 2*current[1]-previous_control[1]) if previous_control else current
        c2, end = point(*values[:2]), point(*values[2:4])
    points[-1]['right'] = c1
    points.append({'co': end, 'left': c2, 'right': end})
    current, previous_control = end, c2

curve = bpy.data.curves.new('Spotify official silhouette', 'CURVE')
curve.dimensions = '2D'
curve.fill_mode = 'BOTH'
curve.resolution_u = 10
curve.extrude = 0.00005
scale = 0.106 / 24
for contour in contours:
    # Cubics return to the starting point; merge the duplicate endpoint.
    if (abs(contour[-1]['co'][0]-contour[0]['co'][0]) < 0.00001
            and abs(contour[-1]['co'][1]-contour[0]['co'][1]) < 0.00001):
        contour[0]['left'] = contour.pop()['left']
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(contour)-1)
    spline.use_cyclic_u = True
    for target, source in zip(spline.bezier_points, contour):
        def transform(p):
            return ((p[0]-12)*scale, (12-p[1])*scale, 0)
        target.co = transform(source['co'])
        target.handle_left_type = target.handle_right_type = 'FREE'
        target.handle_left = transform(source['left'])
        target.handle_right = transform(source['right'])
logo = bpy.data.objects.new('spotify-player-logo', curve)
collection.objects.link(logo)
logo.parent = body
logo.location = (0, -0.028, 0.318)
logo.rotation_euler.x = math.pi/2
logo.data.materials.append(green)
bpy.ops.object.select_all(action='DESELECT')
logo.select_set(True)
bpy.context.view_layer.objects.active = logo
bpy.ops.object.convert(target='MESH')

# Face the docked asset right into the room, at its bedside display size.
pivot = bpy.data.objects.get('spotify-player-outward-pivot')
if pivot is None:
    pivot = bpy.data.objects.new('spotify-player-outward-pivot', None)
    collection.objects.link(pivot)
    for obj in list(collection.objects):
        if obj != pivot and obj.parent is None:
            obj.parent = pivot
pivot.rotation_euler.z = math.pi / 2
pivot.scale = (0.8, 0.8, 0.8)
pivot['portfolio_yaw_degrees'] = 90
pivot['portfolio_scale'] = 0.8

bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = logo
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, 'public', 'models', 'spotify-player.glb'), export_format='GLB', use_selection=True, export_animations=False, export_extras=True, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, '3D-Related', 'SpotifyPlayer', 'SpotifyPlayer.blend'))
print('PLAYER_SCREEN_REFINED', {'logo_contours': len(contours), 'yaw_degrees': 90, 'scale': 0.8, 'screen': 'black LCD, green Spotify logo, recessed rim and glass'})
