"""Export imagegen masters into bounded runtime assets. Build-time only; requires Pillow."""
from pathlib import Path
from PIL import Image
import json, hashlib
base=Path(__file__).resolve().parent
repo=base.parents[2]
out=repo/'assets/art'
terrain=Image.open(base/'terrain-master.png').convert('RGB')
for col,name in enumerate(['plains','snow','desert']):
 # Atlas panels have independently painted edges; trim only the one-pixel separator.
 im=terrain.crop((round(col*terrain.width/3)+1,0,round((col+1)*terrain.width/3)-1,terrain.height))
 im.thumbnail((600,960),Image.Resampling.LANCZOS)
 im.save(out/f'battlefield-{name}.jpg',quality=78,optimize=True,progressive=True)
camps=Image.open(base/'camps-master.png').convert('RGBA')
# Source row gutters inspected on the generated 1254-square master.
rows=[0,300,593,911,1254]
cols=[0,313,627,941,1254]
assert camps.size==(1254,1254),camps.size
atlas=Image.new('RGBA',(768,768))
regions={}
for row in range(4):
 for col in range(4):
  cell=camps.crop((cols[col],rows[row],cols[col+1],rows[row+1]))
  bbox=cell.getchannel('A').point(lambda a:255 if a>=16 else 0).getbbox()
  cell=cell.crop(bbox);cell.thumbnail((180,180),Image.Resampling.LANCZOS)
  px=col*192+(192-cell.width)//2;py=row*192+186-cell.height
  atlas.paste(cell,(px,py))
  key=f'camp-{["barracks","archery","relay","fort"][col]}-{row+1}' if row<3 else 'unit-'+['infantry','archer','cavalry','guard'][col]
  regions[key]=[(px-2)/768,(py-2)/768,(cell.width+4)/768,(cell.height+4)/768]
atlas.save(out/'siege-camps.png',optimize=True)
# Retain a true alpha channel and enough padding for contain drawing at all card sizes.
props=Image.open(base/'strategies-master.png').convert('RGBA')
props=props.resize((640,320),Image.Resampling.LANCZOS)
props.save(out/'strategy-props.png',optimize=True)
(base/'camp-regions.json').write_text(json.dumps(regions,indent=2)+'\n')
manifest={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'dimensions':Image.open(p).size} for p in [*out.glob('battlefield-*.jpg'),out/'siege-camps.png',out/'strategy-props.png']}
(base/'export-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
