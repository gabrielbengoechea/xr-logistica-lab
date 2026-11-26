// Bandera uruguaya dibujada en un lienzo 2D (sin imágenes externas). La usan el atlas del exterior y el traje.

/** Bandera uruguaya en un lienzo 2D: nueve franjas, cantón blanco y Sol de Mayo. La usan el atlas y el guante. */
export function dibujarBandera(ctx, x0, y0, w, h) {
  for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#0038a8' : '#ffffff'; ctx.fillRect(x0, y0 + i * h / 9, w, h / 9 + 0.5); }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0, y0, w * 0.37, h * 5 / 9);
  const cx = x0 + w * 0.185, cy = y0 + h * 2.5 / 9, r = h * 0.12;
  ctx.fillStyle = '#fcd116';
  ctx.strokeStyle = '#7b5d00';
  ctx.lineWidth = Math.max(1, h * 0.006);
  for (let k = 0; k < 16; k++) {                                   // rayos del Sol de Mayo
    const a = k * Math.PI / 8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - 0.12) * r, cy + Math.sin(a - 0.12) * r);
    ctx.lineTo(cx + Math.cos(a) * r * 1.85, cy + Math.sin(a) * r * 1.85);
    ctx.lineTo(cx + Math.cos(a + 0.12) * r, cy + Math.sin(a + 0.12) * r);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
