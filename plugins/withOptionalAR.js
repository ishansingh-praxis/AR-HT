// Lets phones WITHOUT ARCore install the app (they get the 2D plan editor instead of AR).
// The AR library already sets <meta-data com.google.ar.core = optional>; this adds the matching
// <uses-feature android.hardware.camera.ar required="false">, so Play does not filter out non-AR phones.
// Order matters: Expo runs manifest mods last-listed first, so this plugin must be listed BEFORE "@reactvision/react-viro" in app.json
// (the AR plugin rewrites the uses-feature list, and this one has to run after it).
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withOptionalAR(config) {
  return withAndroidManifest(config, (c) => {
    const m = c.modResults.manifest;
    m.$['xmlns:tools'] ??= 'http://schemas.android.com/tools';
    m['uses-feature'] = (m['uses-feature'] ?? []).filter((x) => x.$['android:name'] !== 'android.hardware.camera.ar');
    m['uses-feature'].push({ $: { 'android:name': 'android.hardware.camera.ar', 'android:required': 'false', 'tools:replace': 'android:required' } });
    return c;
  });
};
