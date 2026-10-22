import React, { useState } from 'react';
import { Shield } from 'lucide-react';

export interface BrandLogoProps {
  variant?: 'navbar' | 'auth' | 'workspace' | 'footer';
  className?: string;
  badgeText?: string;
}

function getLogoAssetPath(): string {
  const base =
    (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}assets/cyberfusion-x-logo.png`;
}

/**
 * Shared CyberFusion X Brand Logo component.
 * Uses the exact transparent PNG asset (/assets/cyberfusion-x-logo.png, 2079×756, 2.75:1)
 * without cropping, recoloring, filters, or duplicate "CyberFusion X" text labels.
 * Includes a resilient onError fallback if the image cannot load.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'navbar',
  className = '',
  badgeText,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  // Phase 5 A3: visible lockup is ~75% of image height (14% top, 11% bottom, 3% left transparent margin).
  // Size image box to: mobile >= 44px, tablet ~52px, desktop ~60-64px, with negative margin compensation
  // on the container so the header height stays compact while overflow: visible + p-1 preserves glow/focus.
  const sizeClass =
    variant === 'navbar'
      ? 'h-[44px] sm:h-[52px] lg:h-[64px] w-auto -my-2 -ml-1.5'
      : variant === 'auth'
      ? 'h-[44px] sm:h-[52px] lg:h-[62px] w-auto -my-1.5 -ml-1.5'
      : variant === 'workspace'
      ? 'h-[44px] sm:h-[52px] lg:h-[60px] w-auto -my-2 -ml-1.5'
      : 'h-[44px] sm:h-[52px] lg:h-[60px] w-auto -my-1.5 -ml-1.5';

  const isLanding = variant === 'navbar';

  return (
    <span
      className={`inline-flex items-center gap-2.5 min-w-0 shrink-0 select-none overflow-visible p-1 ${className}`.trim()}
    >
      {!imgFailed ? (
        <img
          src={getLogoAssetPath()}
          alt="CyberFusion X, Digital Forensics Lab"
          width={2079}
          height={756}
          loading={isLanding ? 'eager' : undefined}
          fetchPriority={isLanding ? 'high' : undefined}
          decoding={isLanding ? undefined : 'async'}
          draggable={false}
          onError={() => setImgFailed(true)}
          style={{
            objectFit: 'contain',
            objectPosition: 'left center',
            aspectRatio: 'auto',
          }}
          className={`${sizeClass} max-w-none object-contain object-left shrink-0 block`}
        />
      ) : (
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
        <span className="hidden xl:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50/80 text-blue-700 border border-blue-200/80 shrink-0 whitespace-nowrap">
          {badgeText}
        </span>
      )}
    </span>
  );
};

export default BrandLogo;
