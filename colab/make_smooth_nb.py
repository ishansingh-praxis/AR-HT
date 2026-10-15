"""Builds smooth_models_batch.ipynb. The worker cell embeds smooth_worker.py."""
import json, os

here = os.path.dirname(os.path.abspath(__file__))
cells = []
def md(s): cells.append({"cell_type": "markdown", "metadata": {}, "source": s.strip("\n").splitlines(True)})
def code(s): cells.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": s.strip("\n").splitlines(True)})

md("""
# HomeTown AR: smooth 3D models from ALL product photos (crash-proof, low-RAM)
Runtime > Change runtime type > **T4 GPU**. Run cell 1, then **Runtime > Restart session**, then cells 2, 3, 4, 5.

Why it no longer crashes: the heavy work runs in a separate process (`worker.py`) that loads ONE 3D model, does a few products, and exits, which gives all RAM back.
The loop in cell 4 starts a new worker automatically, also after a crash. Finished models are saved to Google Drive, so nothing is lost.

Per product: SAM 2 + background-removal cut-out of every photo, best front/side/back views picked, a few candidates generated and the best chosen by a geometry score,
each result is compared with the catalogue photo (`photoFit` in report.json, below 0.55 = `review: true`), then floaters removed, holes closed, Taubin smoothing, decimated to ~40k triangles. Nothing is trained: Hunyuan3D is pretrained.
""")

code("""
# CELL 1: install, then Runtime > Restart session
!nvidia-smi -L
!rm -rf /content/Hunyuan3D-2
!git clone --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2 /content/Hunyuan3D-2
%cd /content/Hunyuan3D-2
!pip -q install -r requirements.txt
!pip -q install -e .
!pip -q install rembg onnxruntime-gpu scipy scikit-image opencv-python-headless pymeshlab psutil
!pip -q install --no-deps git+https://github.com/facebookresearch/sam2.git
!pip -q install hydra-core iopath
!pip -q install "transformers==4.46.3" "huggingface-hub<1.0"
!pip cache purge
""")

code("""
# CELL 2: Google Drive (results saved here) + upload products.json
from google.colab import drive, files
drive.mount('/content/drive')
import os, json
OUT = '/content/drive/MyDrive/hometown_models_smooth'
os.makedirs(OUT, exist_ok=True)
files.upload()                      # choose products.json
products = json.load(open('products.json'))
done = lambda: len([f for f in os.listdir(OUT) if f.endswith('.glb') or f.endswith('.skip')])
print(len(products), 'products |', done(), 'already done')
""")

code("%%writefile /content/worker.py\n" + open(os.path.join(here, "smooth_worker.py"), encoding="utf8").read())

code("""
# CELL 4: run. Re-run this cell whenever it stops; it resumes. A crash only restarts the worker, not your session.
import subprocess, sys, time
BATCH = 8                       # products per worker process (lower = even safer)
fails = 0
while True:
    before = done()
    r = subprocess.run([sys.executable, '/content/worker.py', 'products.json', OUT, str(BATCH)], capture_output=True, text=True)
    print(r.stdout[-1500:])
    if 'ALL_DONE' in r.stdout:
        print('ALL DONE'); break
    if r.returncode != 0 or done() == before:
        fails += 1; print('worker exited (code %s), restarting. %s' % (r.returncode, r.stderr[-300:]))
        if fails >= 5:
            print('5 failures in a row: stopping, check the error above'); break
        time.sleep(10)
    else:
        fails = 0
    print('progress:', done(), '/', len(products))
""")

code("""
# CELL 5: zip and download
import zipfile
with zipfile.ZipFile('models.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(OUT)):
        if f.endswith('.glb'): z.write(f'{OUT}/{f}', f)
print(os.path.getsize('models.zip') // 1_000_000, 'MB')
files.download('models.zip'); files.download(f'{OUT}/report.json')
""")

md("""
Items with `review: true` (low `photoFit`) usually mean a bad photo set. Re-run just those by deleting their `.glb` from Drive and re-running cell 4.
Then on your PC: `node scripts/colab-batch.mjs import models.zip --replace` and `node scripts/bundle-models.mjs`.
""")

nb = {"cells": cells, "metadata": {"accelerator": "GPU", "colab": {"provenance": []}, "kernelspec": {"display_name": "Python 3", "name": "python3"}, "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 5}
json.dump(nb, open(os.path.join(here, "smooth_models_batch.ipynb"), "w", encoding="utf8"), indent=1)
print("written")
