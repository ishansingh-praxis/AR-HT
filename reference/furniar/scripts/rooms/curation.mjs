// Curated sample rooms, composed from real HomeTown products (by handle).
// Coordinates: centimetres in the room's own frame. Origin = top-left corner, x to the right, z down the plan.
// Piece centre (x, z); rot = direction the piece FACES: 0 faces +z (down the plan), 180 faces -z, 90 faces +x, -90 faces -x.
// Collections are kept together on purpose (Nova bedroom, Oren dining) because the catalogue's families are designed to match.

export const ROOMS = [
  {
    id: 'living-modern', title: 'Modern living room', roomType: 'living', style: ['modern'],
    blurb: 'A sofa-first layout: sofa on the long wall, 45 cm to the coffee table, TV opposite, two chairs closing the conversation circle.',
    room: { w: 450, d: 380 },
    pieces: [
      { h: 'icon-velvet-3-seater-sofa-beige', x: 225, z: 45, rot: 0, anchor: true },
      { h: 'maysville-glass-top-center-table-in-walnut-colour', x: 225, z: 165, rot: 0 },
      { h: 'concerto-tv-unit-light-grey', x: 225, z: 360, rot: 180 },
      { h: 'nixa-side-table', x: 354, z: 26, rot: 0 },
      { h: 'jane-velvet-accent-chair-in-blue', x: 395, z: 215, rot: -90 },
      { h: 'jane-velvet-accent-chair-in-sea-beige', x: 55, z: 215, rot: 90 },
    ],
  },
  {
    id: 'bedroom-nova', title: 'Nova bedroom', roomType: 'bedroom', style: ['contemporary'],
    blurb: 'Bed centred on the headboard wall with matching night stands, wardrobe at the foot, dresser on the side wall. All from the Nova collection.',
    room: { w: 420, d: 380 },
    pieces: [
      { h: 'nova-queen-bed-hydraulic-storage', x: 210, z: 113, rot: 0, anchor: true },
      { h: 'nova-night-stand', x: 101, z: 21, rot: 0 },
      { h: 'nova-night-stand', x: 319, z: 21, rot: 0 },
      { h: 'nova-3-door-wardrobe', x: 210, z: 354, rot: 180 },
      { h: 'nova-dresser-with-full-length-mirror', x: 400, z: 290, rot: -90 },
    ],
  },
  {
    id: 'dining-oren', title: 'Oren dining room', roomType: 'dining', style: ['modern'],
    blurb: 'Six-seater table centred in the room with a chair on each side and one at each end, 5 cm pulled out so chairs can slide.',
    room: { w: 400, d: 360 },
    pieces: [
      { h: 'oren-sintered-stone-6-seater-dinning-table', x: 200, z: 180, rot: 0, anchor: true },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 155, z: 106, rot: 0 },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 245, z: 106, rot: 0 },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 155, z: 254, rot: 180 },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 245, z: 254, rot: 180 },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 81, z: 180, rot: 90 },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 319, z: 180, rot: -90 },
    ],
  },
  {
    id: 'study-compact', title: 'Compact study', roomType: 'study', style: ['minimal'],
    blurb: 'Desk and bookshelf share the window wall, with a reading chair and side table in the corner.',
    room: { w: 320, d: 300 },
    notes: 'Office chairs in the export have no height, so the desk chair is a dining chair (one of a set of 2).',
    pieces: [
      { h: 'scholarhub-study-table', x: 130, z: 29, rot: 0, anchor: true },
      { h: 'velmont-bookshelf', x: 225, z: 30, rot: 0 },
      { h: 'mio-dinning-chair-set-of-2', x: 130, z: 91, rot: 180 },
      { h: 'charm-velvet-arm-chair-in-dark-grey-colour-copy', x: 40, z: 220, rot: 90 },
      { h: 'nixa-side-table', x: 101, z: 220, rot: 0 },
    ],
  },
];
