import math
import os
import sys

import bpy


def get_asset_path():
    if "--" in sys.argv:
        extra_args = sys.argv[sys.argv.index("--") + 1 :]
    else:
        extra_args = sys.argv[1:]

    if not extra_args:
        raise SystemExit("No GLB/GLTF path was provided.")

    asset_path = os.path.abspath(extra_args[-1])
    if not asset_path.lower().endswith((".glb", ".gltf")):
        raise SystemExit(f"Unsupported file type: {asset_path}")
    return asset_path


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def frame_asset_with_camera():
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not objects:
        return

    min_corner = [float("inf"), float("inf"), float("inf")]
    max_corner = [float("-inf"), float("-inf"), float("-inf")]
    for obj in objects:
        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ mathutils.Vector(corner)
            for index in range(3):
                min_corner[index] = min(min_corner[index], world_corner[index])
                max_corner[index] = max(max_corner[index], world_corner[index])

    center = [(min_corner[index] + max_corner[index]) / 2 for index in range(3)]
    span = max(max_corner[index] - min_corner[index] for index in range(3))
    distance = max(span * 1.8, 4)

    bpy.ops.object.light_add(type="AREA", location=(center[0], center[1] - distance * 0.6, center[2] + distance))
    light = bpy.context.object
    light.name = "GLB Preview Area Light"
    light.data.energy = 500
    light.data.size = max(span, 3)

    bpy.ops.object.camera_add(location=(center[0], center[1] - distance, center[2] + distance * 0.55), rotation=(math.radians(62), 0, 0))
    camera = bpy.context.object
    camera.name = "GLB Preview Camera"
    bpy.context.scene.camera = camera

    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


asset_path = get_asset_path()
clear_scene()
bpy.ops.import_scene.gltf(filepath=asset_path)

try:
    import mathutils

    frame_asset_with_camera()
except Exception as error:
    print(f"Preview camera setup skipped: {error}")

print(f"Imported GLB/GLTF asset: {asset_path}")
