import { readFileSync } from "node:fs";

const filePath = process.argv[2];
if (!filePath) throw new Error("Usage: node scripts/inspect-glb.mjs <file.glb>");

const file = readFileSync(filePath);
if (file.toString("utf8", 0, 4) !== "glTF") {
  throw new Error(`${filePath} is not a binary glTF file`);
}

let offset = 12;
let gltf = null;

while (offset < file.length) {
  const chunkLength = file.readUInt32LE(offset);
  const chunkType = file.readUInt32LE(offset + 4);
  const chunk = file.subarray(offset + 8, offset + 8 + chunkLength);

  if (chunkType === 0x4e4f534a) {
    gltf = JSON.parse(chunk.toString("utf8").replace(/\u0000+$/g, ""));
    break;
  }

  offset += 8 + chunkLength;
}

if (!gltf) throw new Error("GLB JSON chunk was not found");

const nodes = (gltf.nodes ?? []).map((node) => node.name).filter(Boolean);
const meshes = (gltf.meshes ?? []).map((mesh) => mesh.name).filter(Boolean);
const materials = (gltf.materials ?? [])
  .map((material) => material.name)
  .filter(Boolean);

const summarize = (values, predicate) => values.filter(predicate).sort();

console.log(JSON.stringify({
  file: filePath,
  bytes: file.length,
  counts: {
    scenes: gltf.scenes?.length ?? 0,
    nodes: gltf.nodes?.length ?? 0,
    meshes: gltf.meshes?.length ?? 0,
    materials: gltf.materials?.length ?? 0,
    textures: gltf.textures?.length ?? 0,
    images: gltf.images?.length ?? 0,
  },
  environmentNodes: summarize(nodes, (name) => /^(ENV|BAK|HELPER)_/.test(name)),
  nonEnvironmentNodeSample: summarize(nodes, (name) => !/^(ENV|BAK|HELPER)_/.test(name)).slice(0, 80),
  environmentMeshes: summarize(meshes, (name) => /^(GEO|BAK_GEO)_/.test(name)),
  materials: materials.sort(),
  materialDetails: (gltf.materials ?? []).map((material) => ({
    name: material.name,
    alphaMode: material.alphaMode ?? "OPAQUE",
    alphaCutoff: material.alphaCutoff,
    doubleSided: material.doubleSided ?? false,
    baseColorTexture: material.pbrMetallicRoughness?.baseColorTexture?.index,
    baseColorFactor: material.pbrMetallicRoughness?.baseColorFactor,
  })),
  textures: (gltf.textures ?? []).map((texture, index) => ({
    index,
    name: texture.name,
    source: texture.source,
    sampler: texture.sampler,
  })),
  images: (gltf.images ?? []).map((image, index) => ({
    index,
    name: image.name,
    mimeType: image.mimeType,
    bufferView: image.bufferView,
    uri: image.uri,
  })),
}, null, 2));
