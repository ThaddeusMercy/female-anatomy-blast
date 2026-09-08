# Model coverage — Female Anatomy Blast 2.1

This is an inventory of the illustration, not a certification of anatomical accuracy.

## What changed

The model now contains 2,353 selectable pieces: 2,195 adapted BodyParts3D pieces, 76 fitted HRA female-reference pieces and 82 authored schematics.

- Corrected 14 muscle meshes that were in the skeletal layer.
- Moved both lacrimal bones and both inferior nasal conchae into the skeletal layer.
- Moved teeth/gingiva into the digestive layer and iliotibial tracts into connective tissue.
- Removed five byte-identical duplicate meshes and repaired group memberships.
- Added left and right uterine arteries from the HRA female reference.
- Added 81 new schematic pieces; the existing schematic urethra remains labelled.

## Added study anatomy

| Structures | Representation |
| --- | --- |
| Left and right uterine arteries | HRA female-reference surfaces; fitted to the pelvis |
| Malleus, incus and stapes on both sides | Six small teaching schematics |
| Clitoral glans, body and paired crura | Schematic |
| Labia majora/minora, mons pubis, vestibular bulbs, vestibule boundary | Schematic; vestibule shown as a boundary, not a solid organ |
| Bartholin and Skene glands | Schematic |
| Bulbospongiosus and ischiocavernosus muscles | Schematic |
| External urethral sphincter, compressor urethrae, urethrovaginal sphincter | Schematic components, not detailed muscle architecture |
| Ovarian arteries/veins, internal pudendal arteries, pudendal nerves | Simplified main routes; not complete branch networks |
| Endometrium and myometrium | Overlapping, isolatable teaching layers; not segmented tissue boundaries |
| Thyroid lobes/isthmus and four typical parathyroid positions | Schematic; parathyroid variation is not represented |
| Cervical, axillary and inguinal lymph nodes | 26 representative nodes; not the actual number or distribution in a body |
| Local lymphatic vessels, thoracic duct and right lymphatic duct | Simplified examples; no complete drainage network |

## The 206-bone checklist

The standard adult naming checklist now has 206 represented entries: **200 reference-based + 6 schematic ear bones**. The six ossicles are included in the skeletal layer. The adult sternum, sacrum, coccyx and each hip bone are counted once even when represented by multiple tissue meshes. Teeth and variable accessory sesamoids are excluded from this conventional count.

[Download the checklist](bone-checklist.csv). It includes the mesh IDs, layer and provenance for each entry. [Machine-readable audit](inventory-audit.json).

The skeletal layer contains 269 pieces because it also includes separately modeled components and joint-related tissues. Neither that number nor the whole model's mesh count is a bone count.

## What is still missing or unverified

- A complete female skin envelope and external body-surface reference.
- Fine terminal neurovascular branches, complete lymphatic drainage, microscopic anatomy and physiological variation.
- Reference-quality geometry for the structures currently labelled schematic.
- Specialist validation of body-shape changes, sex-specific skeletal morphology, muscle attachments and cross-source registration.
- Independently verified connections where HRA female organs meet the adapted urinary, vascular, nervous and musculoskeletal structures.

This is an introductory, evolving study tool. It should not be used for diagnosis, surgical planning, measurements, or as the sole reference for detailed anatomy instruction.

## Reading and source references

- [Human Reference Atlas female dataset](https://doi.org/10.48539/HBM352.BTSQ.586)
- [NIH/NIDCD: parts of the ear](https://www.nidcd.nih.gov/news/multimedia/medical-illustration-parts-ear)
- [NCBI Bookshelf: female external genitalia](https://www.ncbi.nlm.nih.gov/books/NBK547703/)
- [NCBI Bookshelf: superficial perineal space](https://www.ncbi.nlm.nih.gov/books/NBK542289/)
- [NCBI Bookshelf: pudendal nerve](https://www.ncbi.nlm.nih.gov/books/NBK554736/)
- [NCBI Bookshelf: thyroid gland](https://www.ncbi.nlm.nih.gov/books/NBK551659/)
- [NCBI Bookshelf: thoracic duct](https://www.ncbi.nlm.nih.gov/books/NBK513227/)

Reading references support learning; they do not validate the geometry or endorse this project. See [asset credits](ATTRIBUTION.md).
