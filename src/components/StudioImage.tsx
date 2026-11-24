import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface StudioImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  fallbackLabel?: string;
  aspectClass?: string;
}

export const StudioImage: React.FC<StudioImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = 'w-full h-full object-cover',
  fallbackClassName = '',
  fallbackLabel,
  aspectClass = '',
}) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const resolvedSrc = src && src.startsWith('/src/assets/') ? `.${src}` : src;

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [resolvedSrc]);

  const showFallback = !resolvedSrc || failed;

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-slate-100 via-slate-200/70 to-slate-100 dark:from-[#0D1B30] dark:via-[#12243D] dark:to-[#071426] ${aspectClass} ${className}`}
    >
      {showFallback ? (
        <div
          className={`w-full h-full flex flex-col items-center justify-center p-2 text-center ${fallbackClassName}`}
        >
          <ImageIcon className="w-5 h-5 text-slate-400 dark:text-[#A7B4C7]/60" />
          {fallbackLabel && (
            <span className="mt-1 text-[10px] font-medium text-slate-500 dark:text-[#A7B4C7]/70 truncate max-w-full">
              {fallbackLabel}
            </span>
          )}
        </div>
      ) : (
        <img
          src={resolvedSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`${imgClassName} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-90'}`}
        />
      )}
    </div>
  );
};
