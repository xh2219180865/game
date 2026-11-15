"""Build-time terrain cropping/encoding only; no runtime image processing dependency."""
from pathlib import Path
from PIL import Image
import hashlib, json

base = Path(__file__).resolve().parent
root = base.parents[2]
source = Image.open(base / 'field-terrain-master.png').convert('RGB')
manifest = {}
for i, name in enumerate(['plains', 'snow', 'desert']):
    im = source.crop((round(i*source.width/3)+1, 0, round((i+1)*source.width/3)-1, source.height))
    im.thumbnail((540, 960), Image.Resampling.LANCZOS)
    path = root / f'assets/art/field-{name}.jpg'
    im.save(path, quality=78, optimize=True)
    manifest[path.name] = {'size': im.size, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
(base / 'field-terrain-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps(manifest, indent=2))
