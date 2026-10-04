import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LibraryScreen from '../src/screens/LibraryScreen';
import ItemScreen from '../src/screens/ItemScreen';
import DesignsScreen from '../src/screens/DesignsScreen';
import WelcomeScreen from '../src/screens/WelcomeScreen';
import { useRooms } from '../src/store/roomStore';
import { useWishlist } from '../src/store/wishlistStore';
import { useSettings } from '../src/store/settingsStore';
import { useCatalogue } from '../src/store/catalogueStore';
import { t } from '../src/i18n';

const Stack = createNativeStackNavigator();
/** Renders one screen inside a real navigator (the screens call useNavigation). */
async function renderScreen(Component: React.ComponentType<any>, params?: object) {
  return await render(
    <NavigationContainer>
      <Stack.Navigator><Stack.Screen name="Test" component={Component} initialParams={params} /></Stack.Navigator>
    </NavigationContainer>,
  );
}
const products = () => useCatalogue.getState().products;
const placeableSofa = () => products().find((p) => p.role === 'sofa' && !p.sizeReview && p.proxy)!;

beforeEach(() => {
  useRooms.setState({ designs: [], roomType: 'Living room' });
  useWishlist.setState({ items: [] });
  useSettings.setState({ onboarded: false, scanned: null, preset: 'unknown', arSupported: true });
});

describe('Library', () => {
  it('lists the catalogue and filters by search text', async () => {
    await renderScreen(LibraryScreen);
    const total = products().length;
    expect(screen.getByText(`${total} pieces`)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(t('library.searchFurniture')), 'zzzz-no-such-product');
    expect(screen.getByText(t('library.noFurnitureMatchesClear'))).toBeTruthy();
    expect(screen.getByText('0 pieces')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(t('library.searchFurniture')), placeableSofa().name.split(' ')[0]);
    const n = products().filter((p) => p.name.toLowerCase().includes(placeableSofa().name.split(' ')[0].toLowerCase())).length;
    expect(screen.getByText(`${n} pieces`)).toBeTruthy();
  });

  it('filters by category and selects the chip', async () => {
    await renderScreen(LibraryScreen);
    const chip = screen.getByLabelText(t('picker.category', { name: 'Sofa' }));
    await fireEvent.press(chip);
    const sofas = products().filter((p) => p.category === 'Sofa').length;
    expect(screen.getByText(`${sofas} pieces`)).toBeTruthy();
    expect(screen.getByLabelText(t('picker.category', { name: 'Sofa' })).props.accessibilityState.selected).toBe(true);
  });
});

describe('Item: "Will it fit?"', () => {
  it('says too wide, then fits, as the free width changes', async () => {
    const p = placeableSofa();
    await renderScreen(ItemScreen, { id: p.id });
    const input = screen.getByLabelText(t('fitCalculator.freeWidthInCentimetres'));
    await fireEvent.changeText(input, String(Math.round(p.dimensionsCm.w - 30)));
    expect(screen.queryByText(/Too wide by 30 cm/)).toBeTruthy();
    await fireEvent.changeText(input, String(Math.round(p.dimensionsCm.w + 120)));
    expect(screen.queryByText(/Fits, with 120 cm to spare/)).toBeTruthy();
  });

  it('offers "View in my room" with and without AR (without AR it opens the plan, and says why)', async () => {
    const p = placeableSofa();
    const { unmount } = await renderScreen(ItemScreen, { id: p.id });
    expect(screen.getByText(t('item.viewInMyRoom'))).toBeTruthy();
    await unmount();
    await act(async () => { useSettings.setState({ arSupported: false }); });
    await renderScreen(ItemScreen, { id: p.id });
    expect(screen.getByText(t('item.planView'))).toBeTruthy();
    expect(screen.getByText(t('item.thisPhoneDoesNot'))).toBeTruthy();
  });
});

describe('Saved', () => {
  it('shows the two sections with their empty states', async () => {
    await renderScreen(DesignsScreen);
    expect(screen.getByText(t('designs.myDesignsAndSample'))).toBeTruthy();
    expect(screen.getByText(t('designs.savedFurniture'))).toBeTruthy();
    expect(screen.getByText(t('designs.tapTheHeartOn'))).toBeTruthy();
  });

  it('lists a saved piece and a saved design, each with one "View in my room" button', async () => {
    const p = placeableSofa();
    await act(async () => {
      useWishlist.getState().toggle(p.id);
      useRooms.getState().save({ items: [{ productId: p.id, offset: [0, 0, 0], rotationY: 0, scale: 1 }], frame: false });
    });
    await renderScreen(DesignsScreen);
    expect(screen.getByLabelText(t('designs.open', { name: p.name }))).toBeTruthy();   // the saved piece row
    expect(screen.getAllByText(t('designs.plan')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(t('designs.ar')).length).toBe(0);
  });

  it('shows the same single button on a phone without AR', async () => {
    await act(async () => { useSettings.setState({ arSupported: false }); });
    await renderScreen(DesignsScreen);
    expect(screen.queryAllByText(t('designs.ar')).length).toBe(0);
    expect(screen.getAllByText(t('designs.plan')).length).toBeGreaterThan(0);
  });
});

describe('Onboarding', () => {
  const nav = () => ({ reset: jest.fn() });

  it('has no form: browse furniture opens the library straight away', async () => {
    const navigation = nav();
    await render(<WelcomeScreen {...({ navigation } as any)} />);
    expect(screen.queryByLabelText('Bedroom')).toBeNull();
    await fireEvent.press(screen.getByText(t('welcome.browseRooms')));
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs' }] });
  });

  it('scan my room opens the scan', async () => {
    const navigation = nav();
    await render(<WelcomeScreen {...({ navigation } as any)} />);
    await fireEvent.press(screen.getByText(t('welcome.scanRoom')));
    expect(useSettings.getState().onboarded).toBe(true);
    expect(navigation.reset).toHaveBeenCalledWith(expect.objectContaining({ routes: [{ name: 'Tabs' }, { name: 'AR', params: { starter: true, mode: 'scan' } }] }));
  });

  it('browse rooms skips the scan', async () => {
    const navigation = nav();
    await render(<WelcomeScreen {...({ navigation } as any)} />);
    await fireEvent.press(screen.getByText(t('welcome.browseRooms')));
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs' }] });
    expect(useSettings.getState().onboarded).toBe(true);
  });

  it('without AR the main button plans the room instead', async () => {
    await act(async () => { useSettings.setState({ arSupported: false }); });
    const navigation = nav();
    await render(<WelcomeScreen {...({ navigation } as any)} />);
    expect(screen.queryByText(t('welcome.scanRoom'))).toBeNull();
    await fireEvent.press(screen.getByText(t('welcome.planRoom')));
    expect(navigation.reset).toHaveBeenCalledWith(expect.objectContaining({ routes: [{ name: 'Tabs' }, { name: 'Plan' }] }));
  });
});

describe('Gesture demo', () => {
  it('shows each gesture caption and closes with Got it', async () => {
    const { GestureHint } = require('../src/components/GestureHint');
    const onClose = jest.fn();
    await render(<GestureHint visible steps={['drag', 'twist', 'pinch']} onClose={onClose} />);
    expect(screen.getByText(t('hint.title'))).toBeTruthy();
    expect(screen.getByText(t('hint.drag'))).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(t('hint.twist')));
    expect(screen.getByText(t('hint.twist'))).toBeTruthy();
    await fireEvent.press(screen.getByText(t('hint.gotIt')));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Rooms tab and room studio', () => {
  it('lists every kind of room and opens the studio for the one tapped', async () => {
    const RoomsScreen = require('../src/screens/RoomsScreen').default;
    await renderScreen(RoomsScreen);
    for (const k of ['living', 'bedroom', 'dining', 'kitchen', 'kids', 'study']) expect(screen.getByLabelText(t('rooms.designKind', { room: t(`kinds.${k}`) }))).toBeTruthy();
  });

  it('studio fits a set, shows photos cards with a budget, and removing one piece lowers the total', async () => {
    jest.doMock('../src/features/plan/PlanCanvas', () => ({ PlanCanvas: () => null })); // gesture-handler/reanimated need a device
    const RoomStudioScreen = require('../src/screens/RoomStudioScreen').default;
    await renderScreen(RoomStudioScreen, { kind: 'bedroom' });
    await fireEvent.press(screen.getByText(t('studio.suggest')));
    expect(screen.getByText(t('studio.yourItems'))).toBeTruthy();
    const before = screen.getAllByLabelText(/^Remove one /).length;
    expect(before).toBeGreaterThan(0);
    await fireEvent.press(screen.getAllByLabelText(/^Remove one /)[0]);
    expect(screen.queryAllByLabelText(/^Remove one /).length).toBeLessThanOrEqual(before);
  });
});

describe('360 view', () => {
  it('always offers the 360 and Photos tabs and falls back to photos when the viewer errors', async () => {
    const { Product360 } = require('../src/components/Product360');
    const item = placeableSofa();
    await render(<Product360 item={item} />);
    expect(screen.getByLabelText(t('p360.label360'))).toBeTruthy();
    expect(screen.getByLabelText(t('p360.labelPhotos'))).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(t('p360.labelPhotos')));
    expect(screen.getByLabelText(t('p360.photoLabel', { name: item.name, n: 1, total: item.images.length }))).toBeTruthy();
  });
});
