import bpy

issues = []
foliage_objects = []

for obj in bpy.context.scene.objects:
    if not obj.name.startswith("ENV_"):
        continue

    role = obj.get("export_role", "")
    if role in {"foliage", "foliage_flower"}:
        foliage_objects.append(obj)
        material_names = [slot.material.name for slot in obj.material_slots if slot.material]
        if not any(name.startswith("MAT_Foliage_") for name in material_names):
            issues.append(f"{obj.name}: missing MAT_Foliage_ material")

for obj in bpy.context.scene.objects:
    if obj.name.startswith("BAK_") and not (obj.hide_viewport and obj.hide_render):
        issues.append(f"{obj.name}: backup is not fully hidden")

required_materials = {
    "MAT_Foliage_TreeLeaves",
    "MAT_Foliage_TreeBranchCards",
    "MAT_Foliage_BushLeaves",
    "MAT_Foliage_FlowerBushLeaves",
    "MAT_Accent_Flowers",
    "MAT_Bark_TreeTall",
    "MAT_Bark_TreeSmall",
    "MAT_Surface_SteppingStone",
}
missing_materials = sorted(required_materials - set(bpy.data.materials.keys()))
for material_name in missing_materials:
    issues.append(f"missing material: {material_name}")

ground = bpy.data.objects.get("ENV_Grass_Ground")
if ground is None or ground.get("shader_group") != "grass":
    issues.append("ENV_Grass_Ground: missing grass shader role")

print("EXPORT_CONTRACT", {
    "foliage_objects": len(foliage_objects),
    "foliage_materials": sorted(
        material.name for material in bpy.data.materials
        if material.name.startswith("MAT_Foliage_")
    ),
    "environment_collections": sorted(
        collection.name for collection in bpy.data.collections
        if collection.name.startswith("ENV_")
    ),
    "issues": issues,
})

if issues:
    raise RuntimeError("Landscape export contract failed: " + "; ".join(issues))

print("LANDSCAPE_EXPORT_CONTRACT_OK")
