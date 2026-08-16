import bpy
import math


def remember_transform(obj):
    if "landscape_original_location" not in obj:
        obj["landscape_original_location"] = list(obj.location)
        obj["landscape_original_rotation"] = list(obj.rotation_euler)
        obj["landscape_original_scale"] = list(obj.scale)


def set_transform(name, location, rotation_z=None, scale=None):
    obj = bpy.data.objects.get(name)
    if obj is None:
        print("LANDSCAPE_MISSING", name)
        return

    remember_transform(obj)
    obj.location = location
    if rotation_z is not None:
        obj.rotation_euler.z = math.radians(rotation_z)
    if scale is not None:
        obj.scale = scale

    print("LANDSCAPE_PLACED", {
        "name": name,
        "location": tuple(round(value, 3) for value in obj.location),
        "rotation_z_degrees": round(math.degrees(obj.rotation_euler.z), 1),
        "scale": tuple(round(value, 3) for value in obj.scale),
    })


# Left tree: one broad green mass at the trunk, with the flower bush stepping
# toward the room. Their centers overlap slightly so they read as one planting.
set_transform(
    "Bush",
    (-6.58, -6.62, 0.0),
    rotation_z=47.0,
    scale=(2.48, 2.48, 2.48),
)
set_transform(
    "Bush_Flowers",
    (-4.92, -6.83, 0.0),
    rotation_z=79.0,
    scale=(1.72, 1.72, 1.72),
)

# Right tree: tuck the large bush beneath the canopy and offset a smaller
# flower bush toward the room. This avoids mirroring the left-hand cluster.
set_transform(
    "Bush.001",
    (7.10, 5.63, 0.0),
    rotation_z=-31.0,
    scale=(2.30, 2.30, 2.30),
)
set_transform(
    "Bush_Flowers.001",
    (6.35, 5.05, 0.0),
    rotation_z=-17.0,
    scale=(1.45, 1.45, 1.45),
)

# A compressed, gently curving approach. Sizes stay varied, and the two tiny
# stones finish the path without forming a rigid dotted line.
stone_layout = {
    "path_C.003": ((3.30, -8.48, 0.0643), -4.0),
    "path_C":     ((3.57, -9.62, 0.0614),  8.0),
    "path_C.004": ((3.30, -10.79, 0.0628), -7.0),
    "path_C.006": ((2.90, -11.95, 0.0581), 12.0),
    "path_C.002": ((2.58, -13.10, 0.0628), -10.0),
    "path_C.001": ((2.76, -14.28, 0.0643),  7.0),
    "path_C.005": ((3.34, -14.86, 0.0400), -15.0),
    "path_C.007": ((2.18, -14.78, 0.0400), 18.0),
}

for stone_name, (stone_location, stone_rotation) in stone_layout.items():
    set_transform(stone_name, stone_location, rotation_z=stone_rotation)

bpy.context.view_layer.update()
print("LANDSCAPE_ARRANGEMENT_COMPLETE")
