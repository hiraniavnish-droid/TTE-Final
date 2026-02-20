
import confetti from 'canvas-confetti';

export const triggerConfetti = () => {
  const duration = 2000;
  const end = Date.now() + duration;

  (function frame() {
    // launch a few confetti from the left edge
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.8 },
      colors: ['#10b981', '#3b82f6', '#f59e0b'] // Emerald, Blue, Amber
    });
    
    // and launch a few from the right edge
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.8 },
      colors: ['#10b981', '#3b82f6', '#f59e0b']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
};
