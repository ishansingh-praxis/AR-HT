import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Does this phone have ARCore / ARKit? Any failure (Expo Go, missing native module, old phone) counts as "no AR", and the app
 * then offers the 2D plan editor. Viro is loaded lazily: importing it in Expo Go logs errors because its native modules are missing.
 */
export async function checkARSupport(): Promise<boolean> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  try {
    const { isARSupportedOnDevice } = require('./viro') as typeof import('./viro');
    return (await isARSupportedOnDevice()).isARSupported === true;
  } catch { return false; }
}
