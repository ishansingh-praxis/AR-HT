// Native pieces the screens touch, replaced with small fakes so component tests run in plain Node.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => {}), deleteItemAsync: jest.fn(async () => {}) }));
jest.mock('expo-file-system', () => {
  class File { constructor(...a) { this.uri = 'file:///mock/' + a.map((x) => x?.uri ?? x).join('/'); this.exists = false; this.size = 0; } create() {} write() {} async text() { return '[]'; } async base64() { return ''; } delete() {} move() {} static async downloadFileAsync() { throw new Error('offline'); } }
  class Directory { constructor(...a) { this.uri = 'file:///mock/' + a.map((x) => x?.uri ?? x).join('/'); this.exists = true; } create() {} list() { return []; } }
  return { File, Directory, Paths: { document: { uri: 'doc' }, cache: { uri: 'cache' } } };
});
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ downloadAsync: async () => {}, localUri: 'file:///mock.glb', uri: 'file:///mock.glb' }) } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en', languageTag: 'en-IN' }] }));
jest.mock('expo-device', () => ({ totalMemory: 8 * 1024 ** 3, platformApiLevel: 34, modelId: 'iPhone14,2' }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@shopify/flash-list', () => { const { FlatList } = require('react-native'); return { FlashList: FlatList }; });
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
global.fetch = jest.fn(async () => { throw new Error('no network in tests'); });
jest.mock('@sentry/react-native', () => ({ init: jest.fn(), withScope: jest.fn(), captureException: jest.fn(), wrap: (c) => c }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
