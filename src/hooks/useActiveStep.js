import { useEffect, useRef, useState } from 'react';

// Drives sticky scroll storytelling: give each step a ref via
// `setStepRef(i)`, and this reports which step's marker is currently
// closest to the "focus line" (a fixed point below the sticky nav) so the
// pinned visual on the right knows which variant to show.
export default function useActiveStep(count) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef([]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.stepIndex);
            setActive(idx);
          }
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );

    stepRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, [count]);

  const setStepRef = (i) => (node) => {
    stepRefs.current[i] = node;
  };

  return { active, setStepRef };
}
