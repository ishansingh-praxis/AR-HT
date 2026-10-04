// Curated sample rooms, composed from real HomeTown products (by catalogue id). Units: centimetres, room frame:
// origin = top-left corner, x to the right, z down the plan. rot = direction the piece FACES: 0 faces +z, 180 faces -z,
// 90 faces +x, -90 faces -x.
// A piece is either absolute { h, x, z, rot } or against a wall { h, wall: 'top'|'bottom'|'left'|'right', at, gap }:
// it faces into the room, `at` is the position along that wall (x for top/bottom, z for left/right) and `gap` the space to the wall.
// Collections are kept together on purpose (Nova bedroom, Oren dining) because the catalogue's collections are designed to match.
// `door` (optional): where people enter, { wall, at }. Default: centre of the wall opposite the anchor.

export const ROOMS = [
  {
    id: 'living-modern', title: 'Modern living room', roomType: 'living', style: ['modern'], room: { w: 450, d: 380 },
    blurb: 'A sofa-first layout: sofa on the long wall, 45 cm to the coffee table, TV opposite, two chairs closing the conversation circle.',
    door: { wall: 'bottom', at: 60 },
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
    id: 'living-compact', title: 'Compact living room', roomType: 'living', style: ['modern', 'minimal'], room: { w: 300, d: 300 },
    blurb: 'A 9 m² living room: a two-seater on the top wall, a low coffee table 45 cm away and a slim TV unit opposite.',
    door: { wall: 'bottom', at: 30 },
    pieces: [
      { h: 'faro-fabric-2-seater-sofa-blue', wall: 'top', at: 150, gap: 0, anchor: true },
      { h: 'orion-center-table', x: 150, z: 151, rot: 0 },
      { h: 'opus-tv-unit', wall: 'bottom', at: 150, gap: 0 },
      { h: 'ornate-marble-top-side-table', x: 257, z: 23, rot: 0 },
    ],
  },
  {
    id: 'living-grand', title: 'Grand living room', roomType: 'living', style: ['classic', 'contemporary'], room: { w: 500, d: 500 },
    blurb: 'A 25 m² room built around a four-seater: two armchairs face each other across a wide coffee table, TV on the far wall.',
    door: { wall: 'bottom', at: 60 },
    pieces: [
      { h: 'grace-fabric-4-seater-sofa-grey', wall: 'top', at: 250, gap: 0, anchor: true },
      { h: 'bliss-marble-top-center-table-in-beige-colour', x: 250, z: 167, rot: 0 },
      { h: 'concerto-tv-unit-light-grey', wall: 'bottom', at: 250, gap: 0 },
      { h: 'charm-velvet-arm-chair-in-dark-grey-colour-copy', wall: 'left', at: 250, gap: 5 },
      { h: 'charm-velvet-arm-chair-in-dark-grey-colour-copy', wall: 'right', at: 250, gap: 5 },
      { h: 'ornate-marble-top-side-table', x: 411, z: 23, rot: 0 },
    ],
  },
  {
    id: 'bedroom-nova', title: 'Nova bedroom', roomType: 'bedroom', style: ['contemporary'], room: { w: 420, d: 380 },
    blurb: 'Bed centred on the headboard wall with matching night stands, wardrobe at the foot, dresser on the side wall. All from the Nova collection.',
    door: { wall: 'left', at: 200 },
    pieces: [
      { h: 'nova-queen-bed-hydraulic-storage', x: 210, z: 113, rot: 0, anchor: true },
      { h: 'nova-night-stand', x: 101, z: 21, rot: 0 },
      { h: 'nova-night-stand', x: 319, z: 21, rot: 0 },
      { h: 'nova-3-door-wardrobe', x: 210, z: 354, rot: 180 },
      { h: 'nova-dresser-with-full-length-mirror', x: 400, z: 290, rot: -90 },
    ],
  },
  {
    id: 'bedroom-cosy', title: 'Cosy bedroom', roomType: 'bedroom', style: ['contemporary'], room: { w: 340, d: 360 },
    blurb: 'A 12 m² bedroom: queen bed on the headboard wall, a night stand each side, a three-door wardrobe at the foot.',
    door: { wall: 'right', at: 250 },
    pieces: [
      { h: 'asa-nx-queen-bed-with-hydraulic-strge', wall: 'top', at: 170, gap: 0, anchor: true },
      { h: 'cascade-night-stand-new', x: 58.5, z: 20, rot: 0 },
      { h: 'cascade-night-stand-new', x: 281.5, z: 20, rot: 0 },
      { h: 'swirl-3-door-wardrobe-wenge', wall: 'bottom', at: 170, gap: 0 },
    ],
  },
  {
    id: 'bedroom-stellar', title: 'Stellar master bedroom', roomType: 'bedroom', style: ['modern', 'glossy'], room: { w: 400, d: 400 },
    blurb: 'A 16 m² master bedroom in the Stellar high-gloss set: bed, night stands, four-door wardrobe and a chest of drawers on the side wall.',
    door: { wall: 'bottom', at: 345 },
    pieces: [
      { h: 'stellar-queen-bed-with-hydraulic-storage-in-high-gloss-white', wall: 'top', at: 200, gap: 0, anchor: true },
      { h: 'stellar-night-stand-in-high-gloss-white', x: 88, z: 20.1, rot: 0 },
      { h: 'stellar-night-stand-in-high-gloss-white', x: 312, z: 20.1, rot: 0 },
      { h: 'stellar-4-door-wardrobe-in-high-gloss-white', wall: 'bottom', at: 200, gap: 0 },
      { h: 'stellar-chest-of-5-drawers-in-high-gloss-white', wall: 'right', at: 250, gap: 0 },
    ],
  },
  {
    id: 'dining-oren', title: 'Oren dining room', roomType: 'dining', style: ['modern'], room: { w: 400, d: 360 },
    blurb: 'Six-seater table centred in the room with a chair on each side and one at each end, 5 cm pulled out so chairs can slide.',
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
    id: 'dining-fauna', title: 'Fauna dining room', roomType: 'dining', style: ['modern'], room: { w: 400, d: 400 },
    blurb: 'A 16 m² dining room: six-seater in the middle, a chair on every side and a long display shelf on the left wall.',
    pieces: [
      { h: 'fauna-sintered-stone-6-seater-dinning-table', x: 200, z: 200, rot: 0, anchor: true },
      { h: 'mio-dinning-chair-set-of-2', x: 160, z: 127, rot: 0 },
      { h: 'mio-dinning-chair-set-of-2', x: 240, z: 127, rot: 0 },
      { h: 'mio-dinning-chair-set-of-2', x: 160, z: 273, rot: 180 },
      { h: 'mio-dinning-chair-set-of-2', x: 240, z: 273, rot: 180 },
      { h: 'mio-dinning-chair-set-of-2', x: 92, z: 200, rot: 90 },
      { h: 'mio-dinning-chair-set-of-2', x: 308, z: 200, rot: -90 },
      { h: 'regalia-bookshelf', wall: 'left', at: 200, gap: 0 },
    ],
  },
  {
    id: 'dining-grand', title: 'Grand dining room', roomType: 'dining', style: ['classic'], room: { w: 500, d: 500 },
    blurb: 'A 25 m² dining room: the Oren six-seater with six chairs, a display shelf on the top wall and a console on the right wall.',
    pieces: [
      { h: 'oren-sintered-stone-6-seater-dinning-table', x: 250, z: 250, rot: 0, anchor: true },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 205, z: 176, rot: 0 },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 295, z: 176, rot: 0 },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 205, z: 324, rot: 180 },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 295, z: 324, rot: 180 },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 131, z: 250, rot: 90 },
      { h: 'oren-dinning-chair-set-of-2-beige', x: 369, z: 250, rot: -90 },
      { h: 'regalia-bookshelf', wall: 'top', at: 250, gap: 0 },
      { h: 'aristotle-solidwood-console-table', wall: 'right', at: 250, gap: 0 },
    ],
  },
  {
    id: 'study-compact', title: 'Compact study', roomType: 'study', style: ['minimal'], room: { w: 320, d: 300 },
    blurb: 'Desk and bookshelf share the window wall, with a reading chair and side table in the corner.',
    notes: 'Office chairs in the export have no height, so the desk chair is a dining chair (one of a set of 2).',
    pieces: [
      { h: 'scholarhub-study-table', x: 130, z: 29, rot: 0, anchor: true },
      { h: 'velmont-bookshelf', x: 225, z: 30, rot: 0 },
      { h: 'mio-dinning-chair-set-of-2', x: 130, z: 91, rot: 180 },
      { h: 'charm-velvet-arm-chair-in-dark-grey-colour-copy', x: 40, z: 220, rot: 90 },
      { h: 'nixa-side-table', x: 101, z: 220, rot: 0 },
    ],
  },
  {
    id: 'study-nook', title: 'Study nook', roomType: 'study', style: ['minimal'], room: { w: 300, d: 300 },
    blurb: 'A 9 m² study: desk and a slim bookshelf on the top wall, a reading chair with its side table on the left.',
    notes: 'The desk chair is a dining chair (one of a set of 2): office chairs in the export have no usable height.',
    pieces: [
      { h: 'scholarhub-study-table', wall: 'top', at: 100, gap: 0, anchor: true },
      { h: 'mio-dinning-chair-set-of-2', x: 100, z: 91, rot: 180 },
      { h: 'elara-bookshelf', wall: 'top', at: 235, gap: 0 },
      { h: 'charm-velvet-arm-chair-in-dark-grey-colour-copy', wall: 'left', at: 230, gap: 0 },
      { h: 'nixa-side-table', x: 22.25, z: 154, rot: 0 },
    ],
  },
  {
    id: 'study-library', title: 'Study with library wall', roomType: 'study', style: ['classic'], room: { w: 340, d: 350 },
    blurb: 'A 12 m² study: a long bookshelf along the left wall, desk beside it, a reading chair and side table on the right.',
    notes: 'The desk chair is a dining chair (one of a set of 2): office chairs in the export have no usable height.',
    door: { wall: 'bottom', at: 170 },
    pieces: [
      { h: 'scholarhub-study-table', wall: 'top', at: 120, gap: 0, anchor: true },
      { h: 'mio-dinning-chair-set-of-2', x: 120, z: 91, rot: 180 },
      { h: 'regalia-bookshelf', wall: 'left', at: 175, gap: 0 },
      { h: 'charm-velvet-arm-chair-in-dark-grey-colour-copy', wall: 'right', at: 250, gap: 0 },
      { h: 'nixa-side-table', x: 317.75, z: 174.25, rot: 0 },
    ],
  },
];
