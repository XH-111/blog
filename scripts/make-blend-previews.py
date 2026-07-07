import math
import os
import sys

import bpy
import mathutils


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_asset(asset_path):
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(asset_path))


def frame_asset():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        return

    min_corner = mathutils.Vector((float("inf"), float("inf"), float("inf")))
    max_corner = mathutils.Vector((float("-inf"), float("-inf"), float("-inf")))

    for obj in meshes:
        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ mathutils.Vector(corner)
            min_corner.x = min(min_corner.x, world_corner.x)
            min_corner.y = min(min_corner.y, world_corner.y)
            min_corner.z = min(min_corner.z, world_corner.z)
            max_corner.x = max(max_corner.x, world_corner.x)
            max_corner.y = max(max_corner.y, world_corner.y)
            max_corner.z = max(max_corner.z, world_corner.z)

    center = (min_corner + max_corner) / 2
    span = max((max_corner - min_corner).x, (max_corner - min_corner).y, (max_corner - min_corner).z)
    distance = max(span * 1.85, 4)

    bpy.ops.object.light_add(type="AREA", location=(center.x, center.y - distance * 0.45, center.z + distance))
    light = bpy.context.object
    light.name = "Preview Area Light"
    light.data.energy = 600
    light.data.size = max(span, 3)

    bpy.ops.object.camera_add(
        location=(center.x, center.y - distance, center.z + distance * 0.55),
        rotation=(math.radians(62), 0, 0),
    )
    camera = bpy.context.object
    camera.name = "Preview Camera"
    bpy.context.scene.camera = camera

    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]

    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.shading.type = "MATERIAL"


def convert(asset_path):
    clear_scene()
    import_asset(asset_path)
    frame_asset()
    output_path = os.path.splitext(os.path.abspath(asset_path))[0] + ".blend"
    bpy.ops.wm.save_as_mainfile(filepath=output_path)
    print(f"Saved preview blend: {output_path}")


if "--" in sys.argv:
    asset_paths = sys.argv[sys.argv.index("--") + 1 :]
else:
    asset_paths = sys.argv[1:]

if not asset_paths:
    raise SystemExit("No GLB/GLTF files were provided.")

for asset_path in asset_paths:
    convert(asset_path)
