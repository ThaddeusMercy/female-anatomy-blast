/** Add labelled teaching schematics and HRA uterine arteries to the supplied atlas.
 * Idempotent: existing expansion entries/chunks are replaced. No medical validation implied.
 * Usage: node scripts/expand-atlas.mjs /absolute/path/to/3d-vh-f-united.glb
 */
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const dir=new URL('../public/models/',import.meta.url);
const atlas=JSON.parse(fs.readFileSync(new URL('atlas.json',dir)));
const glbPath=process.argv[2];
if(!glbPath)throw Error('Supply the official HRA female v1.5 GLB; see public/ATTRIBUTION.md.');
const glb=fs.readFileSync(glbPath);
if(glb.toString('ascii',0,4)!=='glTF'||glb.readUInt32LE(4)!==2)throw Error('Expected GLB v2');
const jsonLength=glb.readUInt32LE(12),gltf=JSON.parse(glb.toString('utf8',20,20+jsonLength)),binStart=28+jsonLength;
const duplicates={FJ2013:'FJ1846',FJ2386:'FJ1916',FJ2394:'FJ1924',FJ2769:'FJ2440',FJ2772:'FJ3201'};
const muscleIds=new Set(['FJ1409','FJ1410','FJ1411','FJ1439','FJ1440','FJ1504','FJ1532'].flatMap(id=>[id,id+'M']));
const boneIds=new Set(['FJ3265','FJ3371','FJ3263','FJ3369']);
atlas.parts=atlas.parts.filter(p=>!duplicates[p.id]&&!p.expansion);
atlas.concepts=atlas.concepts.filter(c=>!c.expansion);
atlas.chunks=atlas.chunks.filter(c=>!c.url.includes('study-additions'));
for(const p of atlas.parts){
 if(muscleIds.has(p.id))p.system='muscular';
 if(boneIds.has(p.id))p.system='skeletal';
 if(/gingiva|tooth|teeth/i.test(p.name))p.system='digestive';
 if(/iliotibial tract/i.test(p.name))p.system='connective';
}
const retained=new Set(atlas.parts.map(p=>p.id));
for(const c of atlas.concepts)c.elements=[...new Set(c.elements.map(id=>duplicates[id]??id).filter(id=>retained.has(id)))];
atlas.concepts=atlas.concepts.filter(c=>c.elements.length);
const created=[],groups=[],segments=[];let bytes=0;
const refs={pelvis:'https://www.ncbi.nlm.nih.gov/books/NBK547703/',perineum:'https://www.ncbi.nlm.nih.gov/books/NBK542289/',nerve:'https://www.ncbi.nlm.nih.gov/books/NBK554736/',ear:'https://www.nidcd.nih.gov/news/multimedia/medical-illustration-parts-ear',thyroid:'https://www.ncbi.nlm.nih.gov/books/NBK551659/',lymph:'https://www.ncbi.nlm.nih.gov/books/NBK513227/'};
function append(a){const pad=-bytes&3;if(pad){segments.push(Buffer.alloc(pad));bytes+=pad;}const offset=bytes,b=Buffer.from(a.buffer,a.byteOffset,a.byteLength);segments.push(b);bytes+=b.length;return offset;}
function addGeometry(meta,geometry){
 if(!geometry.attributes.normal)geometry.computeVertexNormals();geometry.computeBoundingBox();
 const p=Float32Array.from(geometry.attributes.position.array),n=Int16Array.from(geometry.attributes.normal.array,x=>Math.round(x*32767)),ind=geometry.index?Uint32Array.from(geometry.index.array):Uint32Array.from({length:p.length/3},(_,i)=>i);
 const part={...meta,expansion:true,chunk:atlas.chunks.length,positions:append(p),normals:append(n),indices:append(ind),vertexCount:p.length/3,indexCount:ind.length,bounds:[geometry.boundingBox.min.toArray(),geometry.boundingBox.max.toArray()]};
 created.push(part);geometry.dispose();return part.id;
}
function ell(center,scale,rotation=0){const g=new T.SphereGeometry(1,24,16);g.scale(...scale);g.rotateZ(rotation);g.translate(...center);return g;}
function tube(points,radius,closed=false){return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed,'centripetal'),48,radius,10,closed);}
function combine(geometries){const result=mergeGeometries(geometries.map(g=>g.index?g.toNonIndexed():g));for(const g of geometries)g.dispose();return result;}
function schematic(id,name,system,geometry,description,sourceUrl=refs.pelvis){return addGeometry({id:'CUSTOM_'+id,name:name+' (schematic)',conceptId:'CUSTOM_'+id,system,provenance:'schematic',sourceUrl,description:description+' This authored teaching shape and its placement are approximate; they are not segmented from a scan.'},geometry);}
function group(id,name,ids,description){groups.push({id:'CUSTOM_'+id,name,elements:ids,expansion:true,description});}
function center(id){const p=atlas.parts.find(p=>p.id===id);if(!p)throw Error('Missing landmark '+id);return p.bounds[0].map((x,i)=>(x+p.bounds[1][i])/2);}

// Actual HRA female artery surfaces; same affine fit as the original female pelvis.
const skin=gltf.nodes.find(n=>n.name==='VH_F_skin'),sa=gltf.accessors[gltf.meshes[skin.mesh].primitives[0].attributes.POSITION],shift=[-(sa.min[0]+sa.max[0])/2,-sa.min[1],-(sa.min[2]+sa.max[2])/2];
function accessor(id){const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],C={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],size={VEC3:3,SCALAR:1}[a.type];if(!C||!size||(v.byteStride&&v.byteStride!==size*C.BYTES_PER_ELEMENT))throw Error('Unsupported HRA accessor');return new C(glb.buffer,glb.byteOffset+binStart+(v.byteOffset??0)+(a.byteOffset??0),a.count*size);}
const arteries=[];
for(const side of ['left','right']){
 const id=`VH_F_${side}_uterine_artery`,node=gltf.nodes.find(n=>n.name===id),primitive=gltf.meshes[node.mesh].primitives[0],positions=Float32Array.from(accessor(primitive.attributes.POSITION));
 for(let i=0;i<positions.length;i+=3)for(let j=0;j<3;j++)positions[i+j]+=shift[j]+[.003,.052,.012][j];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setIndex(new T.BufferAttribute(Uint32Array.from(accessor(primitive.indices)),1));
 arteries.push(addGeometry({id,name:side[0].toUpperCase()+side.slice(1)+' uterine artery',conceptId:id,system:'arterial',provenance:'female-reference',sourceId:node.extras?.ontologyid,sourceUrl:'https://doi.org/10.48539/HBM352.BTSQ.586',description:'A uterine artery from the HRA female reference, fitted with the female pelvis. Its connection to the adapted pelvic arterial network has not been independently validated.'},g));
}
group('uterine_arteries','Uterine arteries',arteries);

// Schematic vulva/perineum, placed relative to the fitted vagina and bladder neck.
// Coordinates in metres; positive X is the subject's left, Y superior, Z anterior.
const neck=center('VH_F_urinary_bladder_neck_smooth_muscle'),cx=neck[0];
const P=(x,y,z)=>[cx+x,y,z],vulva=[],clitoris=[],pelvicMuscles=[],glands=[];
clitoris.push(schematic('clitoral_glans','Glans of clitoris','reproductive',ell(P(0,.818,.063),[.0045,.005,.004]),'The small external glans is continuous with the clitoral body.'));
clitoris.push(schematic('clitoral_body','Body of clitoris','reproductive',tube([P(0,.818,.061),P(0,.829,.053),P(0,.832,.040)],.004),'The paired erectile bodies join in the clitoral body and continue into the crura.'));
for(const [side,s]of [['Left',1],['Right',-1]]){
 const key=side.toLowerCase(),crus=[P(s*.003,.831,.038),P(s*.019,.823,.026),P(s*.039,.808,.003)];
 clitoris.push(schematic(key+'_clitoral_crus',side+' crus of clitoris','reproductive',tube(crus,.004),'A clitoral crus follows the corresponding ischiopubic ramus.'));
 vulva.push(schematic(key+'_labium_majus',side+' labium majus (labia majora)','reproductive',ell(P(s*.023,.793,.033),[.011,.032,.014],s*-.16),'One of the outer folds of the vulva. Natural size, symmetry and appearance vary.'));
 vulva.push(schematic(key+'_labium_minus',side+' labium minus (labia minora)','reproductive',ell(P(s*.009,.794,.047),[.003,.025,.009],s*-.08),'One of the inner vulvar folds bordering the vestibule; its appearance varies substantially.'));
 vulva.push(schematic(key+'_vestibular_bulb',side+' bulb of vestibule','reproductive',ell(P(s*.013,.793,.021),[.007,.018,.008],s*-.15),'Paired erectile tissue lies on either side of the vaginal opening, deep to bulbospongiosus.'));
 glands.push(schematic(key+'_bartholin_gland',side+' greater vestibular (Bartholin) gland','reproductive',ell(P(s*.015,.780,.025),[.003,.0035,.003]),'A mucus-secreting gland beside the posterior vaginal opening.'));
 glands.push(schematic(key+'_skene_gland',side+' paraurethral (Skene) gland','urinary',ell(P(s*.006,.807,.024),[.0025,.0035,.0025]),'A paraurethral gland close to the distal urethra.'));
 pelvicMuscles.push(schematic(key+'_bulbospongiosus',side+' bulbospongiosus muscle','muscular',ell(P(s*.015,.795,.018),[.010,.023,.006],s*-.1),'A superficial perineal muscle covering the vestibular bulb.',refs.perineum));
 pelvicMuscles.push(schematic(key+'_ischiocavernosus',side+' ischiocavernosus muscle','muscular',tube(crus.map(p=>[p[0]+s*.002,p[1]-.002,p[2]-.003]),.006),'A superficial perineal muscle covering the clitoral crus.',refs.perineum));
}
vulva.push(schematic('mons_pubis','Mons pubis','reproductive',ell(P(0,.851,.069),[.038,.020,.012]),'Fatty tissue superficial to the pubic symphysis. Its schematic surface shows the region, without a complete skin envelope.'));
// A rim, not a solid plug: the vestibule is a space bordered by the labia minora.
const rim=Array.from({length:32},(_,i)=>{const a=i*Math.PI/16;return P(.006*Math.cos(a),.795+.020*Math.sin(a),.042);});
vulva.push(schematic('vulval_vestibule','Vulval vestibule boundary','reproductive',tube(rim,.0008,true),'The vestibule is the space between the labia minora containing the urethral and vaginal openings. The thin outline marks its approximate boundary; it is not a solid organ.'));
vulva.push(...clitoris,...glands.filter(id=>id.includes('bartholin')));
group('clitoris','Clitoris',clitoris);group('vulva','Vulva — schematic study',vulva);group('perineal_muscles','Female superficial perineal muscles',pelvicMuscles);group('perineal_glands','Bartholin and Skene glands',glands);

// The existing urethra is schematic too; the surrounding sphincter is not a replacement scan.
const urethra=center('CUSTOM_urethra'),ring=new T.TorusGeometry(.0045,.0015,10,32);ring.rotateX(Math.PI/2);ring.translate(...urethra);
schematic('urethral_sphincter','External urethral sphincter','muscular',ring,'The external urethral sphincter surrounds the mid urethra; this simplified ring does not reproduce its complete muscle architecture.');
for(const [side,s]of [['Left',1],['Right',-1]])schematic(side.toLowerCase()+'_compressor_urethrae',side+' compressor urethrae','muscular',tube([P(s*.025,.809,.011),[urethra[0]+s*.008,urethra[1],urethra[2]+.005],P(0,.814,.029)],.0018),'A component of the female striated urethral sphincter complex.');
schematic('urethrovaginal_sphincter','Urethrovaginal sphincter','muscular',tube([P(-.010,.805,.024),P(-.015,.797,.003),P(0,.794,-.003),P(.015,.797,.003),P(.010,.805,.024)],.002),'This part of the striated sphincter complex relates to both urethra and vagina.');

const neurovascular=[];
for(const [side,s]of [['Left',1],['Right',-1]]){
 const key=side.toLowerCase(),ovary=center(`VH_F_${key}_ovary`),aortic=[.010,1.068,.014];
 neurovascular.push(schematic(key+'_ovarian_artery',side+' ovarian artery','arterial',tube([aortic,[s*.027,1.027,.005],[s*.050,.964,.016],ovary],.001),'The ovarian artery arises from the abdominal aorta and approaches the ovary through its suspensory ligament. The route is simplified.'));
 const venousEnd=s===1?[.027,1.076,.004]:[-.014,1.073,.017];
 neurovascular.push(schematic(key+'_ovarian_vein',side+' ovarian vein','venous',tube([ovary,[ovary[0]+s*.004,.958,.012],[s*.034,1.023,.003],venousEnd],.0015),side==='Left'?'The left ovarian vein drains toward the left renal vein.':'The right ovarian vein drains toward the inferior vena cava.'));
 const course=[[s*.034,.935,-.037],[s*.052,.890,-.068],[s*.060,.852,-.040],[s*.035,.810,-.002],P(s*.016,.810,.040)];
 neurovascular.push(schematic(key+'_internal_pudendal_artery',side+' internal pudendal artery','arterial',tube(course,.0014),'A branch of the internal iliac artery passes around the ischial spine toward the perineum. Its terminal branches are not individually reconstructed.',refs.perineum));
 const nerveCourse=[[s*.023,.920,-.086],[s*.042,.893,-.077],...course.slice(1).map(p=>[p[0]+s*.003,p[1],p[2]-.003])];
 neurovascular.push(schematic(key+'_pudendal_nerve',side+' pudendal nerve','nervous',tube(nerveCourse,.0018),'The pudendal nerve derives from S2–S4 and travels around the ischial spine into the perineum. This represents its main course, not every branch.',refs.nerve));
}
group('pelvic_neurovascular','Female pelvic nerves and vessels',[...arteries,...neurovascular]);

// Isolatable uterine wall teaching layers, not segmented histological surfaces.
const uc=center('VH_F_body_of_uterus');
const endometrium=schematic('endometrium','Endometrium','reproductive',ell(uc,[.009,.012,.002]),'The endometrium is the inner uterine lining. This schematic shows its approximate location, without menstrual-cycle detail.');
const myometrium=schematic('myometrium','Myometrium','reproductive',ell(uc,[.017,.014,.009]),'The myometrium is the muscular uterine wall. This simplified envelope is an overlapping teaching layer, not a separate additional organ or tissue segmentation.');
group('uterine_wall_layers','Uterine wall — schematic layers',[endometrium,myometrium]);

// Thyroid surrounds the upper trachea, inferior to the larynx. Four typical
// parathyroid positions are illustrative; number/location vary between people.
const thyroid=[],parathyroid=[];
for(const [side,s]of [['Left',1],['Right',-1]]){
 thyroid.push(schematic(side.toLowerCase()+'_thyroid_lobe',side+' lobe of thyroid gland','endocrine',ell([s*.017,1.405,.012],[.010,.024,.011],s*.12),'One lateral lobe of the thyroid gland beside the upper trachea.',refs.thyroid));
 for(const [level,y]of [['Superior',1.416],['Inferior',1.390]])parathyroid.push(schematic(side.toLowerCase()+'_'+level.toLowerCase()+'_parathyroid',side+' '+level.toLowerCase()+' parathyroid gland','endocrine',ell([s*.019,y,.000],[.0025,.0035,.002]),'A typical posterior parathyroid position. Parathyroid number and position vary; these four markers are schematic.',refs.thyroid));
}
thyroid.push(schematic('thyroid_isthmus','Isthmus of thyroid gland','endocrine',ell([0,1.395,.016],[.015,.006,.0035]),'The thyroid isthmus bridges the lateral lobes anterior to the upper trachea.',refs.thyroid));
group('thyroid','Thyroid gland',thyroid);group('parathyroids','Parathyroid glands',parathyroid);

// Each ossicle is a small named schematic, not an extra count for its subparts.
// Hammer, anvil and stirrup shapes are assembled in a single selectable mesh each.
const ossicles=[];
for(const [side,s]of [['Left',1],['Right',-1]]){
 const E=(x,y,z)=>[s*(.061+x),1.535+y,-.033+z],key=side.toLowerCase();
 ossicles.push(schematic(key+'_malleus',side+' malleus','skeletal',combine([ell(E(.002,.004,0),[.0018,.002,.0015]),tube([E(.002,.004,0),E(.003,.001,.001),E(.004,-.003,.002)],.0007)]),'The hammer-shaped middle-ear bone connects the eardrum to the incus.',refs.ear));
 ossicles.push(schematic(key+'_incus',side+' incus','skeletal',combine([ell(E(-.001,.004,-.001),[.0017,.0014,.0017]),tube([E(-.002,.004,-.002),E(-.004,.003,-.001)],.0008),tube([E(-.001,.003,-.001),E(-.002,0,.002)],.0007)]),'The anvil-shaped incus transmits vibration from the malleus to the stapes.',refs.ear));
 ossicles.push(schematic(key+'_stapes',side+' stapes','skeletal',combine([tube([E(-.002,0,.002),E(-.004,.001,.003),E(-.005,0,.005),E(-.004,-.001,.003),E(-.002,0,.002)],.00035),ell(E(-.005,0,.005),[.0004,.0012,.001])]),'The stirrup-shaped stapes transmits vibration toward the oval window of the inner ear.',refs.ear));
}
group('ossicles','Middle-ear bones — six schematics',ossicles);

// Representative regional nodes; deliberately not labelled as a complete network.
const lymph=[];
for(const [side,s]of [['Left',1],['Right',-1]]){
 for(const [region,base,count,delta]of [['cervical',[s*.034,1.455,-.006],4,[s*.001,-.014,.002]],['axillary',[s*.135,1.291,.005],4,[s*.006,-.010,.001]],['inguinal',[s*.060,.855,.064],5,[s*.010,-.005,-.001]]]){
  const nodeIds=[];
  for(let i=0;i<count;i++){const c=base.map((v,j)=>v+delta[j]*i);nodeIds.push(schematic(`${side.toLowerCase()}_${region}_lymph_node_${i+1}`,`${side} ${region} lymph node ${i+1} — representative`,'lymphatic',ell(c,[.0035,.005,.0028],s*.25),'A representative node in this region. These examples do not reproduce the number, precise positions or full drainage connections of real lymph nodes.',refs.lymph));}
  lymph.push(...nodeIds);group(`${side.toLowerCase()}_${region}_nodes`,`${side} ${region} lymph nodes — representative`,nodeIds);
  lymph.push(schematic(`${side.toLowerCase()}_${region}_lymphatic_vessel`,`${side} ${region} lymphatic vessel — representative`,'lymphatic',tube([base,base.map((v,j)=>v+delta[j]*(count-1))],.00065),'A simplified local connection illustrating a lymphatic vessel; this is not a mapped drainage tree.',refs.lymph));
 }
}
lymph.push(schematic('thoracic_duct','Thoracic duct','lymphatic',tube([[-.002,1.079,-.025],[-.006,1.19,-.035],[.010,1.28,-.040],[.023,1.368,-.019],[.044,1.390,.003],[.050,1.367,.015]],.0014),'The thoracic duct ascends from the abdomen and drains at the left venous angle. It receives lymph from most of the body.',refs.lymph));
lymph.push(schematic('right_lymphatic_duct','Right lymphatic duct','lymphatic',tube([[-.048,1.382,.001],[-.046,1.369,.010],[-.050,1.365,.016]],.0012),'The right lymphatic duct drains the upper right region of the body into the right venous angle. Its anatomy is variable.',refs.lymph));
group('lymphatic_study','Lymphatic network — representative study',lymph);

for(const p of created)atlas.concepts.push({id:p.conceptId,name:p.name,elements:[p.id],sourceId:p.sourceId,description:p.description,expansion:true});
atlas.concepts.push(...groups);atlas.parts.push(...created);
atlas.concepts.find(c=>c.id==='CUSTOM_female_study_model').elements=atlas.parts.map(p=>p.id);
group('study_additions','New study additions',created.map(p=>p.id));atlas.concepts.push(groups.at(-1));
const buffer=Buffer.concat(segments),gzip=gzipSync(buffer,{level:9});
fs.writeFileSync(new URL('study-additions.bin.gz',dir),gzip);
atlas.chunks.push({url:'/models/study-additions.bin.gz',gzip:'/models/study-additions.bin.gz',bytes:buffer.length,gzipBytes:gzip.length});
atlas.triangles=atlas.parts.reduce((sum,p)=>sum+p.indexCount/3,0);
atlas.version='custom-female-2.1';
atlas.scope='Composite educational illustration. Shared anatomy is adapted from a male reference; female HRA organs and uterine arteries are fitted into the assembly. Added vulvar anatomy, perineal muscles, pelvic neurovascular routes, thyroid/parathyroids, six ossicles and representative lymphatic structures are explicitly schematic. The 206-bone inventory includes six schematic ear bones. Shapes and placements are not clinically validated. No complete skin envelope or comprehensive microscopic/branch-level anatomy.';
atlas.adaptation.femaleReferenceParts=atlas.parts.filter(p=>p.provenance==='female-reference').length;
atlas.optimized.preservedMeshes=atlas.parts.length;
atlas.coverage={standardBoneEntries:206,referenceBasedBoneEntries:200,schematicBoneEntries:6,independentlyValidated:false,schematicParts:atlas.parts.filter(p=>p.provenance==='schematic').length,referenceParts:atlas.adaptation.femaleReferenceParts};
fs.writeFileSync(new URL('atlas.json',dir),JSON.stringify(atlas));
console.log(JSON.stringify({parts:atlas.parts.length,added:created.length,triangles:atlas.triangles,coverage:atlas.coverage},null,2));
