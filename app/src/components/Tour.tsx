import { useTour } from '../context/TourContext';

export default function Tour() {
  const tour = useTour();

  if (!tour.active) {
    return (
      <button
        onClick={tour.start}
        title="Guía de la plataforma"
        style={{
          position: 'fixed',
          bottom: 22,
          right: 22,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#FFCD02',
          border: 'none',
          boxShadow: '0 4px 0 0 #000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 900,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6"></path>
          <path d="M10 22h4"></path>
          <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1v.2h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"></path>
        </svg>
      </button>
    );
  }

  return (
    <>
      <div style={tour.highlightStyle} />
      <div style={tour.cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#FFCD02', textTransform: 'uppercase' }}>
            PASO {tour.stepNum} / {tour.stepTotal}
          </span>
          <button onClick={tour.close} style={{ background: 'none', border: 'none', color: '#8a8a90', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0 }}>
            ✕
          </button>
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 8, letterSpacing: '-0.01em' }}>{tour.title}</h3>
        <p style={{ fontSize: 13, color: '#c8c8ce', lineHeight: 1.55, marginBottom: 18 }}>{tour.text}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <button
            onClick={tour.prev}
            disabled={tour.isFirst}
            style={{
              background: 'transparent',
              border: '1px solid #333',
              color: tour.isFirst ? '#555' : '#aeaeb3',
              opacity: tour.isFirst ? 0.5 : 1,
              cursor: tour.isFirst ? 'not-allowed' : 'pointer',
              padding: '9px 14px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            ← ANTERIOR
          </button>
          <button
            onClick={tour.next}
            style={{
              background: '#FFCD02',
              color: '#000',
              border: 'none',
              padding: '9px 16px',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {tour.isLast ? 'FINALIZAR' : 'SIGUIENTE →'}
          </button>
        </div>
      </div>
    </>
  );
}
