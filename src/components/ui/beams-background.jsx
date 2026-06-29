import { useEffect, useRef } from 'react';

function hexToHue(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return 210;
  const r = Number.parseInt(match[1], 16) / 255;
  const g = Number.parseInt(match[2], 16) / 255;
  const b = Number.parseInt(match[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (!delta) return 210;
  if (max === r) return 60 * (((g - b) / delta) % 6);
  if (max === g) return 60 * ((b - r) / delta + 2);
  return 60 * ((r - g) / delta + 4);
}

function hexLuminance(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return 0.2;
  const values = [match[1], match[2], match[3]].map((value) => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function createBeam(width, height, index, total, baseHue, baseOpacity) {
  return {
    x: (index % 3) * (width / 3) + width / 6 + (Math.random() - 0.5) * width * 0.18,
    y: Math.random() * height * 1.4,
    width: 90 + Math.random() * 95,
    length: height * 2.4,
    angle: -38 + Math.random() * 12,
    speed: 0.35 + Math.random() * 0.45,
    opacity: baseOpacity + Math.random() * 0.12,
    hue: baseHue + (index % 4) * 14 - 20,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.018 + Math.random() * 0.018,
  };
}

function resetBeam(beam, width, height, index, total, baseHue, baseOpacity) {
  const next = createBeam(width, height, index, total, baseHue, baseOpacity);
  beam.x = next.x;
  beam.y = height + 120;
  beam.width = next.width;
  beam.speed = next.speed;
  beam.hue = next.hue;
  beam.opacity = next.opacity;
}

function drawBeam(ctx, beam, intensity) {
  ctx.save();
  ctx.translate(beam.x, beam.y);
  ctx.rotate((beam.angle * Math.PI) / 180);

  const opacity = beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2) * intensity;
  const gradient = ctx.createLinearGradient(0, 0, 0, beam.length);
  gradient.addColorStop(0, `hsla(${beam.hue}, 85%, 65%, 0)`);
  gradient.addColorStop(0.12, `hsla(${beam.hue}, 85%, 65%, ${opacity * 0.5})`);
  gradient.addColorStop(0.42, `hsla(${beam.hue}, 85%, 65%, ${opacity})`);
  gradient.addColorStop(0.62, `hsla(${beam.hue}, 85%, 65%, ${opacity})`);
  gradient.addColorStop(0.9, `hsla(${beam.hue}, 85%, 65%, ${opacity * 0.45})`);
  gradient.addColorStop(1, `hsla(${beam.hue}, 85%, 65%, 0)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length);
  ctx.restore();
}

export function BeamsBackground({ className = '', color = '#8ca0c2', backgroundColor = '#111827', intensity = 1 }) {
  const canvasRef = useRef(null);
  const beamsRef = useRef([]);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const isLight = hexLuminance(backgroundColor) > 0.45;
    const baseHue = isLight ? (hexToHue(color) + 180) % 360 : hexToHue(color);
    const baseOpacity = isLight ? 0.22 : 0.2;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      const parent = canvas.parentElement;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = Math.max(rect.height, parent?.scrollHeight || 0);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.height = `${height}px`;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const total = 24;
      beamsRef.current = Array.from({ length: total }, (_, index) => createBeam(width, height, index, total, baseHue, baseOpacity));
    };

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);
      ctx.filter = 'blur(34px)';
      const total = beamsRef.current.length;
      beamsRef.current.forEach((beam, index) => {
        if (!reducedMotion) {
          beam.y -= beam.speed;
          beam.pulse += beam.pulseSpeed;
        }
        if (beam.y + beam.length < -120) resetBeam(beam, width, height, index, total, baseHue, baseOpacity);
        drawBeam(ctx, beam, intensity);
      });
      if (!reducedMotion) frameRef.current = requestAnimationFrame(render);
    };

    resize();
    render();

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frameRef.current);
      resize();
      render();
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [backgroundColor, color, intensity]);

  return <canvas ref={canvasRef} className={`absolute ${className || 'inset-0'}`} />;
}
