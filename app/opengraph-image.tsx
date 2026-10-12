import { ImageResponse } from 'next/og';

export const alt = 'Holiday Calendar, the example connector from the Small Business MCP Starter Kit';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The share card: paper, ink and one mustard highlighter line, the studio edition.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#fcfaf3', color: '#141210', padding: '72px 80px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 6, textTransform: 'uppercase', color: '#0f4c47' }}>Small Business MCP Starter Kit</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>Holiday Calendar for Claude.</div>
          <div style={{ display: 'flex', marginTop: 28, alignSelf: 'flex-start', background: '#f5b700', padding: '6px 18px', fontSize: 40, fontWeight: 700 }}>Open source. Fork it and ship yours.</div>
        </div>
        <div style={{ display: 'flex', fontSize: 28, borderTop: '3px solid #141210', paddingTop: 24 }}>Built by Modern Mustard Seed, Kalispell, Montana</div>
      </div>
    ),
    size,
  );
}
