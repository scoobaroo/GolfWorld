"""Prepare a Mixamo golfer; see docs/avatar-assets.md for the pinned sources.

python3 scripts/prepare-golfer.py Michelle.glb Soldier.glb OUTPUT.glb
"""
import copy
import json
import math
import pathlib
import struct
import sys
import numpy as np


def read_glb(path):
    data = pathlib.Path(path).read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + size]), bytearray(data[28 + size:])


document, binary = read_glb(sys.argv[1])
motion, motion_binary = read_glb(sys.argv[2])


def values(doc, data, index):
    accessor = doc['accessors'][index]
    view = doc['bufferViews'][accessor['bufferView']]
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    component = {5123: 'H', 5125: 'I', 5126: 'f'}[accessor['componentType']]
    width = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[accessor['type']]
    fmt = '<' + component * width
    stride = view.get('byteStride', struct.calcsize(fmt))
    return [struct.unpack_from(fmt, data, offset + i * stride) for i in range(accessor['count'])]


def append_accessor(rows, kind, component=5126):
    binary.extend(b'\0' * (-len(binary) % 4))
    offset = len(binary)
    fmt = '<' + ('H' if component == 5123 else 'f') * len(rows[0])
    for row in rows:
        binary.extend(struct.pack(fmt, *row))
    view = len(document['bufferViews'])
    document['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(binary) - offset})
    index = len(document['accessors'])
    accessor = {'bufferView': view, 'componentType': component, 'count': len(rows), 'type': kind}
    if kind == 'SCALAR' and component == 5126:
        accessor.update(min=[min(row[0] for row in rows)], max=[max(row[0] for row in rows)])
    document['accessors'].append(accessor)
    return index


def matrix(node):
    if 'matrix' in node:
        return np.array(node['matrix']).reshape(4, 4).T
    x, y, z, w = node.get('rotation', [0, 0, 0, 1])
    result = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w), 0],
                       [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w), 0],
                       [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y), 0], [0, 0, 0, 1]], dtype=float)
    result[:3, :3] *= np.array(node.get('scale', [1, 1, 1]))
    result[:3, 3] = node.get('translation', [0, 0, 0])
    return result


def decompose(transform):
    scales = np.linalg.norm(transform[:3, :3], axis=0)
    r = transform[:3, :3] / scales
    # Stable rotation-matrix to quaternion conversion, including 180° bones.
    diagonal = [r[0, 0], r[1, 1], r[2, 2], np.trace(r)]
    index = int(np.argmax(diagonal))
    if index == 3:
        s = math.sqrt(1 + np.trace(r)) * 2
        q = [(r[2, 1]-r[1, 2])/s, (r[0, 2]-r[2, 0])/s, (r[1, 0]-r[0, 1])/s, s/4]
    else:
        i, k, l = index, (index+1) % 3, (index+2) % 3
        s = math.sqrt(1 + r[i, i]-r[k, k]-r[l, l]) * 2
        q = [0.0]*4
        q[i], q[k], q[l], q[3] = s/4, (r[k, i]+r[i, k])/s, (r[l, i]+r[i, l])/s, (r[l, k]-r[k, l])/s
    return {'rotation': q, 'translation': transform[:3, 3].tolist(), 'scale': scales.tolist()}


def bind_pose(doc, data):
    parents = {child: index for index, node in enumerate(doc['nodes']) for child in node.get('children', [])}
    skin = doc['skins'][0]
    inverse = values(doc, data, skin['inverseBindMatrices'])
    world = {node: np.linalg.inv(np.array(row).reshape(4, 4).T) for node, row in zip(skin['joints'], inverse)}

    def parent_world(index):
        if index in world:
            return world[index]
        local = matrix(doc['nodes'][index])
        return parent_world(parents[index]) @ local if index in parents else local

    return {index: decompose(np.linalg.inv(parent_world(parents[index])) @ transform if index in parents else transform)
            for index, transform in world.items()}


source_pose = bind_pose(motion, motion_binary)
for index, pose in bind_pose(document, binary).items():
    document['nodes'][index].update(pose)


def world_rotations(doc, data):
    skin = doc['skins'][0]
    rows = values(doc, data, skin['inverseBindMatrices'])
    return {index: decompose(np.linalg.inv(np.array(row).reshape(4, 4).T))['rotation']
            for index, row in zip(skin['joints'], rows)}


source_world = world_rotations(motion, motion_binary)
target_world = world_rotations(document, binary)
source_root = motion['nodes'][motion['scenes'][0]['nodes'][0]].get('rotation', [0, 0, 0, 1])


base_material = document['materials'][0]
document['materials'] = []
for name in ['skin', 'shirt', 'pants', 'shoes']:
    material = copy.deepcopy(base_material)
    material.pop('extensions', None)
    material.update(name='GolfWorld.' + name, doubleSided=False)
    material['pbrMetallicRoughness'].update(metallicFactor=0, roughnessFactor=0.8)
    document['materials'].append(material)

for mesh in document['meshes']:
    originals = list(mesh['primitives'])
    mesh['primitives'] = []
    for primitive in originals:
        positions = values(document, binary, primitive['attributes']['POSITION'])
        indices = [row[0] for row in values(document, binary, primitive['indices'])]
        groups = [[], [], [], []]
        for i in range(0, len(indices), 3):
            triangle = indices[i:i + 3]
            x, y, _ = [sum(positions[k][axis] for k in triangle) / 3 for axis in range(3)]
            region = 0 if y > 1.35 or abs(x) > 0.46 else 3 if y < 0.23 else 2 if y < 0.84 else 1
            groups[region].extend(triangle)
        for region, group in enumerate(groups):
            if group:
                part = copy.deepcopy(primitive)
                part.update(indices=append_accessor([(k,) for k in group], 'SCALAR', 5123), material=region)
                mesh['primitives'].append(part)


def multiply(a, b):
    x, y, z, w = a
    i, j, k, r = b
    return (w*i + x*r + y*k - z*j, w*j - x*k + y*r + z*i,
            w*k + x*j - y*i + z*r, w*r - x*i - y*j - z*k)


target_nodes = {node.get('name'): index for index, node in enumerate(document['nodes'])}
document['animations'] = []
for source in motion['animations']:
    if source['name'] not in ['Idle', 'Walk']:
        continue
    animation = {'name': source['name'].lower(), 'channels': [], 'samplers': []}
    for channel in source['channels']:
        # Preserve target limb lengths and floor position. Transfer local bone
        # rotation deltas from the T pose; Rapier supplies in-place locomotion.
        if channel['target']['path'] != 'rotation':
            continue
        source_node = motion['nodes'][channel['target']['node']]
        if source_node.get('name') == 'mixamorig:Hips':
            continue
        target_index = target_nodes.get(source_node.get('name'))
        if target_index is None:
            continue
        source_index = channel['target']['node']
        if source_index not in source_world or target_index not in target_world:
            continue
        source_rest = source_pose[source_index]['rotation']
        target_rest = document['nodes'][target_index].get('rotation', [0, 0, 0, 1])
        target_basis = target_world[target_index]
        # Soldier's geometry is Z-up in centimetres and faces the opposite way.
        # Align its bind axes, including each bone's roll, before transferring a
        # local rotation delta. Copying named quaternions alone twists the limbs.
        basis = multiply([-target_basis[0], -target_basis[1], -target_basis[2], target_basis[3]],
                         multiply([0, 1, 0, 0], multiply(source_root, source_world[source_index])))
        inverse_basis = [-basis[0], -basis[1], -basis[2], basis[3]]
        inverse_rest = [-source_rest[0], -source_rest[1], -source_rest[2], source_rest[3]]
        sampler = source['samplers'][channel['sampler']]
        rotations = []
        for row in values(motion, motion_binary, sampler['output']):
            delta = multiply(inverse_rest, row)
            q = multiply(target_rest, multiply(basis, multiply(delta, inverse_basis)))
            length = math.sqrt(sum(k*k for k in q))
            rotations.append(tuple(k / length for k in q))
        times = values(motion, motion_binary, sampler['input'])
        sampler_index = len(animation['samplers'])
        animation['samplers'].append({'input': append_accessor(times, 'SCALAR'), 'output': append_accessor(rotations, 'VEC4'), 'interpolation': 'LINEAR'})
        animation['channels'].append({'sampler': sampler_index, 'target': {'node': target_index, 'path': 'rotation'}})
    document['animations'].append(animation)

document['asset']['extras'] = {'credits': 'See docs/avatar-assets.md', 'units': 'metres'}
document['buffers'][0]['byteLength'] = len(binary)
encoded = json.dumps(document, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
binary.extend(b'\0' * (-len(binary) % 4))
output = pathlib.Path(sys.argv[3])
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary))
                   + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
                   + struct.pack('<II', len(binary), 0x004E4942) + binary)
print(f'{output}: {output.stat().st_size:,} bytes')
