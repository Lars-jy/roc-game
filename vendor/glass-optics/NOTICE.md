# Glass optics attribution

The optical primitives in `src/vendor/glass-optics.js` adapt the vector-valued
`F_Schlick` function from three.js r160 `ShaderChunk/common.glsl.js` and the
`reflect(cameraToFrag, worldNormal)` environment-reflection construction from
`ShaderChunk/envmap_fragment.glsl.js`.

Copyright © 2010–2023 three.js authors. Distributed under the MIT License,
included here as `THREE-MIT.txt`. Upstream source copies are retained here.

- https://github.com/mrdoob/three.js/tree/r160
- https://github.com/mrdoob/three.js/blob/r160/src/renderers/shaders/ShaderChunk/common.glsl.js
- https://github.com/mrdoob/three.js/blob/r160/src/renderers/shaders/ShaderChunk/envmap_fragment.glsl.js

The R.O.C adaptation supplies independent measured glass masks and a small
procedural studio environment. It draws only transparent reflections: it does
not displace the approved cover image, reproduce bevels as dark polygons, or
sample the artwork with chromatic offsets. The original seams stay in the art.

The `gemFastChroma` per-channel ray-direction split also adapts the FAST_CHROMA
branch of pmndrs/drei `MeshRefractionMaterial`, by N8Programs, MIT. The source
copy and Drei's MIT license are retained here. We do not include its BVH tracing
or displace the cover; only the reflected light field gets separated RGB rays.
https://github.com/pmndrs/drei/blob/master/src/materials/MeshRefractionMaterial.tsx

Also reviewed: pmndrs/drei `MeshTransmissionMaterial` (MIT), which splits
refraction by wavelength; the complete material is not shipped or instantiated
because its volumetric distortion/FBO passes are unnecessary for this static
illustration. Its shader was reviewed as an implementation reference, not
presented as code included in this project.
https://github.com/pmndrs/drei/blob/master/src/core/MeshTransmissionMaterial.tsx
