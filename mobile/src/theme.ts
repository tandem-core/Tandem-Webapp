// Direction C: warm cream canvas, white cards, forest green with coral for Record and
// Lisa's "New". Young Serif for headings, Outfit for everything else. Readable for Mary
// (75): body text 17-18px, anything tappable at least 44px.
export const colors = {
  canvas: '#FFF6EC',
  surface: '#FFFFFF',
  line: '#ECE0D1',
  forest: '#174B3C',
  forestSoft: '#E8F1EC',
  coral: '#D95B3E',
  coralDeep: '#AC3E24',
  recRed: '#D6342C',
  amberBg: '#FDF6E3',
  amberLine: '#E2BE6B',
  amberInk: '#643F08',
  ink: '#1C3026',
  muted: '#55685E',
};

// Loaded in app/_layout.tsx. Each weight is its own family so Android picks the right one.
export const fonts = { serif: 'YoungSerif', regular: 'Outfit400', medium: 'Outfit500', semibold: 'Outfit600', bold: 'Outfit700' };

// Slightly uneven corners, as in the prototype.
export const radius = {
  card: { borderTopLeftRadius: 22, borderTopRightRadius: 26, borderBottomRightRadius: 24, borderBottomLeftRadius: 22 },
  button: { borderTopLeftRadius: 15, borderTopRightRadius: 17, borderBottomRightRadius: 15, borderBottomLeftRadius: 17 },
};

// Minimum height for anything tappable.
export const touch = 48;

// Space under scrolling content so the floating dock never covers it.
export const dockSpace = 112;
