import bpy

relevant_collections = {"trees", "Garden_Population_Generated", "Collection 9"}

for obj in sorted(bpy.context.scene.objects, key=lambda item: item.name):
    collections = {collection.name for collection in obj.users_collection}
    relevant = (
        bool(collections & relevant_collections)
        or obj.name.startswith("Garden")
        or obj.name.startswith("path_C")
        or obj.name in {
            "Trunk_Tall", "Leaves_Tall", "Trunk_Small", "Leaves_Small",
            "Bush", "Bush.001", "Bush_Flowers", "Bush_Flowers.001",
            "Leaves_Tall__SilhouetteBackup", "Leaves_Small__SilhouetteBackup",
        }
    )
    if not relevant:
        continue

    print("LANDSCAPE_NAME", {
        "object": obj.name,
        "data": obj.data.name if getattr(obj, "data", None) else None,
        "materials": [slot.material.name if slot.material else "" for slot in obj.material_slots],
        "collections": sorted(collections),
        "hidden": obj.hide_viewport or obj.hide_render,
        "location": tuple(round(v, 3) for v in obj.location),
    })

for material in sorted(bpy.data.materials, key=lambda item: item.name):
    if any(token in material.name.lower() for token in ("tree", "leaf", "bush", "flower", "stone", "bark")):
        print("LANDSCAPE_MATERIAL", {
            "name": material.name,
            "users": material.users,
        })
