import bpy
from mathutils import Vector

print("GROUND_SCENE", bpy.data.filepath)

for obj in bpy.context.scene.objects:
    if obj.type != "MESH" or obj.hide_viewport or obj.hide_render:
        continue

    dims = obj.dimensions
    if max(dims.x, dims.y) >= 8.0 or (obj.location.z < 0.5 and max(dims.x, dims.y) >= 5.0):
        world_corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        bounds = {
            "x": (round(min(v.x for v in world_corners), 3), round(max(v.x for v in world_corners), 3)),
            "y": (round(min(v.y for v in world_corners), 3), round(max(v.y for v in world_corners), 3)),
            "z": (round(min(v.z for v in world_corners), 3), round(max(v.z for v in world_corners), 3)),
        }
        print("GROUND_CANDIDATE", {
            "name": obj.name,
            "location": tuple(round(v, 3) for v in obj.location),
            "dimensions": tuple(round(v, 3) for v in obj.dimensions),
            "bounds": bounds,
            "materials": [slot.material.name if slot.material else "" for slot in obj.material_slots],
            "collections": [collection.name for collection in obj.users_collection],
        })
