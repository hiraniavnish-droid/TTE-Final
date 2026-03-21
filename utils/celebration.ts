import confetti from 'canvas-confetti';

export const triggerConfetti = () => {
  const count = 250;
  const defaults = { origin: { y: 0.65 } };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
  }

  // Multi-burst for a premium feel
  fire(0.25, { spread: 26, startVelocity: 55, colors: ['#10b981', '#34d399', '#6ee7b7'] });
  fire(0.20, { spread: 60, colors: ['#f59e0b', '#fbbf24', '#fde68a'] });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#6366f1', '#818cf8', '#a5b4fc'] });
  fire(0.10, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, colors: ['#10b981', '#f59e0b', '#6366f1'] });
  fire(0.10, { spread: 120, startVelocity: 45, colors: ['#10b981', '#f59e0b'] });

  // Gold star burst from center after slight delay
  setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 360,
      startVelocity: 20,
      gravity: 0.6,
      origin: { x: 0.5, y: 0.5 },
      scalar: 1.5,
      shapes: ['star'],
      colors: ['#FFD700', '#FFA500', '#FFE66D'],
    });
  }, 300);
};
