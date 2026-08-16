import bpy
import math
from mathutils import Matrix, Vector


GENERATED_COLLECTION = "Garden_Population_Generated"


def get_generated_collection():
    collection = bpy.data.collections.get(GENERATED_COLLECTION)
    if collection is None:
        collection = bpy.data.collections.new(GENERATED_COLLECTION)
        bpy.context.scene.collection.children.link(collection)
    else:
        for obj in list(collection.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    return collection


def remember_visibility(obj):
    if "garden_original_hide_viewport" not in obj:
        obj["garden_original_hide_viewport"] = bool(obj.hide_viewport)
        obj["garden_original_hide_render"] = bool(obj.hide_render)


def place_existing(name, location, rotation_z_degrees):
    obj = bpy.data.objects.get(name)
    if obj is None:
        print("GARDEN_MISSING", name)
        return
    obj.location = location
    obj.rotation_euler.z = math.radians(rotation_z_degrees)
    obj.hide_viewport = False
    obj.hide_render = False
    print("GARDEN_PATH_STONE", name, tuple(round(v, 3) for v in location))


def hide_existing(name):
    obj = bpy.data.objects.get(name)
    if obj is None:
        return
    remember_visibility(obj)
    obj.hide_viewport = True
    obj.hide_render = True
    print("GARDEN_PATH_HIDDEN", name)


def linked_copy(source, name, world_matrix, collection):
    duplicate = source.copy()
    duplicate.data = source.data
    duplicate.name = name
    duplicate.animation_data_clear()
    collection.objects.link(duplicate)
    duplicate.matrix_world = world_matrix
    duplicate.hide_viewport = False
    duplicate.hide_render = False
    return duplicate


def copy_tree(kind, label, target, scale, rotation_degrees, collection):
    if kind == "tall":
        part_names = ("Trunk_Tall", "Leaves_Tall")
    else:
        part_names = ("Trunk_Small", "Leaves_Small")

    trunk = bpy.data.objects.get(part_names[0])
    if trunk is None:
        print("GARDEN_TREE_MISSING", kind)
        return

    anchor = Vector((trunk.matrix_world.translation.x, trunk.matrix_world.translation.y, 0.0))
    transform = (
        Matrix.Translation(Vector(target))
        @ Matrix.Rotation(math.radians(rotation_degrees), 4, "Z")
        @ Matrix.Scale(scale, 4)
        @ Matrix.Translation(-anchor)
    )

    for part_name in part_names:
        source = bpy.data.objects.get(part_name)
        if source is None:
            continue
        linked_copy(source, f"GardenTree_{label}_{part_name}", transform @ source.matrix_world, collection)

    print("GARDEN_TREE", label, target, scale, rotation_degrees)


def copy_shrub(source_name, label, location, scale, rotation_degrees, collection):
    source = bpy.data.objects.get(source_name)
    if source is None:
        print("GARDEN_SHRUB_MISSING", source_name)
        return

    source_anchor = source.matrix_world.translation.copy()
    target = Vector(location)
    if isinstance(scale, (tuple, list)):
        scale_matrix = Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
    else:
        scale_matrix = Matrix.Scale(scale, 4)

    transform = (
        Matrix.Translation(target)
        @ Matrix.Rotation(math.radians(rotation_degrees), 4, "Z")
        @ scale_matrix
        @ Matrix.Translation(-source_anchor)
    )
    linked_copy(source, f"GardenShrub_{label}", transform @ source.matrix_world, collection)
    print("GARDEN_SHRUB", label, location, scale)


collection = get_generated_collection()

# Keep the approach entirely inside the grass square. Five unevenly turned
# stones suggest a path without creating a rigid dotted line to the boundary.
path_layout = {
    "path_C.003": ((3.34, -8.48, 0.0643), -6.0),
    "path_C": ((3.02, -9.43, 0.0614), 12.0),
    "path_C.004": ((3.46, -10.43, 0.0628), -11.0),
    "path_C.006": ((2.94, -11.39, 0.0581), 16.0),
    "path_C.002": ((3.24, -12.36, 0.0628), -14.0),
}
for stone_name, (location, angle) in path_layout.items():
    place_existing(stone_name, location, angle)
for stone_name in ("path_C.001", "path_C.005", "path_C.007"):
    hide_existing(stone_name)

# Four perimeter trees create depth without blocking the room. Smaller scale
# toward the back makes the grove feel deeper and keeps the room as the focus.
tree_layout = (
    ("tall", "BackLeft", (-9.65, 8.15, 0.0), 0.72, 18.0),
    ("small", "LeftEdge", (-11.15, 1.05, 0.0), 0.66, -27.0),
    ("small", "RightFront", (10.75, -4.90, 0.0), 0.70, 31.0),
    ("tall", "BackRight", (11.05, 10.05, 0.0), 0.60, -21.0),
)
for tree in tree_layout:
    copy_tree(*tree, collection)

# Base shrubs tie the new trunks into the grass and conceal the geometric root
# transitions. Flowered pieces are used sparingly as small color accents.
shrub_layout = (
    ("Bush", "BackLeftBase", (-8.65, 7.25, 0.0), 0.66, 22.0),
    ("Bush_Flowers", "BackLeftFlowers", (-10.55, 7.10, 0.0), 0.58, -31.0),
    ("Bush", "LeftEdgeBase", (-10.15, 0.35, 0.0), 0.60, 47.0),
    ("Bush_Flowers", "LeftEdgeFlowers", (-11.85, -0.15, 0.0), 0.48, 9.0),
    ("Bush", "RightFrontBase", (9.70, -4.35, 0.0), 0.62, -19.0),
    ("Bush_Flowers", "RightFrontFlowers", (11.55, -3.85, 0.0), 0.50, 35.0),
    ("Bush", "BackRightBase", (10.05, 9.15, 0.0), 0.58, 13.0),
)
for shrub in shrub_layout:
    copy_shrub(*shrub, collection)

# Broken hedge runs frame the side edges. The gaps and varied rotation keep
# them organic and prevent them from reading as perfectly clipped walls.
hedge_layout = (
    ("LeftA", (-12.04, -3.50, 0.0), (0.54, 1.12, 0.56), 3.0),
    ("LeftB", (-11.88, -2.15, 0.0), (0.62, 1.18, 0.63), -2.0),
    ("LeftC", (-12.03, -0.80, 0.0), (0.52, 1.08, 0.54), 4.0),
    ("RightA", (12.00, -0.40, 0.0), (0.58, 1.14, 0.59), -3.0),
    ("RightB", (11.86, 0.95, 0.0), (0.63, 1.20, 0.64), 2.0),
    ("RightC", (12.01, 2.30, 0.0), (0.54, 1.10, 0.56), -4.0),
)
for label, location, scale, angle in hedge_layout:
    copy_shrub("Bush", f"Hedge_{label}", location, scale, angle, collection)

bpy.context.view_layer.update()
print("GARDEN_POPULATION_COMPLETE", {
    "generated_objects": len(collection.objects),
    "collection": collection.name,
})
