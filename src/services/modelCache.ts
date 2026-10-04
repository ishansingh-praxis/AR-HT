import { useEffect, useRef, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { modelCacheName } from '../utils/perf';
import type { Product } from '../types/furniture';

const dir = () => new Directory(Paths.document, 'models');

/** Local file for a product's model, downloaded once. Keyed by id and version, so a new model version is a new file. */
export async function cachedModelUri(p: Product): Promise<string | null> {
  if (!p.model3D?.url) return null;
  try {
    const d = dir();
    if (!d.exists) d.create();
    const name = modelCacheName(p.id, p.model3D.version);
    const file = new File(d, name);
    if (file.exists && file.size > 0) return file.uri;
    // drop older versions of the same product
    for (const old of d.list()) if (old instanceof File && old.name.startsWith(name.replace(/-v\d+\.glb$/, '-v')) && old.name !== name) old.delete();
    const tmp = new File(d, `${name}.part`);
    if (tmp.exists) tmp.delete();
    const got = await File.downloadFileAsync(p.model3D.url, tmp);
    got.move(file);
    return file.uri;
  } catch { return null; } // offline or full disk: the scene falls back to streaming from the URL
}

/**
 * Caches the models of `products` (placed pieces, plus the one selected so it is ready before the user taps Place) two at a time.
 * Returns productId -> local file URI for the ones that are ready.
 */
export function useModelUris(products: (Product | undefined)[]): Record<string, string> {
  const [uris, setUris] = useState<Record<string, string>>({});
  const tried = useRef(new Set<string>());
  const key = products.map((p) => (p?.model3D ? `${p.id}@${p.model3D.version}` : '')).filter(Boolean).sort().join('|');
  useEffect(() => {
    const todo = products.filter((p): p is Product => !!p?.model3D && !tried.current.has(`${p.id}@${p.model3D.version}`));
    let live = true;
    (async () => {
      const queue = [...new Map(todo.map((p) => [p.id, p])).values()];
      const worker = async () => {
        for (let p = queue.shift(); p; p = queue.shift()) {
          tried.current.add(`${p.id}@${p.model3D!.version}`);
          const uri = await cachedModelUri(p);
          if (uri && live) setUris((cur) => ({ ...cur, [p.id]: uri }));
        }
      };
      await Promise.all([worker(), worker()]);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return uris;
}
