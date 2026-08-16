import bpy

print("LANDSCAPE_SCENE", bpy.data.filepath)

for obj in bpy.context.scene.objects:
    if obj.type != "MESH" or obj.hide_viewport or obj.hide_render:
        continue

    name = obj.name.lower()
    mats = [slot.material.name if slot.material else "" for slot in obj.material_slots]
    material_text = " ".join(mats).lower()
    dims = tuple(round(v, 4) for v in obj.dimensions)
    loc = tuple(round(v, 4) for v in obj.location)

    likely_named = any(word in name for word in (
        "bush", "shrub", "rock", "stone", "flower", "plant", "leaf"
    ))
    likely_material = any(word in material_text for word in (
        "bush", "shrub", "rock", "stone", "flower", "leaf"
    ))
    near_ground_prop = (
        obj.location.z < 2.0
        and max(obj.dimensions.x, obj.dimensions.y) < 5.0
        and obj.dimensions.z < 3.5
        and max(obj.dimensions.x, obj.dimensions.y) > 0.15
    )

    if likely_named or likely_material or near_ground_prop:
        collections = [collection.name for collection in obj.users_collection]
        print("LANDSCAPE_CANDIDATE", {
            "name": obj.name,
            "location": loc,
            "rotation_z": round(obj.rotation_euler.z, 4),
            "scale": tuple(round(v, 4) for v in obj.scale),
            "dimensions": dims,
            "materials": mats,
            "collections": collections,
            "parent": obj.parent.name if obj.parent else None,
        })
