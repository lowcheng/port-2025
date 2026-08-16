import bpy
import math
from mathutils import Vector


CANOPIES = {
    "Leaves_Tall": {
        "height_scale": 1.0,
        "width_scale": 1.0,
        "depth_scale": 1.15,
        "bottom_scale": 0.81,
        "middle_scale": 1.06,
        "top_scale": 0.73,
        "card_scale": 1.075,
        "lobe_strength": 0.085,
        "lean_x": 0.16,
        "lean_y": -0.05,
    },
    "Leaves_Small": {
        "height_scale": 1.09,
        "width_scale": 0.98,
        "depth_scale": 1.08,
        "bottom_scale": 0.78,
        "middle_scale": 1.05,
        "top_scale": 0.69,
        "card_scale": 1.08,
        "lobe_strength": 0.095,
        "lean_x": -0.09,
        "lean_y": 0.08,
    },
}


def smoothstep(edge0, edge1, value):
    value = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return value * value * (3.0 - 2.0 * value)


def create_or_restore_backup(obj):
    backup_name = f"{obj.name}__SilhouetteBackup"
    backup = bpy.data.objects.get(backup_name)

    if backup is None:
        backup = obj.copy()
        backup.data = obj.data.copy()
        backup.name = backup_name
        backup.data.name = f"{obj.data.name}__SilhouetteBackup"
        for collection in obj.users_collection:
            collection.objects.link(backup)
        backup.hide_set(True)
        backup.hide_viewport = True
        backup.hide_render = True
        backup.hide_select = True
    else:
        obj.data = backup.data.copy()
        obj.data.name = obj.name + "_NaturalCanopy"

    return backup


def canopy_profile(t, settings):
    if t < 0.5:
        blend = smoothstep(0.0, 0.5, t)
        return settings["bottom_scale"] * (1.0 - blend) + settings[
            "middle_scale"
        ] * blend

    blend = smoothstep(0.5, 1.0, t)
    return settings["middle_scale"] * (1.0 - blend) + settings[
        "top_scale"
    ] * blend


def reshape_canopy(obj, settings):
    create_or_restore_backup(obj)
    mesh = obj.data

    points = [vertex.co.copy() for vertex in mesh.vertices]
    minimum = Vector(
        (
            min(point.x for point in points),
            min(point.y for point in points),
            min(point.z for point in points),
        )
    )
    maximum = Vector(
        (
            max(point.x for point in points),
            max(point.y for point in points),
            max(point.z for point in points),
        )
    )
    center = (minimum + maximum) * 0.5
    height = max(maximum.z - minimum.z, 0.001)

    moved_vertices = set()
    for card_index, polygon in enumerate(mesh.polygons):
        indices = list(polygon.vertices)
        if len(indices) != 4 or any(index in moved_vertices for index in indices):
            continue

        card_center = sum((mesh.vertices[index].co for index in indices), Vector()) / 4.0
        t = max(0.0, min(1.0, (card_center.z - minimum.z) / height))

        relative = card_center - center
        angle = math.atan2(relative.y, relative.x)
        profile = canopy_profile(t, settings)

        lobe = 1.0
        lobe += settings["lobe_strength"] * math.sin(angle * 3.0 + t * 4.1)
        lobe += settings["lobe_strength"] * 0.52 * math.sin(
            angle * 5.0 - t * 5.3 + 0.7
        )

        target_center = card_center.copy()
        target_center.x = center.x + relative.x * profile * lobe * settings[
            "width_scale"
        ]
        target_center.y = center.y + relative.y * profile * lobe * settings[
            "depth_scale"
        ]
        target_center.z = minimum.z + (card_center.z - minimum.z) * settings[
            "height_scale"
        ]

        crown_amount = smoothstep(0.25, 1.0, t)
        target_center.x += settings["lean_x"] * crown_amount
        target_center.y += settings["lean_y"] * crown_amount

        for index in indices:
            card_offset = mesh.vertices[index].co - card_center
            mesh.vertices[index].co = (
                target_center + card_offset * settings["card_scale"]
            )
            moved_vertices.add(index)

    mesh.update()
    obj["canopy_silhouette"] = "natural_taper_v1"

    print(
        "RESHAPED_CANOPY",
        {
            "object": obj.name,
            "cards": len(mesh.polygons),
            "moved_vertices": len(moved_vertices),
            "height_scale": settings["height_scale"],
            "card_scale": settings["card_scale"],
        },
    )


if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")

for object_name, settings in CANOPIES.items():
    canopy = bpy.data.objects.get(object_name)
    if canopy is None:
        raise RuntimeError(f"Canopy object not found: {object_name}")
    reshape_canopy(canopy, settings)

bpy.context.view_layer.update()
print("CANOPY_RESHAPE_COMPLETE")
