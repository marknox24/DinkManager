import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Site-wide eased/inertial scroll for the marketing page. Lenis smooths the
// real document scroll position (it isn't a transformed virtual scroll), so
// `position: sticky` and IntersectionObserver-based reveals elsewhere on
// the page keep working unmodified — this only changes how scroll input
// gets there.
// Arriving from another page at /#pricing (footer on /privacy, the plan
// link in event Settings): the sections render after the lazy page chunk
// and hero settle, so the browser's own hash jump fires before the target
// exists. Retry until it does, then scroll there.
function scrollToInitialHash(scrollTo) {
  const id = window.location.hash.slice(1);
  if (!id) return () => {};
  let timer;
  let tries = 0;
  const attempt = () => {
    const target = document.getElementById(id);
    if (target) {
      scrollTo(target);
      return;
    }
    tries += 1;
    if (tries < 20) timer = setTimeout(attempt, 150);
  };
  timer = setTimeout(attempt, 300);
  return () => clearTimeout(timer);
}

export default function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return scrollToInitialHash((target) => target.scrollIntoView());
    }

    // anchors:true measures the target against Lenis's cached content
    // height at construction time — on this page that's captured before the
    // 400vh+ hero and its lazy content settle, so it clamps every in-page
    // link short of its real target. Handling clicks ourselves and calling
    // resize() right before scrollTo() forces a fresh measurement instead.
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true, syncTouch: false });

    const onScroll = () => ScrollTrigger.update();
    lenis.on('scroll', onScroll);

    const onClick = (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      lenis.resize();
      lenis.scrollTo(target, { offset: 0 });
    };
    document.addEventListener('click', onClick);

    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const cancelHashScroll = scrollToInitialHash((target) => {
      lenis.resize();
      lenis.scrollTo(target, { offset: 0, immediate: true });
    });

    return () => {
      cancelHashScroll();
      gsap.ticker.remove(tick);
      lenis.off('scroll', onScroll);
      document.removeEventListener('click', onClick);
      lenis.destroy();
    };
  }, []);
}
