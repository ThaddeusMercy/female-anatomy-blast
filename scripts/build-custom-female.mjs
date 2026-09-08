/** Reproducible composite illustration, not a female scan or validated anatomical registration.
 * Inputs: ../bodyparts-source/atlas.json + .gz chunks; ../female-source/selection-plan.json + ranges.
 * Preserve original FJ/FMA and VH_F/ontology identities; author-created meshes use CUSTOM_ IDs.
 */
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import * as T from 'three';
import {MeshoptSimplifier} from 'meshoptimizer';
await MeshoptSimplifier.ready;
const base=path.resolve(import.meta.dirname,'../../bodyparts-source'),hra=path.resolve(import.meta.dirname,'../../female-source');
const output=path.resolve(import.meta.dirname,'../public/models');fs.mkdirSync(output,{recursive:true});
const bp=JSON.parse(fs.readFileSync(path.join(base,'atlas.json'))),plan=JSON.parse(fs.readFileSync(path.join(hra,'selection-plan.json'))),gltf=plan.gltf;
const input=bp.chunks.map(c=>gunzipSync(fs.readFileSync(path.join(base,path.basename(c.gzip)))));
const ranges=plan.ranges.map(([lo,hi],i)=>({lo,hi,b:fs.readFileSync(path.join(hra,`range-${i}.bin`))}));
function accessor(id){const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],lo=(v.byteOffset??0)+(a.byteOffset??0),C={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],count=a.count*{SCALAR:1,VEC3:3}[a.type],hi=lo+count*C.BYTES_PER_ELEMENT,r=ranges.find(r=>r.lo<=lo&&r.hi>=hi);if(!r)throw Error(`Missing range for ${id}`);return new C(r.b.buffer,r.b.byteOffset+lo-r.lo,count);}
const skin=gltf.nodes.find(n=>n.name==='VH_F_skin'),skinA=gltf.accessors[gltf.meshes[skin.mesh].primitives[0].attributes.POSITION];
const shift=[-(skinA.min[0]+skinA.max[0])/2,-skinA.min[1],-(skinA.min[2]+skinA.max[2])/2];
const scales=[[0,.99],[.45,1.02],[.70,1.08],[.88,1.13],[1.02,1.09],[1.15,.94],[1.37,.92],[1.48,.97],[1.75,.98]];
function profile(y){let i=1;while(i<scales.length-1&&y>scales[i][0])i++;const [a,s]=scales[i-1],[b,t]=scales[i],u=Math.max(0,Math.min(1,(y-a)/(b-a))),smooth=u*u*(3-2*u);return [s+(t-s)*smooth,(t-s)*6*u*(1-u)/(b-a)];}
// A smooth illustrative body-shape edit, applied consistently to adjoining shared structures.
function sharedTransform(x,y,z,nx,ny,nz){const [s,d]=profile(y),px=x*s,py=y*.97,pz=z*.97;const ax=nx/s,ay=(ny-d*x*ax)/.97,az=nz/.97,l=Math.hypot(ax,ay,az)||1;return [px,py,pz,ax/l,ay/l,az/l];}
const pelvicTransform=[1,1,1, .003,.052,.012];
const breastTransform=[.95,.83,.87, .002,.222,.045];
function femaleTransform(p,transform){const [sx,sy,sz,tx,ty,tz]=transform;for(let i=0;i<p.length;i+=3){p[i]=(p[i]+shift[0])*sx+tx;p[i+1]=(p[i+1]+shift[1])*sy+ty;p[i+2]=(p[i+2]+shift[2])*sz+tz;}return p;}
const parts=[],concepts=[],chunks=[],excluded=[];let segments=[],bytes=0,triangles=0;
function atomic(file,data){const tmp=file+'.new';fs.writeFileSync(tmp,data);fs.renameSync(tmp,file);}
function flush(){if(!bytes)return;const name=`custom-${chunks.length}.bin`,b=Buffer.concat(segments),gz=gzipSync(b,{level:9});atomic(path.join(output,name+'.gz'),gz);chunks.push({url:'/models/'+name+'.gz',bytes:b.length,gzip:'/models/'+name+'.gz',gzipBytes:gz.length});segments=[];bytes=0;}
function append(a){const pad=-bytes&3;if(pad){segments.push(Buffer.alloc(pad));bytes+=pad;}const offset=bytes,b=Buffer.from(a.buffer,a.byteOffset,a.byteLength);segments.push(b);bytes+=b.length;return offset;}
function add(meta,positions,normals,indices){
 const bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];for(let i=0;i<positions.length;i++){const a=i%3;bounds[0][a]=Math.min(bounds[0][a],positions[i]);bounds[1][a]=Math.max(bounds[1][a],positions[i]);}
 if(bytes>4_000_000)flush();parts.push({...meta,chunk:chunks.length,positions:append(positions),normals:append(normals),indices:append(indices),vertexCount:positions.length/3,indexCount:indices.length,bounds});triangles+=indices.length/3;
}
const excludedName=/penis|testicul|testis|deferen|seminal|prostat|epidid|spermatic|scrot|cremaster|bulbospongios|ischiocavernos/i;
for(const p of bp.parts){
 if(p.system==='reproductive'||p.system==='integumentary'||excludedName.test(p.name)||/^(left hip bone|right hip bone|sacrum|coccyx|urinary bladder|urethra)$/i.test(p.name)){excluded.push({id:p.id,name:p.name});continue;}
 const b=input[p.chunk],sourceP=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),sourceN=new Int16Array(b.buffer,b.byteOffset+p.normals,p.vertexCount*3),pos=new Float32Array(sourceP.length),normal=new Int16Array(sourceN.length),indices=Uint32Array.from(new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount));
 for(let i=0;i<pos.length;i+=3){const v=sharedTransform(sourceP[i],sourceP[i+1],sourceP[i+2],sourceN[i]/32767,sourceN[i+1]/32767,sourceN[i+2]/32767);pos.set(v.slice(0,3),i);for(let a=0;a<3;a++)normal[i+a]=Math.round(v[a+3]*32767);}
 add({id:p.id,name:p.name,conceptId:p.conceptId,system:p.system,provenance:'adapted',sourceId:p.conceptId,sourceUrl:'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/'},pos,normal,indices);
}
console.log('Shared anatomy retained:',parts.length);
const nodes=gltf.nodes,parents=new Map();nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents.set(c,i)));
const ancestry=i=>{const a=[];for(let k=i;k!==undefined;k=parents.get(k))a.push(nodes[k].name);return a;};
function title(n){let name=n.extras?.label;if(!name||name==='-')name=n.name.replace(/^VH_F_/,'').replaceAll('_',' ');if(/_(L|R)$/.test(n.name)&&!/\b(left|right)\b/i.test(name))name=(n.name.endsWith('_L')?'Left ':'Right ')+name;return name[0].toUpperCase()+name.slice(1);}
const femaleIds=new Set();
for(const i of plan.selected){
 const n=nodes[i];if(n.mesh===undefined)continue;const primitive=gltf.meshes[n.mesh].primitives[0];const ancestryNames=ancestry(i),breast=ancestryNames.includes('VH_F_mammary_gland'),pelvis=ancestryNames.includes('VH_F_pelvis'),urinary=ancestryNames.includes('VH_F_urinary_bladder');
 const rawP=accessor(primitive.attributes.POSITION),rawN=accessor(primitive.attributes.NORMAL),rawI=accessor(primitive.indices),map=new Map(),remap=new Uint32Array(rawP.length/3),wp=[],wn=[];
 for(let j=0;j<rawP.length;j+=3){const key=`${rawP[j]},${rawP[j+1]},${rawP[j+2]}`;let v=map.get(key);if(v===undefined){v=wp.length/3;map.set(key,v);wp.push(rawP[j],rawP[j+1],rawP[j+2]);wn.push(0,0,0);}remap[j/3]=v;for(let a=0;a<3;a++)wn[v*3+a]+=rawN[j+a];}
 const transform=breast?breastTransform:pelvicTransform,pos=femaleTransform(new Float32Array(wp),transform),normal=new Int16Array(wn.length);
 for(let j=0;j<wn.length;j+=3){const x=wn[j]/transform[0],y=wn[j+1]/transform[1],z=wn[j+2]/transform[2],l=Math.hypot(x,y,z)||1;normal.set([x/l*32767,y/l*32767,z/l*32767].map(Math.round),j);}
 const indices=Uint32Array.from(rawI,x=>remap[x]),target=Math.max(96,Math.floor(indices.length*.2/3)*3),[simplified]=MeshoptSimplifier.simplify(indices,pos,3,Math.min(indices.length,target),.002),[compact,count]=MeshoptSimplifier.compactMesh(simplified),cp=new Float32Array(count*3),cn=new Int16Array(count*3);
 for(let j=0;j<compact.length;j++){const k=compact[j];if(k===0xffffffff)continue;cp.set(pos.subarray(j*3,j*3+3),k*3);cn.set(normal.subarray(j*3,j*3+3),k*3);}
 let name=title(n);if(pelvis&&/_(compact|spongy)_bone_/.test(n.name)){const bone=n.name.split('_')[2],side=n.name.endsWith('_L')?'Left':'Right';name=`${side} ${bone} · ${n.name.includes('compact')?'cortical':'trabecular'} bone`;}
 add({id:n.name,name,conceptId:n.name,system:breast?'breast':pelvis?'skeletal':urinary?'urinary':'reproductive',provenance:'female-reference',sourceId:n.extras?.ontologyid,sourceUrl:'https://3d.nih.gov/entries/20992?version=1'},cp,cn,simplified);femaleIds.add(n.name);
}
console.log('Female reference meshes added:',femaleIds.size);
// A visibly identified simplified female urethra, absent from the selected source mesh set.
const neck=parts.find(p=>p.id==='VH_F_urinary_bladder_neck_smooth_muscle'),vagina=parts.find(p=>p.id==='VH_F_vagina');
if(!neck||!vagina)throw Error('Female urinary/vaginal landmarks missing');
const origin=new T.Vector3((neck.bounds[0][0]+neck.bounds[1][0])/2,neck.bounds[0][1]+.004,(neck.bounds[0][2]+neck.bounds[1][2])/2);
const end=new T.Vector3(origin.x,vagina.bounds[0][1]+.008,vagina.bounds[1][2]+.012);
const curve=new T.CatmullRomCurve3([origin,new T.Vector3(origin.x,(origin.y+end.y)/2,(origin.z+end.z)/2),end]);
const tube=new T.TubeGeometry(curve,24,.003,12,false);add({id:'CUSTOM_urethra',name:'Female urethra (schematic)',conceptId:'CUSTOM_urethra',system:'urinary',provenance:'schematic',sourceUrl:'https://www.ncbi.nlm.nih.gov/books/NBK547703/'},Float32Array.from(tube.attributes.position.array),Int16Array.from(tube.attributes.normal.array,n=>Math.round(n*32767)),Uint32Array.from(tube.index.array));tube.dispose();
flush();
const kept=new Set(parts.map(p=>p.id));
for(const c of bp.concepts){if(excludedName.test(c.name)||/male reproductive|male genital/i.test(c.name))continue;const elements=c.elements.filter(id=>kept.has(id));if(elements.length)concepts.push({...c,elements,sourceId:c.id});}
const descendants=i=>[...(nodes[i].mesh!==undefined&&femaleIds.has(nodes[i].name)?[nodes[i].name]:[]),...(nodes[i].children??[]).flatMap(descendants)];
const aliases={VH_F_mammary_gland:'Breasts',VH_F_mammary_gland_L:'Left breast',VH_F_mammary_gland_R:'Right breast',VH_F_uterus:'Uterus',VH_F_ovary:'Ovaries',VH_F_fallopian_tube:'Fallopian tubes',VH_F_pelvis:'Female pelvis',VH_F_urinary_bladder:'Urinary bladder'};
for(const i of plan.selected){const n=nodes[i],elements=descendants(i);if(elements.length)concepts.push({id:n.name,name:aliases[n.name]??title(n),elements,sourceId:n.extras?.ontologyid});}
concepts.push({id:'CUSTOM_urethra',name:'Female urethra (schematic)',elements:['CUSTOM_urethra']});
concepts.unshift({id:'CUSTOM_female_study_model',name:'Female anatomy study model',elements:[...kept]});
// Resolve compound organs against the actual assembled contents, not removed male constituents.
for(const id of ['FMA18250','FMA1740']){const c=concepts.find(c=>c.id===id);if(c&&/urinary|bladder/i.test(c.name))c.elements=[...new Set([...c.elements,...parts.filter(p=>p.system==='urinary').map(p=>p.id)])];}
const atlas={version:'custom-female-2.0',sex:'female',modelType:'composite-illustration',source:'Adapted BodyParts3D + Human Reference Atlas female meshes',scope:'Custom educational illustration with full-body musculoskeletal and organ-system coverage. Shared anatomy was adapted from a male reference; female source parts are fitted into this assembly. Spatial relationships and shapes have not been independently validated. The female urethra is schematic; external vulvar anatomy and fine sex-specific neurovascular branches are not modeled.',parts,concepts,chunks,triangles,adaptation:{sharedBodyWidthProfile:scales,sharedHeightScale:.97,pelvicTransform,breastTransform,excluded,sourcePartCount:bp.parts.length,femaleReferenceParts:femaleIds.size},optimized:{method:'Preserved BodyParts3D browser meshes; female exact-position weld and meshoptimizer simplification',maximumRelativeErrorForFemaleParts:.002,preservedMeshes:parts.length}};
atomic(path.join(output,'atlas.json'),JSON.stringify(atlas));
console.log(JSON.stringify({parts:parts.length,concepts:concepts.length,triangles,gzipMB:chunks.reduce((s,c)=>s+c.gzipBytes,0)/1e6,systems:Object.fromEntries([...new Set(parts.map(p=>p.system))].map(s=>[s,parts.filter(p=>p.system===s).length]))},null,2));
