"""Bake the Kenney animated character (FBX rig + separate FBX clips) into one glTF binary
with named animation clips so Three.js can play them with an AnimationMixer.

The clip files carry a different bind pose from the model file (arms down instead of the
T-pose), so an action cannot simply be moved across: every bone of the model rig is
constrained to the same-named bone of the clip rig in world space and the result is baked
frame by frame. That gives correct poses regardless of the rest-pose mismatch.

Run:  blender -b --python tools/export-chef.py -- <kit dir> <out.glb>
      (npm run chef does this with the default paths)
"""
import os
import sys

import bpy

# ─── Config ─────────────────────────────────────────────────────────────────
CLIPS = {'idle': 'idle.fbx', 'run': 'run.fbx', 'jump': 'jump.fbx'}
CONSTRAINT = 'RetargetCopy'


# ─── Helpers ────────────────────────────────────────────────────────────────

def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    kit = argv[0] if len(argv) > 0 else os.path.join(root, 'assets', 'kenney_animated-characters-protagonists')
    out = argv[1] if len(argv) > 1 else os.path.join(root, 'public', 'models', 'chef', 'chef.glb')
    return kit, out


def import_fbx(path):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    return [o for o in bpy.context.scene.objects if o not in before]


def armature_of(objects):
    return next(o for o in objects if o.type == 'ARMATURE')


def longest_action(actions):
    return max(actions, key=lambda a: a.frame_range[1] - a.frame_range[0])


def select_only(obj):
    bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object and bpy.context.object.mode != 'OBJECT' else None
    for o in bpy.context.scene.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def add_retarget_constraints(rig, source_rig):
    for bone in rig.pose.bones:
        if bone.name not in source_rig.pose.bones:
            continue
        c = bone.constraints.new('COPY_TRANSFORMS')
        c.name = CONSTRAINT
        c.target = source_rig
        c.subtarget = bone.name
        c.owner_space = 'WORLD'
        c.target_space = 'WORLD'


def bake_clip(rig, source_rig, action, name):
    """Bakes the constrained pose of `rig` over the action's frames into a new action."""
    if source_rig.animation_data is None:
        source_rig.animation_data_create()
    source_rig.animation_data.action = action
    start, end = int(action.frame_range[0]), int(action.frame_range[1])
    add_retarget_constraints(rig, source_rig)
    select_only(rig)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.nla.bake(frame_start=start, frame_end=end, only_selected=True, visual_keying=True,
                     clear_constraints=True, use_current_action=False, bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    baked = rig.animation_data.action
    baked.name = name
    rig.animation_data.action = None
    return baked


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    kit, out = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    model_objects = import_fbx(os.path.join(kit, 'Model', 'characterMedium.fbx'))
    rig = armature_of(model_objects)
    if rig.animation_data is None:
        rig.animation_data_create()
    print('CHEF rig', rig.name, 'dims', [round(v, 3) for v in rig.dimensions])

    for clip_name, fname in CLIPS.items():
        before = set(bpy.data.actions)
        clip_objects = import_fbx(os.path.join(kit, 'Animations', fname))
        source_rig = armature_of(clip_objects)
        source_action = longest_action([a for a in bpy.data.actions if a not in before])
        baked = bake_clip(rig, source_rig, source_action, clip_name)
        track = rig.animation_data.nla_tracks.new()
        track.name = clip_name
        track.strips.new(clip_name, int(baked.frame_range[0]), baked)
        for o in clip_objects:
            bpy.data.objects.remove(o, do_unlink=True)
        for a in [a for a in bpy.data.actions if a not in before and a is not baked]:
            bpy.data.actions.remove(a)
        print('CLIP', clip_name, 'frames', [round(v) for v in baked.frame_range])

    os.makedirs(os.path.dirname(out), exist_ok=True)
    select_only(rig)
    for o in model_objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format='GLB',
        use_selection=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_nla_strips=True,
        export_skins=True,
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
        export_image_format='NONE',
    )
    print('EXPORTED', out, os.path.getsize(out))


main()
