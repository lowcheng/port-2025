import bpy


def remember_name(data_block, key="export_previous_name"):
    if key not in data_block:
        data_block[key] = data_block.name


def rename_object(old_name, new_name, role=None):
    obj = bpy.data.objects.get(old_name)
    if obj is None:
        # Makes the script safe to rerun after names have already changed.
        obj = bpy.data.objects.get(new_name)
    if obj is None:
        print("RENAME_MISSING_OBJECT", old_name)
        return None
    remember_name(obj)
    obj.name = new_name
    if role:
        obj["export_role"] = role
    print("RENAMED_OBJECT", old_name, "->", obj.name)
    return obj


def rename_material(old_name, new_name, shader_group=None):
    material = bpy.data.materials.get(old_name) or bpy.data.materials.get(new_name)
    if material is None:
        print("RENAME_MISSING_MATERIAL", old_name)
        return None
    remember_name(material)
    material.name = new_name
    if shader_group:
        material["shader_group"] = shader_group
    print("RENAMED_MATERIAL", old_name, "->", material.name)
    return material


def rename_collection(old_name, new_name):
    collection = bpy.data.collections.get(old_name) or bpy.data.collections.get(new_name)
    if collection is None:
        print("RENAME_MISSING_COLLECTION", old_name)
        return None
    remember_name(collection)
    collection.name = new_name
    print("RENAMED_COLLECTION", old_name, "->", collection.name)
    return collection


def rename_mesh_for_object(object_name, mesh_name):
    obj = bpy.data.objects.get(object_name)
    if obj is None or obj.type != "MESH":
        return
    mesh = obj.data
    remember_name(mesh)
    mesh.name = mesh_name
    print("RENAMED_MESH", object_name, "->", mesh.name)


# Collections are named by scene purpose rather than creation history.
rename_collection("trees", "ENV_Vegetation_Hero")
rename_collection("Garden_Population_Generated", "ENV_Vegetation_Population")
rename_collection("Collection 9", "ENV_Path")


# Hero trees and their reversible canopy backups.
object_names = {
    "Trunk_Tall": ("ENV_Tree_Tall_Trunk", "bark"),
    "Leaves_Tall": ("ENV_Tree_Tall_Foliage", "foliage"),
    "Trunk_Small": ("ENV_Tree_Small_Trunk", "bark"),
    "Leaves_Small": ("ENV_Tree_Small_Foliage", "foliage"),
    "Leaves_Tall__SilhouetteBackup": ("BAK_Tree_Tall_Foliage", "backup"),
    "Leaves_Small__SilhouetteBackup": ("BAK_Tree_Small_Foliage", "backup"),

    "GardenTree_BackLeft_Trunk_Tall": ("ENV_Tree_BackLeft_Trunk", "bark"),
    "GardenTree_BackLeft_Leaves_Tall": ("ENV_Tree_BackLeft_Foliage", "foliage"),
    "GardenTree_BackRight_Trunk_Tall": ("ENV_Tree_BackRight_Trunk", "bark"),
    "GardenTree_BackRight_Leaves_Tall": ("ENV_Tree_BackRight_Foliage", "foliage"),
    "GardenTree_LeftEdge_Trunk_Small": ("ENV_Tree_LeftEdge_Trunk", "bark"),
    "GardenTree_LeftEdge_Leaves_Small": ("ENV_Tree_LeftEdge_Foliage", "foliage"),
    "GardenTree_RightFront_Trunk_Small": ("ENV_Tree_RightFront_Trunk", "bark"),
    "GardenTree_RightFront_Leaves_Small": ("ENV_Tree_RightFront_Foliage", "foliage"),

    "Bush": ("ENV_Bush_Left_Base", "foliage"),
    "Bush_Flowers": ("ENV_Bush_Left_Flowers", "foliage_flower"),
    "Bush.001": ("ENV_Bush_Right_Base", "foliage"),
    "Bush_Flowers.001": ("ENV_Bush_Right_Flowers", "foliage_flower"),

    "GardenShrub_BackLeftBase": ("ENV_Bush_BackLeft_Base", "foliage"),
    "GardenShrub_BackLeftFlowers": ("ENV_Bush_BackLeft_Flowers", "foliage_flower"),
    "GardenShrub_BackRightBase": ("ENV_Bush_BackRight_Base", "foliage"),
    "GardenShrub_LeftEdgeBase": ("ENV_Bush_LeftEdge_Base", "foliage"),
    "GardenShrub_LeftEdgeFlowers": ("ENV_Bush_LeftEdge_Flowers", "foliage_flower"),
    "GardenShrub_RightFrontBase": ("ENV_Bush_RightFront_Base", "foliage"),
    "GardenShrub_RightFrontFlowers": ("ENV_Bush_RightFront_Flowers", "foliage_flower"),

    "GardenShrub_Hedge_LeftA": ("ENV_Hedge_Left_A", "foliage"),
    "GardenShrub_Hedge_LeftB": ("ENV_Hedge_Left_B", "foliage"),
    "GardenShrub_Hedge_LeftC": ("ENV_Hedge_Left_C", "foliage"),
    "GardenShrub_Hedge_RightA": ("ENV_Hedge_Right_A", "foliage"),
    "GardenShrub_Hedge_RightB": ("ENV_Hedge_Right_B", "foliage"),
    "GardenShrub_Hedge_RightC": ("ENV_Hedge_Right_C", "foliage"),

    "path_C.003": ("ENV_Path_Stone_01", "stone"),
    "path_C": ("ENV_Path_Stone_02", "stone"),
    "path_C.004": ("ENV_Path_Stone_03", "stone"),
    "path_C.006": ("ENV_Path_Stone_04", "stone"),
    "path_C.001": ("BAK_Path_Stone_Extra_01", "backup"),
    "path_C.002": ("BAK_Path_Stone_Fork", "backup"),
    "path_C.005": ("BAK_Path_Stone_Extra_02", "backup"),
    "path_C.007": ("BAK_Path_Stone_Extra_03", "backup"),

    "GROUND": ("ENV_Grass_Ground", "grass"),
    "Sphere": ("HELPER_Tree_FoliageNormalVolume", "helper"),
}

for old_name, (new_name, role) in object_names.items():
    rename_object(old_name, new_name, role)


# Shared geometry names describe the reusable asset, not an arbitrary instance.
rename_mesh_for_object("ENV_Tree_Tall_Trunk", "GEO_TreeTall_Trunk")
rename_mesh_for_object("ENV_Tree_Tall_Foliage", "GEO_TreeTall_FoliageCards")
rename_mesh_for_object("ENV_Tree_Small_Trunk", "GEO_TreeSmall_Trunk")
rename_mesh_for_object("ENV_Tree_Small_Foliage", "GEO_TreeSmall_FoliageCards")
rename_mesh_for_object("BAK_Tree_Tall_Foliage", "BAK_GEO_TreeTall_Foliage")
rename_mesh_for_object("BAK_Tree_Small_Foliage", "BAK_GEO_TreeSmall_Foliage")
rename_mesh_for_object("ENV_Bush_Left_Base", "GEO_Bush_BaseCards_A")
rename_mesh_for_object("ENV_Bush_Right_Base", "GEO_Bush_BaseCards_B")
rename_mesh_for_object("ENV_Bush_Left_Flowers", "GEO_Bush_FlowerCards_A")
rename_mesh_for_object("ENV_Bush_Right_Flowers", "GEO_Bush_FlowerCards_B")
rename_mesh_for_object("ENV_Grass_Ground", "GEO_Grass_Ground")

for index in range(1, 5):
    rename_mesh_for_object(f"ENV_Path_Stone_{index:02d}", f"GEO_Path_Stone_{index:02d}")
for suffix in ("Extra_01", "Fork", "Extra_02", "Extra_03"):
    rename_mesh_for_object(f"BAK_Path_Stone_{suffix}", f"BAK_GEO_Path_Stone_{suffix}")


# Material prefixes provide a stable shader contract for Three.js.
rename_material("NormalTree_Bark.002", "MAT_Bark_TreeTall", "bark")
rename_material("NormalTree_Bark.003", "MAT_Bark_TreeSmall", "bark")
rename_material("NormalTree_Leaves.002", "MAT_Foliage_TreeBranchCards", "foliage")
rename_material("NormalTree_Leaves.003", "MAT_Foliage_TreeLeaves", "foliage")
rename_material("Bush_Leaves", "MAT_Foliage_BushLeaves", "foliage")
rename_material("Bush_Leaves.001", "MAT_Foliage_FlowerBushLeaves", "foliage")
rename_material("Flowers", "MAT_Accent_Flowers", "flower")
rename_material("StonePaths", "MAT_Surface_SteppingStone", "stone")


# Ground has no material yet, but its role is explicit for the later grass shader.
ground = bpy.data.objects.get("ENV_Grass_Ground")
if ground:
    ground["shader_group"] = "grass"

bpy.context.view_layer.update()
print("LANDSCAPE_RENAME_COMPLETE")
