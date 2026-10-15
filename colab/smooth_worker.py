# Does up to BATCH unfinished products, then exits (frees all RAM).
import os, sys, io, gc, json, time, ctypes
os.environ['OMP_NUM_THREADS'] = '2'; os.environ['MKL_NUM_THREADS'] = '2'; os.environ['TOKENIZERS_PARALLELISM'] = 'false'
import numpy as np, requests, cv2, torch, trimesh, psutil
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, '/content/Hunyuan3D-2')

PRODUCTS, OUT, BATCH = sys.argv[1], sys.argv[2], int(sys.argv[3])
SEEDS = [12355, 7]            # candidates per product (1 = fastest)
OCTREE = 320                  # lower = less RAM. 384/512 = smoother but heavier
RAM_STOP = 85                 # exit cleanly above this % RAM
PAUSE = 2
USE_SAM2 = True               # SAM 2 refines the rembg cut-out edge (falls back to rembg if not installed)
MIN_FIT = 0.55                # photo-match below this is flagged in report.json
products = json.load(open(PRODUCTS))
finished = lambda p: os.path.exists(f"{OUT}/{p['id']}.glb") or os.path.exists(f"{OUT}/{p['id']}.skip")
todo = [p for p in products if not finished(p)][:BATCH]
if not todo:
    print('ALL_DONE'); sys.exit(0)

def ram(): return psutil.virtual_memory().percent
def cleanup():
    gc.collect(); torch.cuda.empty_cache()
    try: ctypes.CDLL('libc.so.6').malloc_trim(0)
    except Exception: pass

from hy3dgen.rembg import BackgroundRemover
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
from transformers import pipeline as hf_pipeline
# ONE 3D model only: the multi-view model also accepts a single front photo
multi = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2mv', subfolder='hunyuan3d-dit-v2-mv', variant='fp16')
rembg_ = BackgroundRemover()
clip = hf_pipeline('zero-shot-image-classification', model='openai/clip-vit-base-patch32', device=0, torch_dtype=torch.float16)
sam = None
if USE_SAM2:
    try:
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        sam = SAM2ImagePredictor.from_pretrained('facebook/sam2.1-hiera-small')
        print('SAM 2 loaded', flush=True)
    except Exception as e:
        print('SAM 2 unavailable, using rembg only:', str(e)[:120], flush=True)
cleanup(); print('loaded, RAM %.0f%%' % ram(), flush=True)

LABELS = {
    'front': 'a product photo of furniture seen straight from the front on a plain background',
    'side': 'a product photo of furniture seen straight from the side on a plain background',
    'back': 'a product photo of furniture seen from the back on a plain background',
    'angled': 'a product photo of furniture seen from a three-quarter angle on a plain background',
    'room': 'furniture in a decorated room interior, a lifestyle photo',
    'detail': 'a close-up detail of furniture material or hardware',
}
INV = {v: k for k, v in LABELS.items()}

def sam_refine(rgb, m):
    """SAM 2 prompted with the rembg box: crisper legs/arms. Only accepted if it agrees with rembg (IoU > 0.8)."""
    if sam is None or not m.any(): return m
    try:
        ys, xs = np.where(m)
        box = np.array([xs.min(), ys.min(), xs.max(), ys.max()], dtype=np.float32)
        with torch.inference_mode(), torch.autocast('cuda', dtype=torch.bfloat16):
            sam.set_image(np.array(rgb.convert('RGB')))
            masks, scores, _ = sam.predict(box=box, multimask_output=False)
        r = masks[0].astype(bool)
        lab, n = ndi.label(r)
        if n > 1:
            sizes = ndi.sum(r, lab, range(1, n + 1)); r = lab == (1 + int(np.argmax(sizes)))
        r = ndi.binary_fill_holes(r)
        iou = (r & m).sum() / max((r | m).sum(), 1)
        return r if iou > 0.8 else m
    except Exception:
        return m


def clean_cutout(rgb, size=1024, pad=0.08):
    """Remove background, keep the largest object, fill holes, soften the edge, centre and pad on a square canvas."""
    cut = rembg_(rgb.convert('RGB')).convert('RGBA')
    a = np.array(cut.split()[-1]).astype(np.float32) / 255
    m = a > 0.5
    lab, n = ndi.label(m)
    if n > 1:
        sizes = ndi.sum(m, lab, range(1, n + 1)); m = lab == (1 + int(np.argmax(sizes)))
    m = ndi.binary_fill_holes(m)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool)
    m = sam_refine(rgb, m)
    soft = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)
    ys, xs = np.where(m)
    if len(ys) == 0: return None, 0.0
    arr = np.array(cut); arr[..., 3] = (soft * 255).astype(np.uint8); arr[~m, :3] = 255
    crop = Image.fromarray(arr[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    s = int(max(crop.size) * (1 + 2 * pad))
    canvas = Image.new('RGBA', (s, s), (255, 255, 255, 0))
    canvas.paste(crop, ((s - crop.width) // 2, (s - crop.height) // 2))
    canvas = canvas.resize((size, size), Image.LANCZOS)
    touch = np.concatenate([m[0], m[-1], m[:, 0], m[:, -1]]).mean(); cover = m.mean()
    return canvas, (0.0 if (cover < 0.10 or cover > 0.93) else float(1 - touch))

def sharpness(rgb):
    g = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2GRAY)
    return float(min(cv2.Laplacian(g, cv2.CV_64F).var() / 300, 1.0))

def analyse(photos):
    items = []
    for u in photos:
        try:
            im = Image.open(io.BytesIO(requests.get(u, timeout=60).content)).convert('RGB'); im.thumbnail((1200, 1200))
        except Exception:
            continue
        cut, q = clean_cutout(im)
        if cut is None: continue
        r = clip(im, candidate_labels=list(LABELS.values()))
        cls = {INV[x['label']]: x['score'] for x in r}
        items.append({'url': u, 'cut': cut, 'cls': cls, 'top': max(cls, key=cls.get), 'quality': q * (0.5 + 0.5 * sharpness(im))})
    return items

def pick_views(items):
    good = [i for i in items if i['quality'] > 0.4 and i['top'] not in ('room', 'detail')]
    def best(k, pool):
        pool = [i for i in pool if i['top'] == k]
        return max(pool, key=lambda i: i['cls'][k] * i['quality']) if pool else None
    front = best('front', good) or best('angled', good)
    if front is None and items: front = max(items, key=lambda i: i['quality'])
    rest = [i for i in good if i is not front]
    return front, best('side', rest), best('back', rest)

import pymeshlab
def postprocess(mesh, target_tris=40000):
    ms = pymeshlab.MeshSet()
    ms.add_mesh(pymeshlab.Mesh(np.asarray(mesh.vertices, dtype=np.float64), np.asarray(mesh.faces, dtype=np.int32)))
    ms.meshing_remove_duplicate_vertices(); ms.meshing_remove_unreferenced_vertices()
    ms.meshing_remove_connected_component_by_diameter(mincomponentdiag=pymeshlab.PercentageValue(8))
    ms.meshing_repair_non_manifold_edges(); ms.meshing_close_holes(maxholesize=60)
    ms.apply_coord_taubin_smoothing(lambda_=0.5, mu=-0.53, stepsmoothnum=12)
    if ms.current_mesh().face_number() > target_tris:
        ms.meshing_decimation_quadric_edge_collapse(targetfacenum=target_tris, preserveboundary=True, preservenormal=True, qualitythr=0.6)
    ms.apply_coord_taubin_smoothing(lambda_=0.5, mu=-0.53, stepsmoothnum=4)
    m = ms.current_mesh()
    out = trimesh.Trimesh(m.vertex_matrix(), m.face_matrix(), process=True); out.fix_normals()
    ms.clear(); return out

def score(mesh, d):
    """Higher is better: one solid piece, watertight, proportions close to the listed W x D x H."""
    parts = mesh.split(only_watertight=False)
    solid = max((len(p.faces) for p in parts), default=1) / max(len(mesh.faces), 1)
    ext = np.sort(mesh.extents); want = np.sort(np.array([d['w'], d['d'], d['h']], dtype=float))
    err = float(np.abs(np.log((ext / ext.max() + 1e-6) / (want / want.max()))).mean())
    return solid + (0.5 if mesh.is_watertight else 0) - 1.5 * err

def silhouette(mesh, axes, flip, size=256):
    """Orthographic silhouette of the mesh along one axis pair, as a size x size mask."""
    v = mesh.vertices[:, axes].astype(np.float64) * np.array(flip)
    lo, hi = v.min(0), v.max(0); sc = (size - 6) / max((hi - lo).max(), 1e-9)
    pts = ((v - lo) * sc + 3 + (size - 6 - (hi - lo) * sc) / 2).astype(np.int32)
    img = np.zeros((size, size), np.uint8)
    tri = pts[mesh.faces]
    for t in tri[:: max(1, len(tri) // 30000)]: cv2.fillConvexPoly(img, t, 1)
    return img.astype(bool)

def _norm_mask(m, size=256):
    """Crop to the object, scale so the longest side fits (aspect kept), centre on a size x size canvas."""
    ys, xs = np.where(m)
    if len(ys) == 0: return None
    c = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.uint8) * 255
    k = (size - 6) / max(c.shape)
    c = cv2.resize(c, (max(1, round(c.shape[1] * k)), max(1, round(c.shape[0] * k)))) > 127
    out = np.zeros((size, size), bool)
    y0, x0 = (size - c.shape[0]) // 2, (size - c.shape[1]) // 2
    out[y0:y0 + c.shape[0], x0:x0 + c.shape[1]] = c
    return out

def photo_fit(mesh, cut):
    """0..1: best overlap (IoU, aspect kept) between the photo cut-out and any axis-aligned silhouette of the mesh, so it does not matter which way the model faces."""
    ref = _norm_mask(np.array(cut.split()[-1].resize((256, 256))) > 127)
    if ref is None: return 0.0
    best = 0.0
    for ax in ([0, 1], [0, 2], [2, 1]):
        for fl in ([1, 1], [-1, 1], [1, -1], [-1, -1]):
            mm = _norm_mask(silhouette(mesh, ax, fl))
            if mm is not None: best = max(best, (mm & ref).sum() / max((mm | ref).sum(), 1))
    return float(best)

def tint(mesh, hexcol):
    c = tuple(int(hexcol.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=np.tile(np.array(c, dtype=np.uint8), (len(mesh.vertices), 1)))
    return mesh

@torch.inference_mode()
def generate(front, side, back, seed, octree):
    v = {'front': front['cut']}
    if side is not None: v['left'] = side['cut']
    if back is not None: v['back'] = back['cut']
    kw = dict(num_inference_steps=50, guidance_scale=7.5, octree_resolution=octree, num_chunks=10000, generator=torch.manual_seed(seed))
    return multi(image=v, **kw)[0], ('multi-view' if len(v) > 1 else 'single-view')

rep_path = f'{OUT}/report.json'
report = json.load(open(rep_path)) if os.path.exists(rep_path) else {}
for p in todo:
    if ram() > RAM_STOP:
        print('RAM %.0f%%, exiting to free memory' % ram(), flush=True); break
    t0 = time.time()
    try:
        items = analyse(p.get('photos') or [p['photo']])
        if not items:
            print('no usable photos', p['id'], flush=True); open(f"{OUT}/{p['id']}.skip", 'w').write('x'); continue
        front, side, back = pick_views(items)
        best, best_s, mode = None, -9, ''
        for sd in SEEDS:
            try: raw, mode = generate(front, side, back, sd, OCTREE)
            except torch.cuda.OutOfMemoryError: cleanup(); raw, mode = generate(front, side, back, sd, 256)
            m = postprocess(raw); del raw
            s = score(m, p['dimensionsCm']) + 1.5 * photo_fit(m, front['cut'])
            if s > best_s: best, best_s = m, s
            cleanup(); time.sleep(1)
        best = tint(best, p.get('dominantHex', '#b8a58f'))
        fit = photo_fit(best, front['cut'])
        best.export(f"{OUT}/{p['id']}.glb")
        report[p['id']] = {'mode': mode, 'score': round(best_s, 3), 'tris': int(len(best.faces)), 'watertight': bool(best.is_watertight), 'photoFit': round(fit, 3), 'review': bool(fit < MIN_FIT), 'views': [i['top'] for i in items]}
        json.dump(report, open(rep_path, 'w'), indent=1)
        print(f"{p['id']} {mode} score={best_s:.2f} tris={len(best.faces)} RAM {ram():.0f}% {int(time.time() - t0)}s", flush=True)
    except Exception as e:
        print('FAILED', p['id'], str(e)[:160], flush=True)
    cleanup(); time.sleep(PAUSE)
