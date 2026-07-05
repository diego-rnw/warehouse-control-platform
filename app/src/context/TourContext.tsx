import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface TourStep {
  path: string;
  target: string;
  title: string;
  text: string;
}

const TOUR_STEPS: TourStep[] = [
  { path: '/dashboard', target: 'dash-stats', title: 'Estatus de un vistazo', text: 'Estas tarjetas resumen el período filtrado. Haz click en una para filtrar la lista y las tablas por ese estatus — click de nuevo para quitar el filtro.' },
  { path: '/dashboard', target: 'dash-trend', title: 'Tendencia de fricción', text: 'El % de requisiciones con ajuste o diferencia, mes a mes. Sirve para detectar si la fricción operativa sube o baja con el tiempo.' },
  { path: '/dashboard', target: 'dash-products', title: 'Desglose de productos', text: 'Cantidad total, número de requisiciones e importe por producto entregado en el período — útil para detectar consumo inusual.' },
  { path: '/requisiciones', target: 'req-search', title: 'Busca por folio', text: 'Encuentra una requisición específica sin desplazarte por toda la lista.' },
  { path: '/requisiciones', target: 'req-upload', title: 'Fase 1 — Sube el Excel de Foodbot', text: 'Sube el archivo exportado por Foodbot y elige la sucursal destino. Se crea la requisición pendiente de captura de entrega.' },
  { path: '/requisiciones', target: 'req-row', title: 'Fase 2 — Conciliación', text: 'Expande una requisición para comparar lo entregado contra lo pedido, capturar la entrega vía QR y documentar ajustes cuando haya diferencias.' },
  { path: '/comparativo', target: 'comp-months', title: 'Compara dos meses', text: 'Elige dos períodos para comparar cada sucursal contra sí misma en el tiempo — nunca contra otra sucursal.' },
  { path: '/comparativo', target: 'comp-card', title: 'Detalle expandible', text: 'Haz click en una sucursal para ver qué renglones causaron la diferencia en cada uno de los dos meses comparados.' },
];

interface TourRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TourCtx {
  active: boolean;
  stepNum: number;
  stepTotal: number;
  title: string;
  text: string;
  isFirst: boolean;
  isLast: boolean;
  highlightStyle: CSSProperties;
  cardStyle: CSSProperties;
  start: () => void;
  close: () => void;
  next: () => void;
  prev: () => void;
}

const TourContext = createContext<TourCtx | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<TourRect | null>(null);
  const measureTimer = useRef<number | null>(null);

  const measure = useCallback((stepIndex: number) => {
    if (measureTimer.current) window.clearTimeout(measureTimer.current);
    measureTimer.current = window.setTimeout(() => {
      const target = TOUR_STEPS[stepIndex]?.target;
      const el = target ? document.querySelector(`[data-tour="${target}"]`) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
    }, 120);
  }, []);

  const start = useCallback(() => {
    setActive(true);
    setStep(0);
    setRect(null);
    navigate(TOUR_STEPS[0].path);
    measure(0);
  }, [navigate, measure]);

  const close = useCallback(() => {
    setActive(false);
    setRect(null);
  }, []);

  const next = useCallback(() => {
    const nextStep = step + 1;
    if (nextStep >= TOUR_STEPS.length) {
      close();
      return;
    }
    setStep(nextStep);
    setRect(null);
    navigate(TOUR_STEPS[nextStep].path);
    measure(nextStep);
  }, [step, navigate, measure, close]);

  const prev = useCallback(() => {
    const prevStep = step - 1;
    if (prevStep < 0) return;
    setStep(prevStep);
    setRect(null);
    navigate(TOUR_STEPS[prevStep].path);
    measure(prevStep);
  }, [step, navigate, measure]);

  useEffect(() => {
    function onResize() {
      if (active) measure(step);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, step, measure]);

  useEffect(() => {
    if (!session) return;
    try {
      const seen = localStorage.getItem('ca-tour-seen');
      if (!seen) {
        localStorage.setItem('ca-tour-seen', '1');
        const t = window.setTimeout(() => start(), 700);
        return () => window.clearTimeout(t);
      }
    } catch {
      // localStorage no disponible — omitir auto-tour
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;

  const highlightStyle: CSSProperties = rect
    ? {
        position: 'fixed',
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.82)',
        border: '2px solid #FFCD02',
        borderRadius: 4,
        zIndex: 901,
        pointerEvents: 'none',
      }
    : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 901, pointerEvents: 'none' };

  const cardWidth = Math.min(320, vw - 32);
  let cardTop: number;
  let cardLeft: number;
  if (rect) {
    const spaceBelow = vh - (rect.top + rect.height);
    cardTop = spaceBelow > 220 ? rect.top + rect.height + 16 : Math.max(16, rect.top - 206);
    cardLeft = Math.min(Math.max(16, rect.left), vw - cardWidth - 16);
  } else {
    cardTop = vh / 2 - 110;
    cardLeft = vw / 2 - cardWidth / 2;
  }

  const cardStyle: CSSProperties = {
    position: 'fixed',
    top: Math.round(cardTop),
    left: Math.round(cardLeft),
    width: cardWidth,
    background: '#0d0d0d',
    border: '2px solid #FFCD02',
    padding: 20,
    zIndex: 902,
    pointerEvents: 'auto',
    fontFamily: 'inherit',
  };

  const current = TOUR_STEPS[step];

  return (
    <TourContext.Provider
      value={{
        active,
        stepNum: step + 1,
        stepTotal: TOUR_STEPS.length,
        title: current?.title ?? '',
        text: current?.text ?? '',
        isFirst: step === 0,
        isLast: step === TOUR_STEPS.length - 1,
        highlightStyle,
        cardStyle,
        start,
        close,
        next,
        prev,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour debe usarse dentro de TourProvider');
  return ctx;
}
