import bpy

bpy.ops.render.render(write_still=True)
print('PLAYER_RENDER', bpy.context.scene.render.filepath)
