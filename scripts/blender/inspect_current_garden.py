import bpy

targets = []
for obj in bpy.context.scene.objects:
    if (
        obj.name.startswith("GardenTree_")
        or obj.name.startswith("GardenShrub_Right")
        or obj.name.startswith("GardenShrub_Hedge_Right")
        or obj.name.startswith("path_C")
        or obj.name in {"Trunk_Tall", "Leaves_Tall"}
    ):
        targets.append(obj)

for obj in sorted(targets, key=lambda item: item.name):
    print("CURRENT_GARDEN", {
        "name": obj.name,
        "type": obj.type,
        "location": tuple(round(v, 4) for v in obj.location),
        "rotation": tuple(round(v, 4) for v in obj.rotation_euler),
        "scale": tuple(round(v, 4) for v in obj.scale),
        "dimensions": tuple(round(v, 4) for v in obj.dimensions),
        "hidden_viewport": obj.hide_viewport,
        "hidden_render": obj.hide_render,
    })
