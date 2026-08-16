import bpy
from mathutils import Matrix, Vector


MATRIX_BACKUP_KEY = "review_refine_original_matrix"


def flatten_matrix(matrix):
    return [float(matrix[row][column]) for row in range(4) for column in range(4)]


def matrix_from_flat(values):
    return Matrix((
        values[0:4],
        values[4:8],
        values[8:12],
        values[12:16],
    ))


def restore_or_remember_matrix(obj):
    if MATRIX_BACKUP_KEY in obj:
        obj.matrix_world = matrix_from_flat(list(obj[MATRIX_BACKUP_KEY]))
    else:
        obj[MATRIX_BACKUP_KEY] = flatten_matrix(obj.matrix_world)


# Reduce the dominant foreground-right shrub and tuck it closer to the small
# tree. This opens negative space beside the room while retaining a planted base.
foreground_bush = bpy.data.objects.get("GardenShrub_RightFrontBase")
if foreground_bush:
    restore_or_remember_matrix(foreground_bush)
    original_scale = foreground_bush.scale.copy()
    foreground_bush.location.x += 0.25
    foreground_bush.location.y -= 0.12
    foreground_bush.scale = original_scale * 0.78
    print("REFINED_FOREGROUND_BUSH", {
        "name": foreground_bush.name,
        "location": tuple(round(v, 3) for v in foreground_bush.location),
        "scale": tuple(round(v, 3) for v in foreground_bush.scale),
    })


# Treat the back-right trunk and canopy as one tree by transforming both around
# the trunk base. Scale by 85%, then shift deeper into the back-right corner.
back_tree_parts = (
    bpy.data.objects.get("GardenTree_BackRight_Trunk_Tall"),
    bpy.data.objects.get("GardenTree_BackRight_Leaves_Tall"),
)
if all(back_tree_parts):
    for part in back_tree_parts:
        restore_or_remember_matrix(part)

    trunk = back_tree_parts[0]
    anchor = Vector((trunk.matrix_world.translation.x, trunk.matrix_world.translation.y, 0.0))
    delta = Vector((0.30, 0.85, 0.0))
    refinement = (
        Matrix.Translation(delta)
        @ Matrix.Translation(anchor)
        @ Matrix.Scale(0.85, 4)
        @ Matrix.Translation(-anchor)
    )
    for part in back_tree_parts:
        part.matrix_world = refinement @ part.matrix_world

    print("REFINED_BACK_TREE", {
        "base": tuple(round(v, 3) for v in trunk.matrix_world.translation),
        "scale_factor": 0.85,
        "shift": tuple(delta),
    })


# Remove the small side branch from the path endpoint. Visibility is used rather
# than deletion so the stone can be restored later.
fork_stone = bpy.data.objects.get("path_C.002")
if fork_stone:
    if "review_refine_original_hide_viewport" not in fork_stone:
        fork_stone["review_refine_original_hide_viewport"] = bool(fork_stone.hide_viewport)
        fork_stone["review_refine_original_hide_render"] = bool(fork_stone.hide_render)
    fork_stone.hide_viewport = True
    fork_stone.hide_render = True
    print("REFINED_PATH_FORK", {"hidden": fork_stone.name, "kept": "path_C.006"})

bpy.context.view_layer.update()
print("USER_GARDEN_REFINEMENT_COMPLETE")
