export const colors = {
  bg: '#F3F5F4', surface: '#FFFFFF', ink: '#14211F', muted: '#6B7A77', line: '#DCE3E1',
  accent: '#2F6F5E', accentInk: '#FFFFFF', danger: '#B3402F', warn: '#8A6A00',
};
export const formatPrice = (n: number) => `₹${n.toLocaleString('en-IN')}`;
export const ROOM_LABEL: Record<string, string> = { living: 'Living room', bedroom: 'Bedroom', dining: 'Dining room', study: 'Study', other: 'Other' };
