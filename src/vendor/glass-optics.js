/** Optical primitives adapted from three.js r160, MIT, three.js authors.
 * F_Schlick is the upstream optimized Schlick approximation; reflect() follows
 * ShaderChunk/envmap_fragment.glsl.js. See vendor/glass-optics/NOTICE.md.
 * Original cover UVs are never refracted: only the reflected environment is.
 */
export const GLASS_OPTICS = /* glsl */`
vec3 F_Schlick(const in vec3 f0, const in float f90, const in float dotVH) {
  float fresnel = exp2((-5.55473 * dotVH - 6.98316) * dotVH);
  return f0 * (1.0 - fresnel) + (f90 * fresnel);
}
vec3 glassReflect(const in vec3 cameraToFrag, const in vec3 worldNormal) {
  return reflect(cameraToFrag, worldNormal);
}
// Adapted from pmndrs/drei MeshRefractionMaterial FAST_CHROMA (MIT),
// N8Programs' per-channel ray-direction separation. Only light is sampled.
void gemFastChroma(vec3 rayDirectionG,float aberrationStrength,out vec3 rayDirectionR,out vec3 rayDirectionB){
  rayDirectionR=normalize(rayDirectionG+vec3(aberrationStrength/2.0));
  rayDirectionB=normalize(rayDirectionG-vec3(aberrationStrength/2.0));
}
`;
