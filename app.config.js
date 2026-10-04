// Extends app.json. Cloud anchors ("Pin to room") switch on only when ReactVision credentials are provided:
//   RV_API_KEY=... RV_PROJECT_ID=... EXPO_PUBLIC_CLOUD_ANCHORS=1 npx expo prebuild --clean
// (keys come from https://studio.reactvision.xyz). Without them the AR provider is "none" and the Pin button is hidden.
module.exports = ({ config }) => {
  const key = process.env.RV_API_KEY, project = process.env.RV_PROJECT_ID;
  const cloud = !!(key && project);
  // Plain-http API calls (a laptop on your Wi-Fi) are allowed only in development builds: APP_ENV=development.
  const dev = process.env.APP_ENV === 'development';
  const plugins = (config.plugins ?? []).map((p) => {
    if (Array.isArray(p) && p[0] === 'expo-build-properties') {
      return ['expo-build-properties', { ...p[1], android: { ...p[1]?.android, usesCleartextTraffic: dev } }];
    }
    if (Array.isArray(p) && p[0] === '@reactvision/react-viro') {
      return ['@reactvision/react-viro', {
        ...p[1],
        provider: cloud ? 'reactvision' : 'none',
        ...(cloud ? { rvApiKey: key, rvProjectId: project } : {}),
        ios: {
          cameraUsagePermission: 'HomeTown uses the camera to place furniture in your room. Camera images stay on your phone.',
          savePhotosPermission: 'HomeTown saves the photos and videos you take of your room design to Photos.',
          // The AR library adds these two keys by default. We never read your library or record sound, and the text says so.
          photosPermission: 'HomeTown only saves photos to your library. It never reads your photos.',
          microphoneUsagePermission: 'HomeTown records silent videos of your room design. It does not use the microphone.',
        },
      }];
    }
    return p;
  });
  // Universal / app links: https://<SHARE_DOMAIN>/d/* and /item/* open the app. Needs the server's /.well-known files (docs/SHARING.md).
  const domain = (process.env.SHARE_DOMAIN ?? process.env.EXPO_PUBLIC_SHARE_DOMAIN ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const ios = { ...config.ios, ...(domain ? { associatedDomains: [`applinks:${domain}`] } : {}) };
  const android = {
    ...config.android,
    ...(domain ? {
      intentFilters: [{
        action: 'VIEW', autoVerify: true,
        data: [{ scheme: 'https', host: domain, pathPrefix: '/d/' }, { scheme: 'https', host: domain, pathPrefix: '/item/' }],
        category: ['BROWSABLE', 'DEFAULT'],
      }],
    } : {}),
  };
  // Crash reporting with readable stack traces: the Sentry plugin uploads source maps during EAS builds. It is added only when
  // SENTRY_ORG and SENTRY_PROJECT are set (and SENTRY_AUTH_TOKEN is an EAS secret), so builds without Sentry are unaffected.
  if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
    plugins.push(['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }]);
  }
  return { ...config, ios, android, plugins };
};
