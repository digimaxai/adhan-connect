'use client';

import { useEffect, useState } from 'react';

const DEFAULT_WIDTH = 1440;

function readViewportWidth() {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  return window.innerWidth;
}

export function useAdminViewport() {
  const [width, setWidth] = useState(readViewportWidth);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let frame = 0;

    const handleResize = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setWidth(window.innerWidth));
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return {
    width,
    isComfortable: width <= 1600,
    isStacked: width <= 1360,
    isCompact: width <= 1040,
    isPhone: width <= 680,
  };
}
