
import React from 'react';

interface UserAvatarProps {
  name: string;
  size?: number;
  className?: string;
  animate?: boolean;
}

const hashName = (name: string): number => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  size = 32,
  className,
  animate = true,
}) => {
  const safeName = name || 'A';
  const h = hashName(safeName);
  const uid = `ua${h.toString(36)}`;

  const bgColors: [string, string][] = [
    ['#6366f1', '#4f46e5'],
    ['#0891b2', '#0d9488'],
    ['#f59e0b', '#ea580c'],
    ['#f43f5e', '#db2777'],
    ['#10b981', '#059669'],
    ['#8b5cf6', '#6d28d9'],
  ];

  const skinTones: [string, string][] = [
    ['#FDDBB4', '#E8B48A'],
    ['#F0C080', '#D4955A'],
    ['#D4956A', '#B87040'],
    ['#C68642', '#A0522D'],
    ['#8D5524', '#6B3A1F'],
  ];

  const hairColors = ['#1a1008', '#5C3317', '#8B4513', '#B8860B', '#C8A060', '#888888'];

  // Use >>> (unsigned right shift) so results are always non-negative even when h > 2^31
  const bgPair    = bgColors[(h >>> 0) % 6];
  const skinPair  = skinTones[(h >>> 4) % 5];
  const hairColor = hairColors[(h >>> 8) % 6];
  const hairStyle  = (h >>> 12) % 4;
  const eyeStyle   = (h >>> 16) % 3;
  const mouthStyle = (h >>> 20) % 3;
  const hasBlush   = ((h >>> 24) % 3) === 0;

  const hairPath = hairStyle === 0
    ? 'M 9.5 22 Q 9 9 20 8.5 Q 31 9 30.5 22 Q 27.5 14 20 13.5 Q 12.5 14 9.5 22Z'
    : hairStyle === 1
    ? 'M 9 22 Q 8 12 14 9 Q 20 6.5 26 9 Q 32 12 31 22 Q 28.5 13 23 12.5 Q 17 12 12.5 13.5Z'
    : hairStyle === 2
    ? 'M 9 22 Q 9 8 20 8 Q 31 8 31 22 Q 28 13 20 12.5 Q 12 13 9 22Z'
    : null; // bald

  return (
    // CSS overflow:hidden on a border-radius:50% div clips the SVG to a circle — no clipPath needed
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'inline-block',
        transition: animate ? 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
      }}
      className={className}
      onMouseEnter={(e) => { if (animate) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.13)'; }}
      onMouseLeave={(e) => { if (animate) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
    >
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block' }}>
        <defs>
          <radialGradient id={`${uid}bg`} cx="35%" cy="28%" r="72%">
            <stop offset="0%" stopColor={bgPair[0]} stopOpacity="0.9" />
            <stop offset="100%" stopColor={bgPair[1]} />
          </radialGradient>
          <radialGradient id={`${uid}face`} cx="40%" cy="33%" r="70%">
            <stop offset="0%" stopColor={skinPair[0]} />
            <stop offset="100%" stopColor={skinPair[1]} />
          </radialGradient>
        </defs>

        {/* Background sphere */}
        <circle cx="20" cy="20" r="20" fill={`url(#${uid}bg)`} />

        {/* Specular highlight — 3D glass effect */}
        <ellipse cx="13" cy="11" rx="7.5" ry="5" fill="white" opacity="0.27" />

        {/* Hair (behind face) */}
        {hairPath && <path d={hairPath} fill={hairColor} />}
        {/* Long hair side tails */}
        {hairStyle === 2 && (
          <g>
            <path d="M 9 22 Q 7.5 28 8.5 34" stroke={hairColor} strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M 31 22 Q 32.5 28 31.5 34" stroke={hairColor} strokeWidth="4" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Face */}
        <circle cx="20" cy="22" r="12.5" fill={`url(#${uid}face)`} />

        {/* Blush */}
        {hasBlush && (
          <g>
            <circle cx="13" cy="25.5" r="2.8" fill="#FF9EB5" opacity="0.38" />
            <circle cx="27" cy="25.5" r="2.8" fill="#FF9EB5" opacity="0.38" />
          </g>
        )}

        {/* Eyes */}
        {eyeStyle === 0 && (
          <g>
            <path d="M 13 20 Q 15.5 17.5 18 20" stroke="#2C1810" fill="none" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M 22 20 Q 24.5 17.5 27 20" stroke="#2C1810" fill="none" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        )}
        {eyeStyle === 1 && (
          <g>
            <circle cx="15.5" cy="20" r="2.3" fill="#2C1810" />
            <circle cx="24.5" cy="20" r="2.3" fill="#2C1810" />
            <circle cx="14.7" cy="19.2" r="0.75" fill="white" />
            <circle cx="23.7" cy="19.2" r="0.75" fill="white" />
          </g>
        )}
        {eyeStyle === 2 && (
          <g>
            <circle cx="15.5" cy="20" r="2.8" fill="#2C1810" />
            <circle cx="24.5" cy="20" r="2.8" fill="#2C1810" />
            <circle cx="14.2" cy="18.8" r="1.1" fill="white" />
            <circle cx="23.2" cy="18.8" r="1.1" fill="white" />
            <circle cx="16.5" cy="21" r="0.45" fill="white" opacity="0.6" />
            <circle cx="25.5" cy="21" r="0.45" fill="white" opacity="0.6" />
          </g>
        )}

        {/* Nose */}
        <circle cx="20" cy="23.5" r="0.9" fill="rgba(0,0,0,0.18)" />

        {/* Mouth */}
        {mouthStyle === 0 && (
          <path d="M 16 26 Q 20 29.5 24 26" stroke="#2C1810" fill="none" strokeWidth="1.8" strokeLinecap="round" />
        )}
        {mouthStyle === 1 && (
          <g>
            <path d="M 14.5 25.5 Q 20 30.5 25.5 25.5" stroke="#2C1810" fill="none" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M 15 26 Q 20 30 25 26" stroke="white" fill="none" strokeWidth="1" opacity="0.75" />
          </g>
        )}
        {mouthStyle === 2 && (
          <path d="M 16 26 Q 19.5 28.5 23 25.5" stroke="#2C1810" fill="none" strokeWidth="1.8" strokeLinecap="round" />
        )}

        {/* Subtle inner ring */}
        <circle cx="20" cy="20" r="19.5" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
      </svg>
    </div>
  );
};
