import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

/** Scene bounding box in metres: w (x), h (y), d (z). glTF is defined in metres. */
export async function glbSizeMetres(path) {
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
  const root = doc.getRoot();
  const { min, max } = getBounds(root.getDefaultScene() ?? root.listScenes()[0]);
  return { w: max[0] - min[0], h: max[1] - min[1], d: max[2] - min[2] };
}
