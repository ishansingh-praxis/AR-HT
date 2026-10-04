const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// 3D models are bundled as assets (the simplified true-scale shapes in assets/proxy).
for (const ext of ['glb', 'gltf']) if (!config.resolver.assetExts.includes(ext)) config.resolver.assetExts.push(ext);
module.exports = config;
