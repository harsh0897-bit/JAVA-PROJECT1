import React, { useState } from 'react';
import { Shield } from 'lucide-react';

export interface BrandLogoProps {
  variant?: 'navbar' | 'auth' | 'workspace' | 'footer';
  className?: string;
  badgeText?: string;
}

function getAssetPath(filename: string): string {
  const base =
    (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}assets/${filename}`;
}

/**
 * Shared CyberFusion X Brand Logo component using the lossless pre-split PNG files:
 * - cyberfusion-x-mark.png (cube emblem, 554×724)
 * - cyberfusion-x-wordmark.png (script wordmark + subtitle, 1618×724)
 * Fallback chain:
 * 1. Mark + Wordmark dual image flex row with proportional gap (0.08 × height, 4-9px)
 * 2. If either fails: Single full lockup cyberfusion-x-logo.png (2172×724)
 * 3. If that fails: Crisp Shield SVG fallback.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'navbar',
  className = '',
  badgeText,
}) => {
  const [splitFailed, setSplitFailed] = useState(false);
  const [fullFailed, setFullFailed] = useState(false);

  const isLanding = variant === 'navbar';

  // Sizing by image-box height: desktop ~64px (range 60-68), tablet ~52px, mobile >=44px.
  // Proportional negative margin compensates for ~12% transparent top/bottom margin
  // so headers stay compact while overflow: visible + p-1 preserves glow and focus.
  const heightClass =
    variant === 'navbar'
      ? 'h-[44px] sm:h-[52px] lg:h-[64px]'
      : variant === 'auth'
      ? 'h-[44px] sm:h-[52px] lg:h-[62px]'
      : variant === 'workspace'
      ? 'h-[44px] sm:h-[52px] lg:h-[62px]'
      : 'h-[44px] sm:h-[50px] lg:h-[58px]';

  const marginClass =
    variant === 'navbar'
      ? '-my-2 -ml-1'
      : variant === 'workspace'
      ? '-my-2 -ml-1'
      : '-my-1.5 -ml-1';

  return (
    <span
      className={`inline-flex items-center min-w-0 shrink-0 select-none overflow-visible p-1 ${marginClass} ${className}`.trim()}
      role="img"
      aria-label="CyberFusion X, Digital Forensics Lab"
      style={{
        // Gap formula: ~0.08 * height clamped to 4-9px
        gap: 'clamp(4px, 0.08em, 9px)',
      }}
    >
      {!splitFailed ? (
        <span
          className="inline-flex items-center min-w-0 shrink-0 overflow-visible"
          style={{
            gap: 'clamp(4px, calc(var(--brand-h, 64px) * 0.08), 9px)',
          }}
        >
          {/* Emblem Cube Mark */}
          <img
            src={getAssetPath('cyberfusion-x-mark.png')}
            alt=""
            width={554}
            height={724}
            loading={isLanding ? 'eager' : undefined}
            fetchPriority={isLanding ? 'high' : undefined}
            decoding={isLanding ? undefined : 'async'}
            draggable={false}
            onError={() => setSplitFailed(true)}
            style={{
              objectFit: 'contain',
              objectPosition: 'left center',
              width: 'auto',
            }}
            className={`${heightClass} w-auto max-w-none shrink-0 block`}
          />

          {/* Script Wordmark + Subtitle */}
          <img
            src={getAssetPath('cyberfusion-x-wordmark.png')}
            alt=""
            width={1618}
            height={724}
            loading={isLanding ? 'eager' : undefined}
            fetchPriority={isLanding ? 'high' : undefined}
            decoding={isLanding ? undefined : 'async'}
            draggable={false}
            onError={() => setSplitFailed(true)}
            style={{
              objectFit: 'contain',
              objectPosition: 'left center',
              width: 'auto',
            }}
            className={`${heightClass} w-auto max-w-none shrink-0 block`}
          />
        </span>
      ) : !fullFailed ? (
        /* Fallback 1: Full-file single image */
        <img
          src={getAssetPath('cyberfusion-x-logo.png')}
          alt=""
          width={2172}
          height={724}
          loading={isLanding ? 'eager' : undefined}
          fetchPriority={isLanding ? 'high' : undefined}
          decoding={isLanding ? undefined : 'async'}
          draggable={false}
          onError={() => setFullFailed(true)}
          style={{
            objectFit: 'contain',
            objectPosition: 'left center',
            width: 'auto',
          }}
          className={`${heightClass} w-auto max-w-none shrink-0 block`}
        />
      ) : (
        /* Fallback 2: SVG emblem shield */
        <span className="inline-flex items-center gap-2 shrink-0">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white flex items-center justify-center shadow-xs shrink-0 border border-white/40">
            <Shield className="w-4 h-4 text-white" />
          </span>
          <span className="font-extrabold text-base tracking-tight text-slate-900 whitespace-nowrap">
            CyberFusion <span className="text-[#2563EB]">X</span>
          </span>
        </span>
      )}

      {badgeText && (
        <span className="hidden xl:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50/80 text-blue-700 border border-blue-200/80 shrink-0 whitespace-nowrap ml-2">
          {badgeText}
        </span>
      )}
    </span>
  );
};

export default BrandLogo;
