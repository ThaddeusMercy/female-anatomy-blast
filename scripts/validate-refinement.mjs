/** Geometry regression against immutable pre-refinement data, not anatomy validation. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
const baseline = process.argv[2];
assert.ok(baseline, "Supply the unrefined 2.1 models directory.");
function load(dir) {
  const raw = fs.readFileSync(path.join(dir, "atlas.json")),
    a = JSON.parse(raw);
  return {
    a,
    raw,
    b: a.chunks.map((c) => gunzipSync(fs.readFileSync(path.join(dir, path.basename(c.gzip))))),
  };
}
const before = load(baseline),
  after = load(fileURLToPath(new URL("../public/models/", import.meta.url))),
  a = after.a;
assert.equal(
  a.refinement.baselineManifestSha256,
  createHash("sha256").update(before.raw).digest("hex"),
);
assert.deepEqual(a.concepts, before.a.concepts);
assert.equal(a.parts.length, before.a.parts.length);
assert.equal(a.triangles, before.a.triangles);
assert.deepEqual(a.coverage, before.a.coverage);
const vector = (r, p, f) =>
  new (f === "positions" ? Float32Array : Uint32Array)(
    r.b[p.chunk].buffer,
    r.b[p.chunk].byteOffset + p[f],
    f === "positions" ? p.vertexCount * 3 : p.indexCount,
  );
let maxShift = 0,
  minAreaRatio = Infinity,
  maxAreaRatio = 0,
  unchanged = 0,
  unchangedLower = 0,
  triangleCount = 0;
const metrics = {};
function extent(list, axis) {
  return Math.max(...list.map((p) => p[axis])) - Math.min(...list.map((p) => p[axis]));
}
const waist = [[], []],
  shoulder = [[], []],
  breasts = { left: [[], []], right: [[], []] },
  glutes = [[], []];
for (let part = 0; part < a.parts.length; part++) {
  const p = a.parts[part],
    q = before.a.parts[part];
  assert.deepEqual({ ...p, bounds: null }, { ...q, bounds: null }, `Metadata changed: ${p.id}`);
  const oldPos = vector(before, q, "positions"),
    newPos = vector(after, p, "positions"),
    oldInd = vector(before, q, "indices"),
    ind = vector(after, p, "indices");
  assert.deepEqual(ind, oldInd, `Topology changed: ${p.id}`);
  let changed = false;
  for (let v = 0; v < oldPos.length; v += 3) {
    const old = Array.from(oldPos.subarray(v, v + 3)),
      now = Array.from(newPos.subarray(v, v + 3));
    const shift = Math.hypot(...old.map((x, k) => now[k] - x));
    maxShift = Math.max(maxShift, shift);
    changed ||= shift > 0;
    if (old[1] < 0.7) {
      assert.deepEqual(now, old, `Lower leg/foot moved: ${p.id}`);
      unchangedLower++;
    }
    if (old[1] < 1.005 && Math.abs(old[0]) >= 0.2)
      assert.deepEqual(now, old, `Outer forearm/hand moved: ${p.id}`);
    if (/external oblique/i.test(p.name) && Math.abs(old[1] - 1.1) < 0.01) {
      waist[0].push(old);
      waist[1].push(now);
    }
    if (/acromial part.*deltoid/i.test(p.name)) {
      shoulder[0].push(old);
      shoulder[1].push(now);
    }
    if (p.system === "breast") {
      const s = p.id.endsWith("_L") ? "left" : "right";
      breasts[s][0].push(old);
      breasts[s][1].push(now);
    }
    if (/gluteus maximus/i.test(p.name)) {
      glutes[0].push(old);
      glutes[1].push(now);
    }
  }
  if (!changed) unchanged++;
  for (let i = 0; i < ind.length; i += 3) {
    const cross = (pos) => {
      const u = [],
        v = [];
      for (let k = 0; k < 3; k++) {
        u[k] = pos[ind[i + 1] * 3 + k] - pos[ind[i] * 3 + k];
        v[k] = pos[ind[i + 2] * 3 + k] - pos[ind[i] * 3 + k];
      }
      return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    };
    const old = cross(oldPos),
      now = cross(newPos),
      area = Math.hypot(...old);
    if (area > 1e-12) {
      const ratio = Math.hypot(...now) / area;
      assert.ok(ratio > 0.15 && ratio < 4, `Extreme triangle stretch: ${p.id} ${ratio}`);
      assert.ok(
        old.reduce((sum, x, k) => sum + x * now[k], 0) > 0,
        `Triangle orientation reversed: ${p.id}`,
      );
      minAreaRatio = Math.min(minAreaRatio, ratio);
      maxAreaRatio = Math.max(maxAreaRatio, ratio);
      triangleCount++;
    }
  }
}
for (const [label, pair, axis] of [
  ["waistSurfaceWidth", waist, 0],
  ["deltoidSurfaceWidth", shoulder, 0],
  ["leftBreastDepth", breasts.left, 2],
  ["rightBreastDepth", breasts.right, 2],
  ["glutealSurfaceDepth", glutes, 2],
]) {
  const old = extent(pair[0], axis),
    now = extent(pair[1], axis);
  metrics[label] = {
    beforeMm: old * 1000,
    afterMm: now * 1000,
    changePercent: (now / old - 1) * 100,
  };
}
assert.ok(
  metrics.waistSurfaceWidth.changePercent < -5 && metrics.waistSurfaceWidth.changePercent > -10,
);
assert.ok(
  metrics.deltoidSurfaceWidth.changePercent < -1 && metrics.deltoidSurfaceWidth.changePercent > -4,
);
assert.ok(
  metrics.leftBreastDepth.changePercent < -8 && metrics.rightBreastDepth.changePercent < -8,
);
assert.ok(maxShift < 0.02);
for (const id of [
  "VH_F_body_of_uterus",
  "VH_F_left_ovary",
  "VH_F_right_ovary",
  "VH_F_vagina",
  "CUSTOM_urethra",
]) {
  const p = a.parts.find((p) => p.id === id),
    q = before.a.parts.find((p) => p.id === id);
  assert.deepEqual(
    vector(after, p, "positions"),
    vector(before, q, "positions"),
    `Core pelvic organ moved: ${id}`,
  );
}
const result = {
  clinicalValidation: false,
  baselineManifestSha256: a.refinement.baselineManifestSha256,
  pieces: a.parts.length,
  triangles: a.triangles,
  testedNondegenerateTriangles: triangleCount,
  topologyAndIdentitiesPreserved: true,
  unchangedPieces: unchanged,
  unchangedVerticesBelowPointSevenMetres: unchangedLower,
  maximumDisplacementMm: maxShift * 1000,
  triangleAreaRatio: { min: minAreaRatio, max: maxAreaRatio },
  measurements: metrics,
  note: "Surface extents are geometry proxies, not anthropometric landmarks or normal female ranges. Positive orientation at sampled triangles is not a global collision test. Core pelvic organs preserved; cross-source anatomical connections remain unvalidated.",
};
fs.writeFileSync(
  new URL("../docs/refinement-regression.json", import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
