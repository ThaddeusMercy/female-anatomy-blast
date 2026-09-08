/** Deterministic illustration refinement, never a clinical registration.
 * node scripts/refine-anatomy.mjs /absolute/path/to/unrefined/public/models
 * Reads an immutable 2.1 baseline; refuses already refined input. No dependencies.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
const out = fileURLToPath(new URL("../public/models/", import.meta.url));
const input = process.argv[2] && path.resolve(process.argv[2]);
assert.ok(input, "Supply the unrefined 2.1 models directory. See docs/REFINEMENT.md.");
assert.notEqual(input, path.resolve(out), "Keep the baseline outside the output directory.");
const raw = fs.readFileSync(path.join(input, "atlas.json")),
  atlas = JSON.parse(raw);
assert.equal(
  atlas.version,
  "custom-female-2.1",
  "Expected the unrefined 2.1 baseline; do not compound deformations.",
);
assert.equal(atlas.refinement, undefined);
assert.equal(atlas.parts.length, 2353);
const data = atlas.chunks.map((c) =>
  gunzipSync(fs.readFileSync(path.join(input, path.basename(c.gzip)))),
);
const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (a, b, c, v) => smooth(a, b, v) * (1 - smooth(b, c, v));
/** One spatial field for every system keeps coincident input coordinates coincident.
 * Breast-only fit is applied to all 16 HRA breast pieces, never to individual lobes.
 */
function baseDeform(x, y, z, breast = false) {
  const trunk = 1 - smooth(0.12, 0.19, Math.abs(x));
  const waist = 0.085 * bump(1.005, 1.1, 1.23, y) * trunk;
  const shoulder = 0.028 * bump(1.15, 1.32, 1.48, y);
  const thorax = 0.04 * bump(1.135, 1.27, 1.44, y) * trunk;
  const posterior =
    bump(0.72, 0.86, 1.0, y) *
    smooth(0.025, 0.07, Math.abs(x)) *
    (1 - smooth(0.15, 0.2, Math.abs(x))) *
    (1 - smooth(-0.105, -0.035, z));
  let px = x * (1 - waist - shoulder),
    py = y - 0.004 * posterior,
    pz = z * (1 - thorax) - 0.009 * posterior;
  if (breast) {
    // Small side-specific translation from the sampled source breast/pectoral offsets.
    // Projection/lower-pole correction fades to zero at the posterior attachment zone.
    const front = smooth(0.105, 0.16, z);
    pz += (x > 0 ? 0.0025 : 0.0045) - 0.18 * Math.max(0, z - 0.105) * front;
    py += 0.008 * front * (1 - smooth(1.235, 1.3, y));
  }
  return [px, py, pz];
}
// Exact coincident input vertices share one correction, including across systems.
// This bounded repair addresses long, thin facets that under-resolve the smooth field.
const repairs = new Map();
const key = (x, y, z) => `${x},${y},${z}`;
function deform(x, y, z, breast = false) {
  return baseDeform(x, y, z, breast);
}
const positionSets = atlas.parts.map((p) => {
  const b = data[p.chunk],
    old = Float32Array.from(
      new Float32Array(b.buffer, b.byteOffset + p.positions, p.vertexCount * 3),
    );
  return {
    p,
    old,
    next: Float32Array.from(old),
    ind: new Uint32Array(b.buffer, b.byteOffset + p.indices, p.indexCount),
  };
});
for (const s of positionSets)
  for (let i = 0; i < s.old.length; i += 3)
    s.next.set(deform(s.old[i], s.old[i + 1], s.old[i + 2], s.p.system === "breast"), i);
const cross = (p, ind, i) => {
  const u = [],
    v = [];
  for (let k = 0; k < 3; k++) {
    u[k] = p[ind[i + 1] * 3 + k] - p[ind[i] * 3 + k];
    v[k] = p[ind[i + 2] * 3 + k] - p[ind[i] * 3 + k];
  }
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
};
for (let pass = 0; pass < 24; pass++) {
  const unstable = [];
  for (const s of positionSets)
    for (let i = 0; i < s.ind.length; i += 3) {
      const old = cross(s.old, s.ind, i),
        now = cross(s.next, s.ind, i),
        area = Math.hypot(...old);
      if (area <= 1e-12) continue;
      const ratio = Math.hypot(...now) / area,
        dot = old.reduce((sum, v, k) => sum + v * now[k], 0);
      if (ratio <= 0.15 || ratio >= 4 || dot <= 0) unstable.push([s, i]);
    }
  console.log(`Surface preflight ${pass + 1}: ${unstable.length} unstable facets`);
  if (!unstable.length) break;
  assert.ok(pass < 23, "Surface repair did not converge; do not publish.");
  for (const [s, i] of unstable) {
    const points = [0, 1, 2].map((k) =>
        Array.from(s.old.subarray(s.ind[i + k] * 3, s.ind[i + k] * 3 + 3)),
      ),
      center = [0, 1, 2].map((k) => points.reduce((sum, p) => sum + p[k], 0) / 3),
      q = deform(...center, s.p.system === "breast"),
      j = [],
      eps = 1e-5;
    for (let k = 0; k < 3; k++) {
      const plus = center.slice(),
        minus = center.slice();
      plus[k] += eps;
      minus[k] -= eps;
      const a = deform(...plus, s.p.system === "breast"),
        b = deform(...minus, s.p.system === "breast");
      for (let row = 0; row < 3; row++) j[row * 3 + k] = (a[row] - b[row]) / (2 * eps);
    }
    for (let k = 0; k < 3; k++) {
      const v = points[k].map((x, axis) => x - center[axis]),
        target = q.map(
          (x, row) => x + j[row * 3] * v[0] + j[row * 3 + 1] * v[1] + j[row * 3 + 2] * v[2],
        ),
        pk = key(...points[k]),
        base = deform(...points[k], s.p.system === "breast");
      assert.ok(
        Math.hypot(...target.map((x, axis) => x - base[axis])) < 0.003,
        "Surface repair exceeds 3 mm",
      );
      repairs.set(pk, target);
    }
  }
  const xs = new Set([...repairs.keys()].map((k) => Number(k.split(",")[0])));
  for (const s of positionSets)
    for (let i = 0; i < s.old.length; i += 3)
      if (xs.has(s.old[i])) {
        const target = repairs.get(key(s.old[i], s.old[i + 1], s.old[i + 2]));
        if (target) s.next.set(target, i);
      }
}
const report = {
  revision: "contour-fit-1",
  baselineManifestSha256: createHash("sha256").update(raw).digest("hex"),
  baselinePublicCommit: "03632ba5cde865d17978412b1531a6d7d073cbd3",
  clinicalValidation: false,
  parts: [],
  minimumVertexJacobian: Infinity,
  topologyPreserved: true,
  surfaceRepairVertices: repairs.size,
  maximumSurfaceRepairMm: 0,
  counts: { pieces: atlas.parts.length, triangles: atlas.triangles },
};
const h = 1e-5;
let processed = 0;
for (const p of atlas.parts) {
  const saved = positionSets[atlas.parts.indexOf(p)];
  const b = data[p.chunk],
    pos = new Float32Array(b.buffer, b.byteOffset + p.positions, p.vertexCount * 3),
    n = new Int16Array(b.buffer, b.byteOffset + p.normals, p.vertexCount * 3);
  let maxShift = 0,
    minDet = Infinity;
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  const breast = p.system === "breast";
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i],
      y = pos[i + 1],
      z = pos[i + 2],
      base = deform(x, y, z, breast),
      q = Array.from(saved.next.subarray(i, i + 3));
    report.maximumSurfaceRepairMm = Math.max(
      report.maximumSurfaceRepairMm,
      Math.hypot(...q.map((v, k) => v - base[k])) * 1000,
    );
    const delta = Math.hypot(q[0] - x, q[1] - y, q[2] - z);
    maxShift = Math.max(maxShift, delta);
    if (delta > 1e-12) {
      const xp = deform(x + h, y, z, breast),
        xm = deform(x - h, y, z, breast),
        yp = deform(x, y + h, z, breast),
        ym = deform(x, y - h, z, breast),
        zp = deform(x, y, z + h, breast),
        zm = deform(x, y, z - h, breast);
      const a = (xp[0] - xm[0]) / (2 * h),
        d = (xp[1] - xm[1]) / (2 * h),
        g = (xp[2] - xm[2]) / (2 * h),
        c = (zp[0] - zm[0]) / (2 * h),
        f = (zp[1] - zm[1]) / (2 * h),
        j = (zp[2] - zm[2]) / (2 * h),
        bb = (yp[0] - ym[0]) / (2 * h),
        e = (yp[1] - ym[1]) / (2 * h),
        hh = (yp[2] - ym[2]) / (2 * h);
      const A = e * j - f * hh,
        B = f * g - d * j,
        C = d * hh - e * g,
        D = c * hh - bb * j,
        E = a * j - c * g,
        F = bb * g - a * hh,
        G = bb * f - c * e,
        H = c * d - a * f,
        I = a * e - bb * d;
      const det = a * A + bb * B + c * C;
      assert.ok(det > 0.25, `Fold/compression at ${p.id}: ${det}`);
      minDet = Math.min(minDet, det);
      // Cofactor matrix = det(J) J^-T. Normalize after transport.
      const nx = A * n[i] + B * n[i + 1] + C * n[i + 2],
        ny = D * n[i] + E * n[i + 1] + F * n[i + 2],
        nz = G * n[i] + H * n[i + 1] + I * n[i + 2],
        len = Math.hypot(nx, ny, nz);
      assert.ok(len > 1e-8);
      n[i] = Math.round((nx / len) * 32767);
      n[i + 1] = Math.round((ny / len) * 32767);
      n[i + 2] = Math.round((nz / len) * 32767);
      pos[i] = q[0];
      pos[i + 1] = q[1];
      pos[i + 2] = q[2];
    }
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], pos[i + k]);
      max[k] = Math.max(max[k], pos[i + k]);
    }
  }
  // Recompute face-weighted normals at repaired vertices from the final triangles.
  const corrected = new Set();
  for (let i = 0; i < saved.old.length; i += 3)
    if (repairs.has(key(saved.old[i], saved.old[i + 1], saved.old[i + 2]))) corrected.add(i / 3);
  if (corrected.size) {
    const sums = new Map([...corrected].map((i) => [i, [0, 0, 0]]));
    for (let i = 0; i < saved.ind.length; i += 3) {
      if (![0, 1, 2].some((k) => corrected.has(saved.ind[i + k]))) continue;
      const c = cross(pos, saved.ind, i);
      for (let k = 0; k < 3; k++) {
        const sum = sums.get(saved.ind[i + k]);
        if (sum) for (let axis = 0; axis < 3; axis++) sum[axis] += c[axis];
      }
    }
    for (const [vertex, sum] of sums) {
      const len = Math.hypot(...sum);
      if (len > 1e-12)
        for (let k = 0; k < 3; k++) n[vertex * 3 + k] = Math.round((sum[k] / len) * 32767);
    }
  }
  p.bounds = [min, max];
  report.minimumVertexJacobian = Math.min(report.minimumVertexJacobian, minDet);
  report.parts.push({
    id: p.id,
    maxDisplacementMm: maxShift * 1000,
    minimumVertexJacobian: Number.isFinite(minDet) ? minDet : 1,
  });
  if (++processed % 500 === 0) console.log(`Refined ${processed}/${atlas.parts.length} pieces`);
}
const old = fs.existsSync(path.join(out, "atlas.json"))
  ? JSON.parse(fs.readFileSync(path.join(out, "atlas.json")))
  : null;
fs.mkdirSync(out, { recursive: true });
for (let i = 0; i < data.length; i++) {
  const hash = createHash("sha256").update(data[i]).digest("hex").slice(0, 12),
    name = `refined-${i}-${hash}.bin.gz`,
    gz = gzipSync(data[i], { level: 9 });
  fs.writeFileSync(path.join(out, name), gz);
  atlas.chunks[i] = {
    ...atlas.chunks[i],
    url: "/models/" + name,
    gzip: "/models/" + name,
    gzipBytes: gz.length,
  };
}
atlas.version = "custom-female-2.2";
atlas.refinement = {
  revision: report.revision,
  baselineManifestSha256: report.baselineManifestSha256,
  baselinePublicCommit: report.baselinePublicCommit,
  method:
    "Common localized torso/shoulder/posterior field; coherent 16-piece breast fit; inverse-transpose normals; original topology and IDs retained",
  parameters: {
    waistMaximumScaleReduction: 0.085,
    shoulderMaximumScaleReduction: 0.028,
    thoraxMaximumDepthReduction: 0.04,
    posteriorMaximumOffsetM: 0.009,
    posteriorMaximumInferiorOffsetM: 0.004,
    breastAnteriorCompression: 0.18,
    breastMaximumLowerPoleLiftM: 0.008,
    breastTranslationZM: { left: 0.0025, right: 0.0045 },
  },
  surfaceRepairVertices: repairs.size,
  clinicalValidation: false,
};
fs.writeFileSync(path.join(out, "atlas.json"), JSON.stringify(atlas));
const keep = new Set(atlas.chunks.map((c) => path.basename(c.gzip)));
// Remove only old generated chunks listed by the prior output manifest (git recovers them).
for (const c of old?.chunks ?? [])
  if (!keep.has(path.basename(c.gzip)))
    fs.rmSync(path.join(out, path.basename(c.gzip)), { force: true });
fs.writeFileSync(
  new URL("../docs/refinement-audit.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `Preserved ${atlas.parts.length} identities and ${atlas.triangles} triangles; minimum vertex Jacobian ${report.minimumVertexJacobian.toFixed(4)}`,
);
