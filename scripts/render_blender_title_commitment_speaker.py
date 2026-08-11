#!/usr/bin/env python3
"""Render a Blender 3D presenter video for the title commitment process.

Run with:
  blender -b --python scripts/render_blender_title_commitment_speaker.py -- --output /tmp/title_commitment_speaker_silent.mp4
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


WIDTH = 1280
HEIGHT = 720
FPS = 24
DURATION_SECONDS = 36
TOTAL_FRAMES = FPS * DURATION_SECONDS

NARRATION = (
    "This walkthrough explains the title commitment process in neutral terms. "
    "The order is received and checked for party, property, and transaction details. "
    "Public records are searched for deeds, liens, judgments, taxes, and restrictions. "
    "The title search is examined to understand ownership and matters affecting coverage. "
    "Schedule A is prepared with the insured parties, policy amount, estate, and legal description. "
    "Requirements and exceptions are added, then the commitment is reviewed for accuracy. "
    "After review, the title commitment is issued to the transaction parties."
)

STEPS = [
    ("Receive and Review the Order", "Confirm parties, property, and transaction details."),
    ("Search the Public Records", "Look for deeds, liens, judgments, taxes, and restrictions."),
    ("Title Examination", "Evaluate ownership, encumbrances, easements, and exceptions."),
    ("Complete Schedule A", "Prepare insured parties, policy amount, estate, and legal description."),
    ("Add Requirements and Exceptions", "List what must be satisfied and what is not covered."),
    ("Review for Accuracy", "Check names, vesting, legal description, requirements, and exceptions."),
    ("Issue the Commitment", "Distribute the final commitment to the transaction parties."),
    ("Closing Summary", "Accurate search, careful examination, quality review, and clear commitment."),
]


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args(argv)


def material(name: str, color: tuple[float, float, float, float], roughness: float = 0.55) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_uv_sphere(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float], mat: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    return obj


def add_cylinder_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    mat: bpy.types.Material,
) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    mid = (start_v + end_v) / 2
    direction = end_v - start_v
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=direction.length, location=mid)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    return obj


def add_box(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float], mat: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    return obj


def add_text(
    name: str,
    body: str,
    loc: tuple[float, float, float],
    size: float,
    mat: bpy.types.Material,
    align: str = "CENTER",
) -> bpy.types.Object:
    bpy.ops.object.text_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = align
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.01
    obj.data.materials.append(mat)
    obj.rotation_euler = (math.radians(72), 0, 0)
    return obj


def set_visible(obj: bpy.types.Object, frame: int, visible: bool) -> None:
    obj.hide_viewport = not visible
    obj.hide_render = not visible
    obj.keyframe_insert(data_path="hide_viewport", frame=frame)
    obj.keyframe_insert(data_path="hide_render", frame=frame)


def build_scene(output: Path) -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = TOTAL_FRAMES
    scene.frame_set(1)
    scene.render.fps = FPS
    scene.render.resolution_x = WIDTH
    scene.render.resolution_y = HEIGHT
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scene.render.filepath = str(output)

    skin = material("warm skin", (0.78, 0.50, 0.35, 1))
    hair = material("dark brown hair", (0.07, 0.045, 0.035, 1), 0.38)
    hair_highlight = material("soft hair highlight", (0.22, 0.17, 0.13, 1), 0.34)
    blazer = material("black blazer", (0.012, 0.014, 0.018, 1))
    blouse = material("white blouse", (0.95, 0.92, 0.86, 1))
    eye_white = material("eye white", (0.95, 0.93, 0.88, 1))
    eye_dark = material("brown eye", (0.11, 0.06, 0.03, 1))
    mouth_mat = material("animated mouth", (0.10, 0.02, 0.025, 1))
    blue = material("title blue", (0.02, 0.18, 0.38, 1))
    gold = material("accent gold", (0.95, 0.64, 0.10, 1))
    white = material("clean white", (0.95, 0.95, 0.91, 1))
    floor_mat = material("office floor", (0.32, 0.35, 0.36, 1))
    glass_mat = material("glass panel", (0.42, 0.62, 0.76, 0.38), 0.12)
    glass_mat.blend_method = "BLEND"
    text_mat = material("text dark", (0.04, 0.06, 0.08, 1))

    add_box("floor", (0, 0.9, -0.06), (4.8, 4.2, 0.04), floor_mat)
    add_box("back wall", (0, 2.5, 1.8), (4.8, 0.06, 1.9), white)
    for x in (-1.8, -0.6, 0.6, 1.8):
        add_box("glass office panel", (x, 2.42, 1.65), (0.45, 0.025, 1.25), glass_mat)
    add_box("desk", (0, -0.62, 0.46), (2.8, 0.42, 0.08), material("wood desk", (0.55, 0.36, 0.20, 1)))

    bpy.ops.object.light_add(type="AREA", location=(-2.0, -3.2, 4.0))
    key = bpy.context.object
    key.name = "large softbox"
    key.data.energy = 650
    key.data.size = 4.0
    bpy.ops.object.light_add(type="POINT", location=(2.5, -1.4, 2.4))
    rim = bpy.context.object
    rim.name = "rim light"
    rim.data.energy = 90

    bpy.ops.object.camera_add(location=(0, -5.8, 2.25))
    camera = bpy.context.object
    look_at(camera, (0, 0, 1.22))
    scene.camera = camera

    presenter = bpy.data.objects.new("portrait based 3D presenter rig", None)
    bpy.context.collection.objects.link(presenter)
    presenter.location = (-1.05, -0.35, 0.28)

    parts: list[bpy.types.Object] = []
    parts.append(add_uv_sphere("head", (0, 0, 1.82), (0.34, 0.30, 0.40), skin))
    parts.append(add_uv_sphere("hair shell", (0, 0.05, 1.88), (0.41, 0.34, 0.46), hair))
    parts.append(add_uv_sphere("left side hair", (-0.31, -0.01, 1.56), (0.11, 0.12, 0.50), hair))
    parts.append(add_uv_sphere("right side hair", (0.31, -0.01, 1.56), (0.11, 0.12, 0.50), hair))
    for index, x in enumerate((-0.18, -0.06, 0.06, 0.18)):
        bang = add_uv_sphere(f"bang {index}", (x, -0.24, 2.13 - abs(x) * 0.12), (0.10, 0.08, 0.22), hair_highlight if index == 1 else hair)
        bang.rotation_euler[1] = math.radians(12 if x < 0 else -12)
        parts.append(bang)

    parts.append(add_uv_sphere("torso blazer", (0, 0, 0.92), (0.42, 0.20, 0.58), blazer))
    parts.append(add_uv_sphere("white blouse panel", (0, -0.18, 0.96), (0.19, 0.05, 0.40), blouse))
    parts.append(add_cylinder_between("left upper arm", (-0.33, 0, 1.22), (-0.62, -0.04, 0.82), 0.055, blazer))
    right_arm = add_cylinder_between("right speaking arm", (0.34, 0, 1.22), (0.73, -0.08, 1.55), 0.055, blazer)
    parts.append(right_arm)
    left_hand = add_uv_sphere("left hand", (-0.66, -0.05, 0.78), (0.09, 0.07, 0.08), skin)
    right_hand = add_uv_sphere("right hand", (0.77, -0.10, 1.57), (0.08, 0.07, 0.08), skin)
    parts.extend([left_hand, right_hand])

    for x in (-0.12, 0.12):
        parts.append(add_uv_sphere("eye white", (x, -0.285, 1.91), (0.055, 0.018, 0.038), eye_white))
        parts.append(add_uv_sphere("eye pupil", (x, -0.305, 1.91), (0.026, 0.010, 0.026), eye_dark))
    mouth = add_uv_sphere("speaking mouth", (0.0, -0.305, 1.74), (0.085, 0.012, 0.026), mouth_mat)
    parts.append(mouth)

    for obj in parts:
        obj.parent = presenter
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.shade_smooth()
    for obj in parts:
        obj.select_set(False)

    for frame in range(1, TOTAL_FRAMES + 1, 6):
        t = frame / FPS
        presenter.location.z = 0.28 + math.sin(t * 2.2) * 0.025
        presenter.rotation_euler = (0, 0, math.sin(t * 0.8) * 0.035)
        presenter.keyframe_insert(data_path="location", frame=frame)
        presenter.keyframe_insert(data_path="rotation_euler", frame=frame)
        mouth.scale = (0.085, 0.012, 0.022 + (0.025 * (0.5 + 0.5 * math.sin(t * 18.0))))
        mouth.keyframe_insert(data_path="scale", frame=frame)
        right_arm.rotation_euler.rotate_axis("X", math.sin(t * 2.1) * 0.006)
        right_arm.keyframe_insert(data_path="rotation_euler", frame=frame)
        right_hand.location.z = 1.57 + math.sin(t * 2.1) * 0.05
        right_hand.keyframe_insert(data_path="location", frame=frame)

    add_text("title", "Title Commitment Process", (0, -0.68, 2.62), 0.17, blue)
    add_text("subtitle", "Neutral 3D presenter walkthrough", (0, -0.67, 2.39), 0.075, gold)

    step_frames = TOTAL_FRAMES // len(STEPS)
    for index, (title, body) in enumerate(STEPS):
        frame_start = index * step_frames + 1
        frame_end = min(TOTAL_FRAMES, (index + 1) * step_frames)
        panel = add_box(f"step panel {index + 1}", (0.88, -0.35, 1.45), (1.20, 0.035, 0.42), white)
        panel.rotation_euler = (math.radians(0), 0, 0)
        title_obj = add_text(f"step title {index + 1}", f"Step {index + 1}: {title}", (0.88, -0.72, 1.72), 0.070, blue)
        body_obj = add_text(f"step body {index + 1}", body, (0.88, -0.72, 1.48), 0.044, text_mat)
        for obj in (panel, title_obj, body_obj):
            set_visible(obj, max(1, frame_start - 2), False)
            set_visible(obj, frame_start, True)
            set_visible(obj, frame_end, True)
            set_visible(obj, min(TOTAL_FRAMES, frame_end + 2), False)

    bpy.ops.wm.save_as_mainfile(filepath="/tmp/title_commitment_speaker_scene.blend")
    bpy.ops.render.render(animation=True)


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    build_scene(args.output)


if __name__ == "__main__":
    main()
