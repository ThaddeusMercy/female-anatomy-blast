"""Inventory audit only. Does not certify shape, placement, anatomy, or teaching accuracy."""
from pathlib import Path
import collections, csv, gzip, hashlib, json, re

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / 'public/models'
OUT = ROOT / 'public'
OUT.mkdir(exist_ok=True)
a = json.loads((MODEL / 'atlas.json').read_text())
parts = a['parts']
by_name = collections.defaultdict(list)
for p in parts:
    by_name[p['name'].removesuffix(' (schematic)').casefold()].append(p)
rows = []
def add(region, bone, aliases=None, ids=None):
    matched = [p for p in parts if p['id'] in ids] if ids else [p for n in (aliases or [bone]) for p in by_name[n.casefold()]]
    matched = list({p['id']:p for p in matched}.values())
    rows.append(dict(region=region,bone=bone,status='represented' if matched else 'not found',
        mesh_ids='; '.join(p['id'] for p in matched),model_names='; '.join(p['name'] for p in matched),
        layer='; '.join(sorted({p['system'] for p in matched})),mesh_count=len(matched),
        provenance='; '.join(sorted({p.get('provenance','unknown') for p in matched})),
        note='Named mesh evidence only; shape and placement unvalidated.'))

for b in ['Frontal bone','Occipital bone','Sphenoid bone','Ethmoid']:
    add('Cranial bones', b)
for side in ['Left','Right']:
    for b in ['parietal bone','temporal bone']:
        add('Cranial bones',f'{side} {b}')
for b in ['Mandible','Vomer']:
    add('Facial bones',b)
for side in ['Left','Right']:
    for b in ['maxilla','zygomatic bone','nasal bone','lacrimal bone','palatine bone','inferior nasal concha']:
        add('Facial bones',f'{side} {b}')
    for b in ['malleus','incus','stapes']:
        add('Middle-ear bones',f'{side} {b}')
add('Hyoid','Hyoid bone')
ordinals=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth']
for segment,count in [('cervical',7),('thoracic',12),('lumbar',5)]:
    for i in range(count):
        name=f'{ordinals[i].capitalize()} {segment} vertebra'
        alias='Atlas' if (segment,i)==('cervical',0) else 'Axis' if (segment,i)==('cervical',1) else name
        add('Vertebral column',name,[alias])
add('Vertebral column','Sacrum',['Fused sacrum'])
add('Vertebral column','Coccyx')
for side in ['Left','Right']:
    for n in ordinals:
        add('Ribs and sternum',f'{side} {n} rib')
add('Ribs and sternum','Sternum',['Manubrium','Body of sternum','Xiphoid process'])
for side in ['Left','Right']:
    for b in ['clavicle','scapula']:
        add('Shoulder girdles',f'{side} {b}')
    for b in ['humerus','radius','ulna','scaphoid','lunate','triquetral','pisiform','trapezium','trapezoid','capitate','hamate']:
        add('Upper limbs and hands',f'{side} {b}')
    for n in ordinals[:5]:
        add('Upper limbs and hands',f'{side} {n} metacarpal bone')
    for digit in ['thumb','index finger','middle finger','ring finger','little finger']:
        for phalanx in (['proximal','distal'] if digit=='thumb' else ['proximal','middle','distal']):
            add('Upper limbs and hands',f'{phalanx.capitalize()} phalanx of {side.lower()} {digit}')
    hip_ids=[p['id'] for p in parts if p['id'].startswith(('VH_F_ilium_','VH_F_ischium_','VH_F_pubis_')) and p['id'].endswith('_'+side[0])]
    assert len(hip_ids)==6
    add('Hip bones',f'{side} hip bone',ids=hip_ids)
    for b in ['femur','patella','tibia','fibula','talus','calcaneus','cuboid bone','medial cuneiform bone','intermediate cuneiform bone','lateral cuneiform bone']:
        add('Lower limbs and feet',f'{side} {b}')
    add('Lower limbs and feet',f'Navicular bone of {side.lower()} foot')
    for n in ordinals[:5]:
        add('Lower limbs and feet',f'{side} {n} metatarsal bone')
    for digit in ['big toe','second toe','third toe','fourth toe','little toe']:
        for phalanx in (['proximal','distal'] if digit=='big toe' else ['proximal','middle','distal']):
            add('Lower limbs and feet',f'{phalanx.capitalize()} phalanx of {side.lower()} {digit}')
assert len(rows)==206
assert len({r['bone'] for r in rows})==206
with (OUT/'bone-checklist.csv').open('w') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)

# Exact geometry duplicate check, across every actual compressed model buffer.
buffers=[gzip.decompress((MODEL/c['gzip'].split('/')[-1]).read_bytes()) for c in a['chunks']]
duplicates=collections.defaultdict(list)
for p in parts:
    b=buffers[p['chunk']]
    h=hashlib.sha256()
    for field,count,size in [('positions',p['vertexCount']*3,4),('normals',p['vertexCount']*3,2),('indices',p['indexCount'],4)]:
        start=p[field];h.update(b[start:start+count*size])
    duplicates[h.hexdigest()].append({'id':p['id'],'name':p['name'],'system':p['system']})
exact_duplicates=[v for v in duplicates.values() if len(v)>1]

queries={
    'Clitoris including glans, body and crura':r'clitor',
    'Labia majora and minora':r'labia',
    'Mons pubis':r'mons pubis',
    'Vulval vestibule and vestibular bulbs':r'vulv|vestibul.*bulb|bulb.*vestibul|vestibule',
    'Greater vestibular (Bartholin) glands':r'bartholin|greater vestibular',
    'Paraurethral (Skene) glands':r'skene|paraurethral',
    'Female urethra':r'urethra(?!l orifice)',
    'Uterine arteries':r'uterine arter|arter.*uter',
    'Ovarian arteries and veins':r'ovarian (?:arter|vein)|(?:arter|vein).*ovar',
    'Pudendal nerves':r'pudendal nerve|nerve.*pudendal',
    'Internal pudendal arteries':r'pudendal arter|arter.*pudendal',
    'Bulbospongiosus muscle':r'bulbospongios',
    'Ischiocavernosus muscle':r'ischiocavernos',
    'Uterine endometrium':r'endometri',
    'Uterine myometrium':r'myometri',
    'Lymph nodes':r'lymph.*node|node.*lymph',
    'Lymphatic ducts and vessels':r'thoracic duct|lymphatic.*(?:duct|vessel)|(?:duct|vessel).*lymphatic',
    'Thyroid gland':r'\bthyroid\b(?!.*(?:cartilage|arter|vein|muscle|membrane|ligament|nerve))',
    'Parathyroid glands':r'parathyroid.*gland|gland.*parathyroid',
    'Skin':r'^skin$',
}
inventory=[]
for label,query in queries.items():
    matched=[p for p in parts if re.search(query,p['name'],re.I)]
    concepts=[{'id':c['id'],'name':c['name']} for c in a['concepts'] if re.search(query,c['name'],re.I)]
    inventory.append({'structure':label,'mesh_matches':[{'id':p['id'],'name':p['name']} for p in matched],'concept_matches':concepts})

regions={}
for region in dict.fromkeys(r['region'] for r in rows):
    r=[r for r in rows if r['region']==region]
    regions[region]={'expected':len(r),'represented':sum(x['status']=='represented' for x in r)}
known_muscles=['fibularis brevis','fibularis longus','fibularis tertius','tibialis anterior','tibialis posterior','subscapularis','levator scapulae']
muscles_in_skeletal=[{'id':p['id'],'name':p['name']} for p in parts if p['system']=='skeletal' and any(p['name'].lower().endswith(x) for x in known_muscles)]
wrong_bone_layers=[r for r in rows if r['status']=='represented' and r['layer']!='skeletal']
summary={'scope':'Inventory of source labels and mesh geometry, not clinical validation. Standard 206 excludes variable accessory sesamoids and teeth. Sternum is counted once; each adult hip bone once; duplicate hyoid once.',
    'source_manifest_sha256':hashlib.sha256((MODEL/'atlas.json').read_bytes()).hexdigest(),
    'total_meshes':len(parts),'skeletal_layer_meshes':sum(p['system']=='skeletal' for p in parts),
    'expected_bones':206,'represented_bones':sum(r['status']=='represented' for r in rows),
    'missing_bone_entries':[r['bone'] for r in rows if r['status']=='not found'],'regions':regions,
    'bones_in_other_layers':wrong_bone_layers,'muscles_in_skeletal':muscles_in_skeletal,
    'exact_duplicate_geometry_groups':exact_duplicates,
    'female_and_other_gap_queries':inventory,
    'female_reference_meshes':[{'id':p['id'],'name':p['name'],'system':p['system']} for p in parts if p.get('provenance')=='female-reference']}
(OUT/'inventory-audit.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ['total_meshes','skeletal_layer_meshes','expected_bones','represented_bones','missing_bone_entries','regions']},indent=2))
print('Additional queries:',[(x['structure'],len(x['mesh_matches']),len(x['concept_matches'])) for x in inventory])
print('Exact duplicate geometry groups:',len(exact_duplicates),'redundant entries:',sum(len(g)-1 for g in exact_duplicates))
print('Examples:',exact_duplicates[:6])

assert summary['represented_bones']==206
assert not summary['exact_duplicate_geometry_groups']
assert not summary['bones_in_other_layers']
assert not summary['muscles_in_skeletal']
assert sum(r['provenance']=='schematic' for r in rows)==6
