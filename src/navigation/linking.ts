import type { LinkingOptions } from '@react-navigation/native';
import { SHARE_DOMAIN } from '../config';
import type { RootStackParamList } from './AppNavigator';

/**
 * hometownar://d/<slug>            a shared design
 * hometownar://item/<id>           a product
 * https://<SHARE_DOMAIN>/d/<slug>  the same, via universal / app links (configured in app.config.js)
 * Opening a link keeps Tabs underneath, so Back goes to the app, not out of it.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['hometownar://', ...(SHARE_DOMAIN ? [`https://${SHARE_DOMAIN}`] : [])],
  config: {
    initialRouteName: 'Tabs',
    screens: { SharedDesign: 'd/:slug', Item: 'item/:id' },
  },
};
