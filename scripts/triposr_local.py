"""Free, local photo -> 3D model using the open-weight TripoSR model (MIT licence). No API key, no credits, nothing leaves your computer.

Setup (once, on the machine that will run it; a GPU makes it seconds per model, a CPU takes a few minutes):
    git clone https://github.com/VAST-AI-Research/TripoSR tools/TripoSR
    pip install -r tools/TripoSR/requirements.txt rembg onnxruntime requests
Run:
    python scripts/triposr_local.py --next 5            # the 5 best products to model first (same order as image-to-3d.mjs)
    python scripts/triposr_local.py --ids sofa-a,bed-b
Then scale, ground and check them and put them in the catalogue (existing step, no network):
    node scripts/image-to-3d.mjs --normalise
Each model is a guess from ONE photo (back and sides are invented): review them in the admin dashboard before customers see them.
If a model faces the wrong way: node scripts/image-to-3d.mjs --normalise --yaw 90 (or 180, -90).
"""
import argparse, io, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'TripoSR'))

ORDER = {'sofa': 0, 'bed': 1, 'wardrobe': 2, 'dining-table': 3, 'tv-unit': 4, 'chair': 5, 'desk': 6, 'storage': 7}


def pick(catalogue, rooms, count, taken):
    in_rooms = {}
    for r in rooms:
        for pc in r['pieces']:
            in_rooms[pc['productId']] = in_rooms.get(pc['productId'], 0) + 1
    ok = [p for p in catalogue if not p.get('model3D') and not p.get('sizeReview') and not p.get('demo')
          and p.get('category') != 'Wall' and p.get('images') and p['id'] not in taken]
    ok.sort(key=lambda p: (0 if p['id'] in in_rooms else 1, -in_rooms.get(p['id'], 0), ORDER.get(p.get('role'), 9), p['id']))
    return ok[:count]


def photo_url(p):
    u = p['images'][0]
    return u + ('&' if '?' in u else '?') + 'width=1024' if 'cdn.shopify.com' in u else u


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--next', type=int, default=0)
    ap.add_argument('--ids', default='')
    ap.add_argument('--resolution', type=int, default=256)
    a = ap.parse_args()

    import numpy as np, requests, rembg, torch
    from PIL import Image
    from tsr.system import TSR
    from tsr.utils import remove_background, resize_foreground

    catalogue = json.load(open(os.path.join(ROOT, 'src/data/catalogue.json'), encoding='utf8'))
    rooms = json.load(open(os.path.join(ROOT, 'src/data/rooms.json'), encoding='utf8'))
    raw = os.path.join(ROOT, 'models', 'raw')
    os.makedirs(raw, exist_ok=True)
    have = {f[:-4] for f in os.listdir(raw) if f.endswith('.glb')}
    if a.ids:
        by_id = {p['id']: p for p in catalogue}
        todo = [by_id[i] for i in a.ids.split(',') if i in by_id]
    else:
        todo = pick(catalogue, rooms, a.next, have)
    todo = [p for p in todo if p['id'] not in have]  # never overwrite
    if not todo:
        print('Nothing to do (use --next N or --ids a,b).')
        return

    device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
    print(f'Loading TripoSR on {device} ...')
    model = TSR.from_pretrained('stabilityai/TripoSR', config_name='config.yaml', weight_name='model.ckpt')
    model.renderer.set_chunk_size(8192)
    model.to(device)
    session = rembg.new_session()

    for p in todo:
        try:
            img = Image.open(io.BytesIO(requests.get(photo_url(p), timeout=60).content)).convert('RGB')
            img = resize_foreground(remove_background(img, session), 0.85)
            arr = np.array(img).astype(np.float32) / 255.0
            arr = arr[:, :, :3] * arr[:, :, 3:4] + (1 - arr[:, :, 3:4]) * 0.5
            img = Image.fromarray((arr * 255.0).astype(np.uint8))
            with torch.no_grad():
                codes = model([img], device=device)
            mesh = model.extract_mesh(codes, True, resolution=a.resolution)[0]
            mesh.export(os.path.join(raw, p['id'] + '.glb'))
            print('made', p['id'])
        except Exception as e:  # keep going: one bad photo should not stop the batch
            print('FAILED', p['id'], e)
    print('Next: node scripts/image-to-3d.mjs --normalise')


if __name__ == '__main__':
    main()
