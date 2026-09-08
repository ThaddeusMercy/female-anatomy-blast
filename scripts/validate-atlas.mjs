import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
const dir=new URL('../public/models/',import.meta.url),a=JSON.parse(fs.readFileSync(new URL('atlas.json',dir)));
assert.equal(a.sex,'female');assert.equal(a.modelType,'composite-illustration');assert.ok(a.parts.length>2275);assert.equal(a.adaptation.femaleReferenceParts,a.parts.filter(p=>p.provenance==='female-reference').length);
const files=a.chunks.map(c=>{const gzip=fs.readFileSync(new URL(c.gzip.split('/').pop(),dir));assert.equal(gzip.length,c.gzipBytes);const b=gunzipSync(gzip);assert.equal(b.length,c.bytes);return b;});
const ids=new Set(a.parts.map(p=>p.id));assert.equal(ids.size,a.parts.length);assert.equal(new Set(a.concepts.map(c=>c.id)).size,a.concepts.length);
let triangles=0;const hashes=new Map();
for(const p of a.parts){
 assert.ok(p.name.trim());assert.ok(['adapted','female-reference','schematic'].includes(p.provenance));assert.ok(!/penis|testicul|testis|deferen|seminal|prostat|epidid|spermatic|scrot/i.test(p.name),p.name);
 const b=files[p.chunk];const hash=createHash('sha256');for(const [field,count,size]of [['positions',p.vertexCount*3,4],['normals',p.vertexCount*3,2],['indices',p.indexCount,4]])hash.update(b.subarray(p[field],p[field]+count*size));const key=hash.digest('hex');assert.ok(!hashes.has(key),`Duplicate geometry: ${p.id} and ${hashes.get(key)}`);hashes.set(key,p.id);for(const [offset,count,size]of [[p.positions,p.vertexCount*3,4],[p.normals,p.vertexCount*3,2],[p.indices,p.indexCount,4]])assert.ok(offset>=0&&offset+count*size<=b.length);
 const positions=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),normal=new Int16Array(b.buffer,b.byteOffset+p.normals,p.vertexCount*3),indices=new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount);
 assert.equal(indices.length%3,0);assert.ok(indices.length>=3);for(const i of indices)assert.ok(i<p.vertexCount);triangles+=indices.length/3;
 for(let i=0;i<positions.length;i++){assert.ok(Number.isFinite(positions[i]));assert.ok(positions[i]>=p.bounds[0][i%3]-1e-6&&positions[i]<=p.bounds[1][i%3]+1e-6);}
 for(let i=0;i<normal.length;i+=3){const len=Math.hypot(normal[i],normal[i+1],normal[i+2])/32767;assert.ok(len>.9&&len<1.1,`${p.id}: nonunit normal ${len}`);}
}
for(const c of a.concepts){assert.ok(c.elements.length);assert.equal(new Set(c.elements).size,c.elements.length);for(const id of c.elements)assert.ok(ids.has(id));}
assert.equal(triangles,a.triangles);
for(const id of ['VH_F_sacrum','VH_F_coccyx','VH_F_body_of_uterus','VH_F_left_ovary','VH_F_right_ovary','VH_F_vagina','VH_F_nipple_L','VH_F_nipple_R','CUSTOM_urethra','FJ3259','FJ3365'])assert.ok(ids.has(id),id);
for(const name of ['rib','humerus','radius','ulna','metacarpal','femur','tibia','fibula','metatarsal','parietal','frontal','mandible','biceps','triceps','deltoid','gastrocnemius'])assert.ok(a.parts.some(p=>p.name.toLowerCase().includes(name)),name);
for(const p of a.parts.filter(p=>/fibularis|tibialis|subscapularis|levator scapulae/i.test(p.name)))if(!/arter|vein|nerve/i.test(p.name))assert.equal(p.system,'muscular',p.name);
for(const name of ['Left lacrimal bone','Right lacrimal bone','Left inferior nasal concha','Right inferior nasal concha'])assert.equal(a.parts.find(p=>p.name===name)?.system,'skeletal');
assert.ok(!ids.has('FJ3152')&&!ids.has('FJ3288')&&!ids.has('FJ3393')&&!ids.has('FJ3148'));
for(const side of ['left','right']){for(const bone of ['malleus','incus','stapes']){const p=a.parts.find(p=>p.id===`CUSTOM_${side}_${bone}`);assert.ok(p);assert.equal(p.system,'skeletal');assert.equal(p.provenance,'schematic');}assert.ok(ids.has(`VH_F_${side}_uterine_artery`));}
for(const p of a.parts.filter(p=>p.provenance==='schematic')){assert.ok(p.name.includes('schematic'));assert.ok(p.sourceUrl);}
for(const id of ['CUSTOM_clitoral_glans','CUSTOM_left_labium_majus','CUSTOM_right_labium_minus','CUSTOM_endometrium','CUSTOM_myometrium','CUSTOM_left_thyroid_lobe','CUSTOM_right_inferior_parathyroid','CUSTOM_thoracic_duct','CUSTOM_urethral_sphincter'])assert.ok(ids.has(id),id);
const urethra=a.parts.find(p=>p.id==='CUSTOM_urethra'),vagina=a.parts.find(p=>p.id==='VH_F_vagina');assert.ok(urethra.bounds[0][2]>vagina.bounds[0][2]);assert.ok(urethra.bounds[1][1]-urethra.bounds[0][1]<.05);
console.log(`Verified ${ids.size} meshes, ${a.concepts.length} valid groups, ${triangles.toLocaleString()} triangles, all compressed payloads, full-body landmarks, and female substitutions.`);
