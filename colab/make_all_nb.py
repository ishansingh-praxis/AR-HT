"""Builds all_models_batch.ipynb. The worker cell embeds models_worker.py."""
import json, os

here = os.path.dirname(os.path.abspath(__file__))
cells = []
def md(s): cells.append({"cell_type": "markdown", "metadata": {}, "source": s.strip("\n").splitlines(True)})
def code(s): cells.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": s.strip("\n").splitlines(True)})

md("""
# HomeTown AR: ALL models in one notebook (furniture 3D + room understanding + redesign)
Runtime > Change runtime type > **T4 GPU**. Then follow the steps **in order**. Every step says what it makes.

| Step | What it does | Output |
|---|---|---|
| 1 | Installs everything (run once, then **Runtime > Restart session**) | - |
| 2 | Google Drive, `products.json`, Hugging Face token | - |
| 3 | Writes the worker script | - |
| 4 | Runs the 3D models, one after another, on the same clean SAM 2 cut-outs | `<id>.glb` in a folder per model |
| 5 | Zips each model separately | `models_hunyuan_mv.zip`, `models_hunyuan_mini.zip`, `models_triposr.zip`, `models_sf3d.zip` |
| 6 | Room photos: Depth Anything V2 + Metric3D depth | `<room>__depth_*.png` |
| 7 | Room photos: Grounding DINO + SAM 2 (sofa, bed, wall, window, door ...) | `<room>__objects.json` + overlay |
| 8 | Room redesign concepts: SDXL + depth ControlNet, CLIP style check | `<room>__redesign_*.png` |
| 9 | Zips the room outputs | `room_outputs.zip` |

**The 3D models** (all use the same SAM 2 + background-removed cut-outs, so they are comparable):
`hunyuan_mv` (multi-photo, best quality, slowest) · `hunyuan_mini` (one photo, faster) · `triposr` (one photo, very fast) · `sf3d` (Stable Fast 3D, one photo, keeps its texture, needs a free Hugging Face licence).
Different models give different results; compare them and keep the best per product. Output files are named `<product-id>__<model>.glb`.

Everything is saved to Google Drive as it goes, so a stopped session just resumes: run steps 2, 3, 4 again, finished products are skipped.
Each 3D model runs in its own short-lived process, so one model that fails to install or crashes does not stop the others.
""")

md("## Step 1: install (then Runtime > Restart session)")
code("""
!nvidia-smi -L
# Hunyuan3D-2 (hunyuan_mv, hunyuan_mini)
!rm -rf /content/Hunyuan3D-2
!git clone --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2 /content/Hunyuan3D-2
%cd /content/Hunyuan3D-2
!pip -q install -r requirements.txt
!pip -q install -e .
# shared tools: background removal, mesh clean-up, SAM 2 (segmentation)
!pip -q install rembg onnxruntime-gpu scipy scikit-image opencv-python-headless pymeshlab psutil
!pip -q install --no-deps git+https://github.com/facebookresearch/sam2.git
!pip -q install hydra-core iopath
# TripoSR (triposr)
%cd /content
!rm -rf /content/TripoSR
!git clone --depth 1 https://github.com/VAST-AI-Research/TripoSR /content/TripoSR
!pip -q install omegaconf einops xatlas moderngl imageio[ffmpeg]
!pip -q install git+https://github.com/tatsy/torchmcubes.git || echo "TRIPOSR: torchmcubes failed, triposr will be skipped"
# Stable Fast 3D (sf3d). Its own requirements pin old versions, so install the pieces it needs without the pins
!rm -rf /content/stable-fast-3d
!git clone --depth 1 https://github.com/Stability-AI/stable-fast-3d /content/stable-fast-3d
!pip -q install jaxtyping open_clip_torch gpytoolbox pynanoinstantmeshes safetensors
!pip -q install /content/stable-fast-3d/texture_baker /content/stable-fast-3d/uv_unwrapper || echo "SF3D: native extensions failed, sf3d will be skipped"
# room understanding + redesign (steps 6 to 8)
!pip -q install diffusers accelerate
# Colab's newest transformers renames layers the Hunyuan3D-2 weights expect: use the version they were made for
!pip -q install "transformers==4.46.3" "huggingface-hub<1.0"
!pip cache purge
# NOW: Runtime > Restart session, then run step 2 (not this one again)
""")

md("""
## Step 2: Drive, products.json, Hugging Face token
- `products.json` comes from your PC: `node scripts/colab-batch.mjs export --all --redo` (or `--next 20` for a quick test) writes `models/colab/products.json`.
- The Hugging Face token is only needed for **sf3d** (Stable Fast 3D is gated): on huggingface.co open `stabilityai/stable-fast-3d`, accept the licence, create a read token at Settings > Access Tokens. Leave it blank to skip sf3d.
""")
code("""
from google.colab import drive, files
drive.mount('/content/drive')
import os, json, getpass
OUT = '/content/drive/MyDrive/hometown_models_all'
os.makedirs(OUT, exist_ok=True)
files.upload()                      # choose products.json
products = json.load(open('products.json'))
HF_TOKEN = getpass.getpass('Hugging Face token for sf3d (blank = skip): ').strip()
if HF_TOKEN:
    from huggingface_hub import login; login(HF_TOKEN)
def done(model): return len([f for f in os.listdir(f'{OUT}/{model}') if f.endswith('.glb') or f.endswith('.skip')]) if os.path.isdir(f'{OUT}/{model}') else 0
print(len(products), 'products |', {m: done(m) for m in ['hunyuan_mv', 'hunyuan_mini', 'triposr', 'sf3d']}, 'already done')
""")

md("## Step 3: write the worker script (nothing to change)")
code("%%writefile /content/worker.py\n" + open(os.path.join(here, "models_worker.py"), encoding="utf8").read())

md("""
## Step 4: run the 3D models
Edit `MODELS` to run only some (for example `['triposr']` for a fast first look). Re-run this cell whenever it stops; it resumes.
Order is fastest first, so you get results early. A model that fails 5 times in a row is skipped and the next one starts.
""")
code("""
import subprocess, sys, time
MODELS = ['triposr', 'hunyuan_mini', 'hunyuan_mv', 'sf3d']
if not HF_TOKEN and 'sf3d' in MODELS: MODELS.remove('sf3d'); print('sf3d skipped (no Hugging Face token)')
BATCH = 8                       # products per worker process (lower = even safer)
for MODEL in MODELS:
    print('=== ', MODEL, ' ===')
    fails = 0
    while True:
        before = done(MODEL)
        r = subprocess.run([sys.executable, '/content/worker.py', 'products.json', OUT, str(BATCH), MODEL], capture_output=True, text=True)
        print(r.stdout[-1200:])
        if 'ALL_DONE' in r.stdout:
            print(MODEL, 'finished'); break
        if r.returncode != 0 or done(MODEL) == before:
            fails += 1; print('worker exited (code %s), restarting. %s' % (r.returncode, r.stderr[-400:]))
            if fails >= 5:
                print(MODEL, ': 5 failures in a row, skipping this model. Last error above.'); break
            time.sleep(10)
        else:
            fails = 0
        print(MODEL, 'progress:', done(MODEL), '/', len(products))
""")

md("""
## Step 5: zip each model separately
Makes `models_<model>.zip` (files named `<id>__<model>.glb`) and `report_<model>.json` in your Drive folder `hometown_models_all/zips`, and downloads them.
If the browser blocks multiple downloads, click Allow, or take them from Drive.
""")
code("""
import zipfile
os.makedirs(f'{OUT}/zips', exist_ok=True)
for m in ['hunyuan_mv', 'hunyuan_mini', 'triposr', 'sf3d']:
    d = f'{OUT}/{m}'
    glbs = sorted(f for f in os.listdir(d) if f.endswith('.glb')) if os.path.isdir(d) else []
    if not glbs: print(m, ': nothing to zip'); continue
    z = f'{OUT}/zips/models_{m}.zip'
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in glbs: zf.write(f'{d}/{f}', f.replace('.glb', f'__{m}.glb'))
    print(m, len(glbs), 'models,', os.path.getsize(z) // 1_000_000, 'MB')
    files.download(z)
    if os.path.exists(f'{d}/report.json'): files.download(f'{d}/report.json')
""")

md("""
## Step 6: room photos, depth (Depth Anything V2 + Metric3D)
Upload one or more photos of a room. Depth from ONE ordinary photo is relative, not exact: use it for rough structure, and use a real room scan or measured dimensions for true sizes.
""")
code("""
from PIL import Image
import numpy as np, torch, gc
ROOM_OUT = f'{OUT}/rooms'; os.makedirs(ROOM_OUT, exist_ok=True)
up = files.upload()                  # choose room photos (jpg / png)
rooms = {os.path.splitext(n)[0]: n for n in up}
from transformers import pipeline
depth_pipe = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Base-hf', device=0)
for name, fn in rooms.items():
    im = Image.open(fn).convert('RGB')
    d = depth_pipe(im)['depth']; d.save(f'{ROOM_OUT}/{name}__depth_anything_v2.png')
    print(name, 'depth anything v2 ok')
del depth_pipe; gc.collect(); torch.cuda.empty_cache()

# Metric3D (metric depth, approximate: the focal length below is a guess for a phone camera)
try:
    m3d = torch.hub.load('yvanyin/metric3d', 'metric3d_vit_small', pretrain=True).cuda().eval()
    FX = 1000.0
    for name, fn in rooms.items():
        rgb = np.array(Image.open(fn).convert('RGB')); h, w = rgb.shape[:2]
        s = min(616 / h, 1064 / w); rgb = np.array(Image.fromarray(rgb).resize((int(w * s), int(h * s))))
        ph, pw = 616 - rgb.shape[0], 1064 - rgb.shape[1]
        pad = np.pad(rgb, ((ph // 2, ph - ph // 2), (pw // 2, pw - pw // 2), (0, 0)), constant_values=114)
        mean = torch.tensor([123.675, 116.28, 103.53]).view(3, 1, 1).cuda(); std = torch.tensor([58.395, 57.12, 57.375]).view(3, 1, 1).cuda()
        x = ((torch.from_numpy(pad.transpose(2, 0, 1)).float().cuda() - mean) / std)[None]
        with torch.no_grad(): pred, _, _ = m3d.inference({'input': x})
        pred = pred.squeeze()[ph // 2: 616 - (ph - ph // 2), pw // 2: 1064 - (pw - pw // 2)] * (FX * s / 1000.0)
        arr = pred.cpu().numpy(); np.save(f'{ROOM_OUT}/{name}__metric3d_metres.npy', arr)
        Image.fromarray((255 * (arr - arr.min()) / (np.ptp(arr) + 1e-6)).astype(np.uint8)).save(f'{ROOM_OUT}/{name}__depth_metric3d.png')
        print(name, 'metric3d ok, median depth %.1f m' % float(np.median(arr)))
    del m3d; gc.collect(); torch.cuda.empty_cache()
except Exception as e:
    print('Metric3D skipped:', str(e)[:200])
""")

md("## Step 7: what is in the room (Grounding DINO + SAM 2)")
code("""
import json
from sam2.sam2_image_predictor import SAM2ImagePredictor
LABELS = ['sofa', 'bed', 'chair', 'table', 'wardrobe', 'wall', 'window', 'door', 'rug', 'lamp', 'tv']
det = pipeline('zero-shot-object-detection', model='IDEA-Research/grounding-dino-tiny', device=0)
sam = SAM2ImagePredictor.from_pretrained('facebook/sam2.1-hiera-small')
rng = np.random.default_rng(0)
for name, fn in rooms.items():
    im = Image.open(fn).convert('RGB'); arr = np.array(im)
    res = [r for r in det(im, candidate_labels=LABELS, threshold=0.3)]
    overlay = arr.astype(np.float32).copy(); found = []
    with torch.inference_mode(), torch.autocast('cuda', dtype=torch.bfloat16):
        sam.set_image(arr)
        for r in res:
            b = r['box']; box = np.array([b['xmin'], b['ymin'], b['xmax'], b['ymax']], dtype=np.float32)
            mask = sam.predict(box=box, multimask_output=False)[0][0].astype(bool)
            overlay[mask] = 0.55 * overlay[mask] + 0.45 * rng.integers(40, 255, 3)
            found.append({'label': r['label'], 'score': round(float(r['score']), 3), 'box': [round(float(v)) for v in box], 'area_fraction': round(float(mask.mean()), 4)})
    Image.fromarray(overlay.astype(np.uint8)).save(f'{ROOM_OUT}/{name}__objects.png')
    json.dump(found, open(f'{ROOM_OUT}/{name}__objects.json', 'w'), indent=1)
    print(name, [f['label'] for f in found])
del det, sam; gc.collect(); torch.cuda.empty_cache()
""")

md("""
## Step 8: redesign concepts (SDXL + depth ControlNet, checked with CLIP)
Edit `STYLES`. These are **design pictures only**, not an accurate 3D room: keep them separate from the true-to-size AR scene.
(FLUX and an LLM design assistant are not run here: FLUX does not fit a free T4, and the assistant belongs in the app, not in Colab.)
""")
code("""
from diffusers import ControlNetModel, StableDiffusionXLControlNetPipeline, AutoencoderKL
STYLES = ['minimalist Scandinavian living room, light oak furniture, warm neutral palette',
          'warm modern Indian home, walnut wood furniture, rust and gold accents']
controlnet = ControlNetModel.from_pretrained('diffusers/controlnet-depth-sdxl-1.0', torch_dtype=torch.float16)
vae = AutoencoderKL.from_pretrained('madebyollin/sdxl-vae-fp16-fix', torch_dtype=torch.float16)
pipe = StableDiffusionXLControlNetPipeline.from_pretrained('stabilityai/stable-diffusion-xl-base-1.0', controlnet=controlnet, vae=vae, torch_dtype=torch.float16)
pipe.enable_model_cpu_offload()
made = []
for name in rooms:
    dimg = Image.open(f'{ROOM_OUT}/{name}__depth_anything_v2.png').convert('RGB').resize((1024, 768))
    for i, style in enumerate(STYLES):
        img = pipe(prompt=style + ', interior photo, realistic, high quality', negative_prompt='blurry, distorted, text, watermark',
                   image=dimg, controlnet_conditioning_scale=0.7, num_inference_steps=30, generator=torch.manual_seed(1)).images[0]
        path = f'{ROOM_OUT}/{name}__redesign_{i + 1}.png'; img.save(path); made.append((path, style)); print(path)
del pipe, controlnet; gc.collect(); torch.cuda.empty_cache()
# CLIP: does each picture match the style it was asked for? (higher = better)
from transformers import CLIPModel, CLIPProcessor
cm = CLIPModel.from_pretrained('openai/clip-vit-base-patch32').cuda(); cp = CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32')
for path, style in made:
    inp = cp(text=STYLES, images=Image.open(path), return_tensors='pt', padding=True).to('cuda')
    p = cm(**inp).logits_per_image.softmax(-1)[0].tolist()
    print(os.path.basename(path), 'style match %.0f%%' % (100 * p[STYLES.index(style)]))
""")

md("## Step 9: zip the room outputs")
code("""
import zipfile
z = f'{OUT}/zips/room_outputs.zip'; os.makedirs(f'{OUT}/zips', exist_ok=True)
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in sorted(os.listdir(ROOM_OUT)): zf.write(f'{ROOM_OUT}/{f}', f)
print(os.path.getsize(z) // 1_000_000, 'MB')
files.download(z)
""")

md("""
## Back on your PC
Each model zip is imported on its own. For a model you want to use (replace `triposr` with the model name):
```
node scripts/colab-batch.mjs import models_triposr.zip --model triposr --replace
node scripts/image-to-3d.mjs --normalise
node scripts/bundle-models.mjs
```
`--model` strips the `__triposr` ending so the file becomes `<product-id>.glb`. Importing a second model with `--replace` keeps the old file as `<id>.old.glb`.
In each `report_<model>.json`, `photoFit` below 0.55 / `review: true` means the shape does not match the catalogue photo: check it before publishing.
`room_outputs.zip` is for inspection and design work; it does not go into the app.
""")

nb = {"cells": cells, "metadata": {"accelerator": "GPU", "colab": {"provenance": []}, "kernelspec": {"display_name": "Python 3", "name": "python3"}, "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 5}
json.dump(nb, open(os.path.join(here, "all_models_batch.ipynb"), "w", encoding="utf8"), indent=1)
print("written")
