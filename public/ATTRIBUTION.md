# Female Anatomy Blast — model construction and credits

This is a custom composite educational illustration. It is not a female scan, a clinically validated female atlas, or a representation of every human structure. Source geometries and their alignment have not undergone independent anatomical review.

## BodyParts3D
BodyParts3D © The Database Center for Life Science, CC BY 4.0. Source: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/ ; current license: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html . Browser-ready meshes and concept relationships adapted from https://github.com/ashemag/human-atlas .

The source represents adult male reference anatomy. This adaptation retains shared bones, muscles, organs, vessels, nerves, sensory structures and connective tissues, and changes body dimensions with a continuous height-dependent deformation. These edits are illustrative and do not establish female osteological accuracy. Male reproductive structures and explicitly male genital vascular branches, the male urethra/bladder, source hip bones/sacrum, and the source skin/hair meshes are excluded. The deformation is applied consistently to adjoining shared meshes and normals. Original FJ and FMA identities are retained. An exact exclusion list and transformation parameters are in the generated atlas manifest.

## Human Reference Atlas female sources
Kristen Browne and Heidi Schlehlein. 2023. *3D Reference Organ Set for Female, v1.5.* Human Reference Atlas / HuBMAP. CC BY 4.0. https://doi.org/10.48539/HBM352.BTSQ.586 . Original GLB: https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb .

The female pelvis, breast tissues, internal reproductive anatomy, bladder and two uterine arteries are fitted into the composite. Original VH_F identifiers and ontology labels are retained. The initial breast placement uses a separate affine fit; the pelvis and its reproductive/bladder components share one transform to preserve their source relationship. Source vertices are welded at exact coincident positions, normals averaged, and meshes simplified with a maximum 0.2% relative geometric error. This simplification error bound does not measure anatomical accuracy or cross-source registration.

## Authored geometry and limitations
CUSTOM_urethra is a simplified tube from the modeled bladder neck toward the exterior, positioned anterior to the modeled vaginal opening. It is labeled schematic in search and inspection. General reading: https://www.ncbi.nlm.nih.gov/books/NBK547703/ . No textbook images or text passages are reproduced.

The 2.1 release adds 81 authored schematic pieces: vulvar anatomy, selected perineal muscles and urethral sphincter components, main pelvic neurovascular routes, uterine wall teaching layers, thyroid/parathyroids, six ear ossicles and representative lymphatic nodes/vessels. These are original geometric illustrations by Mercy Thaddeus (2026), made with AI assistance; they are not scans, clinical segmentations or reproductions of textbook illustrations. The reference links in each record are reading references, not mesh sources. Shapes, scales and paths remain approximate. See MODEL-COVERAGE.md for a precise inventory and remaining gaps. A complete skin envelope, fine branches and full lymphatic drainage are not modeled. Pelvic attachments, inter-source alignment, body-shape modifications and small structures require specialist review before detailed teaching use. Colors distinguish display systems. This model is for introductory exploration, not diagnosis or surgical planning.

Five exact duplicate BodyParts3D mesh records are omitted and their group references remapped. Four bone records and fourteen muscle records were corrected to their appropriate layers. Teeth/gingiva and iliotibial tracts were reassigned.

All adapted and authored geometry in this release is distributed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ . Retain these credits and disclose further modifications.

## Contour and fit refinement (2.2)

Further illustrative modifications apply a common localized field to the torso, shoulders and posterior surfaces. All 16 HRA breast pieces receive the same additional spatial fit within each breast. Original vertex counts, triangle indices, IDs and provenance remain intact. Normals follow the inverse-transpose Jacobian; normals at 39 repaired source coordinates are recomputed from the final faces. The largest thin-triangle repair is approximately 0.612 mm. Source tissues remain modified reference geometry, not newly validated anatomy.

The approach was informed by the published development notes for [wiiiimm's Human Atlas extension](https://github.com/wiiiimm/human-atlas/blob/main/docs/female-anatomy.md); that project's review made the limitations of broad reshaping clear. Its code and meshes were not imported. Parameters and the refinement implementation here were developed against this atlas's existing geometry. [NCI/SEER breast anatomy reading](https://training.seer.cancer.gov/anatomy/reproductive/female/glands.html) informs the general tissue relationship; it does not validate this fit. No stock illustration is reproduced.

See the repository's `docs/REFINEMENT.md` for reproducible baselines, parameters, actual mesh renders, checks and remaining limitations. BodyParts3D/HRA CC BY 4.0 attribution and the modification disclosure above apply to the refined geometry.

## Application
Adapted from Human Atlas by ashemag, MIT: https://github.com/ashemag/human-atlas . Application changes and new build scripts are MIT; geometry licenses remain separate.
