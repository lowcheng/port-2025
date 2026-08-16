import bpy
import re


def connected_component_sizes(mesh):
    adjacency = [set() for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacency[a].add(b)
        adjacency[b].add(a)

    remaining = set(range(len(mesh.vertices)))
    sizes = []
    while remaining:
        seed = remaining.pop()
        stack = [seed]
        size = 1
        while stack:
            current = stack.pop()
            for neighbor in adjacency[current]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    stack.append(neighbor)
                    size += 1
        sizes.append(size)
    return sorted(sizes)


pattern = re.compile(r"tree|trunk|leaf|leaves|foliage|branch", re.IGNORECASE)

print(
    "TREE_SCENE",
    {
        "filepath": bpy.data.filepath,
        "mode": bpy.context.mode,
        "active": bpy.context.view_layer.objects.active.name
        if bpy.context.view_layer.objects.active
        else None,
        "selected": [obj.name for obj in bpy.context.selected_objects],
    },
)

for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    if not pattern.search(obj.name) and not pattern.search(obj.data.name):
        continue

    mesh = obj.data
    sizes = connected_component_sizes(mesh)
    print(
        "TREE_INSPECT",
        {
            "object": obj.name,
            "mesh": mesh.name,
            "location": tuple(round(value, 4) for value in obj.location),
            "rotation": tuple(round(value, 4) for value in obj.rotation_euler),
            "scale": tuple(round(value, 4) for value in obj.scale),
            "vertices": len(mesh.vertices),
            "edges": len(mesh.edges),
            "polygons": len(mesh.polygons),
            "components": len(sizes),
            "component_size_min": sizes[0] if sizes else 0,
            "component_size_max": sizes[-1] if sizes else 0,
            "component_sizes": {
                size: sizes.count(size) for size in sorted(set(sizes))
            },
            "bounds": [
                tuple(round(value, 4) for value in corner)
                for corner in obj.bound_box
            ],
        },
    )
