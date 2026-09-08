"""Offline mesh contact sheet. Requires numpy and Pillow, no browser automation."""
import sys,json,gzip,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
root=Path(sys.argv[1]); output=Path(sys.argv[2]); title=sys.argv[3] if len(sys.argv)>3 else 'MODEL REVIEW'
a=json.loads((root/'atlas.json').read_text());buffers=[gzip.decompress((root/Path(c['gzip']).name).read_bytes()) for c in a['chunks']]
colors={'skeletal':(226,218,197),'muscular':(187,118,108),'breast':(194,144,148),'connective':(175,195,189),'sensory':(169,191,196),'arterial':(184,91,80),'venous':(114,154,183),'reproductive':(185,139,161),'urinary':(188,146,133),'endocrine':(196,153,149),'lymphatic':(135,159,124),'nervous':(212,192,133),'digestive':(215,188,146),'respiratory':(181,147,152),'cardiac':(169,86,84)}
canvas=Image.new('RGB',(1650,1220),(243,244,244));draw=ImageDraw.Draw(canvas)
for panel,angle in enumerate([0,math.pi/2,math.pi]):
 shapes=[];R=np.array([[math.cos(angle),0,-math.sin(angle)],[0,1,0],[math.sin(angle),0,math.cos(angle)]],dtype=np.float32)
 for p in a['parts']:
  if p['system'] not in colors:continue
  b=buffers[p['chunk']];pos=np.frombuffer(b,dtype='<f4',count=p['vertexCount']*3,offset=p['positions']).reshape(-1,3)@R.T;normal=np.frombuffer(b,dtype='<i2',count=p['vertexCount']*3,offset=p['normals']).reshape(-1,3)/32767@R.T;ind=np.frombuffer(b,dtype='<u4',count=p['indexCount'],offset=p['indices']).reshape(-1,3)
  tris=pos[ind];ns=normal[ind].mean(axis=1);keep=ns[:,2]>-.12;tris=tris[keep];ns=ns[keep];xy=tris[:,:,:2].copy();xy[:,:,0]=xy[:,:,0]*650+275+panel*550;xy[:,:,1]=1150-xy[:,:,1]*650
  light=np.clip(.78+.24*(ns@np.array([-.3,.45,.85])),.55,1.0);rgb=np.clip(light[:,None]*colors[p['system']],0,255).astype('uint8');z=tris[:,:,2].mean(axis=1)
  shapes.extend(zip(z,xy.reshape(-1,6).tolist(),rgb.tolist()))
 shapes.sort(key=lambda x:x[0])
 for _,points,color in shapes:draw.polygon(points,fill=tuple(color))
 print('Rendered',title,panel,len(shapes),flush=True)
 draw.text((panel*550+25,25),title+' / '+['FRONT','SIDE','BACK'][panel],fill=(75,62,71))
 draw.line((panel*550+20,1165,panel*550+530,1165),fill=(222,221,221))
draw.text((25,1190),'Actual atlas geometry / fixed orthographic views / educational illustration, not clinical validation',fill=(75,62,71))
output.parent.mkdir(parents=True,exist_ok=True);canvas.save(output)
