import bpy


if not bpy.data.filepath:
    raise RuntimeError("The current Blender scene has no file path")

bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
print("SAVED_BLEND", bpy.data.filepath)
