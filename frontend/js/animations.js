// animations.js - Centralized GSAP animation logic

/**
 * Checks if the device is pointer-coarse (e.g., tablet/mobile).
 * We omit sticky hover animations on touch devices as an iPad optimization constraint.
 */
function isTouchDevice() {
  return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Global Page Load Animations
 */
export function animateEntry() {
  if (typeof gsap === "undefined") {
    console.warn("GSAP is not loaded.");
    return;
  }
  gsap.from(".top-nav", { y: -20, opacity: 0, duration: 0.8, ease: "power3.out" });
  gsap.from("header", { y: -20, opacity: 0, duration: 0.8, ease: "power3.out", delay: 0.1 });
  gsap.from(".global-fields", { y: 20, opacity: 0, duration: 0.8, ease: "power3.out", delay: 0.2 });
  gsap.from(".actions", { y: 20, opacity: 0, duration: 0.8, ease: "power3.out", delay: 0.3 });
}

/**
 * Animations for Student Cards
 */
export function animateCardAdd(card) {
  gsap.fromTo(card,
    { opacity: 0, y: 15, scale: 0.98 },
    { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.4)", clearProps: "all" }
  );

  if (!isTouchDevice()) {
    card.addEventListener("mouseenter", () => gsap.to(card, { y: -2, boxShadow: "0 10px 30px hsla(156, 50%, 10%, 0.12)", duration: 0.3, ease: "power2.out" }));
    card.addEventListener("mouseleave", () => gsap.to(card, { y: 0, boxShadow: "0 4px 20px hsla(156, 50%, 10%, 0.04)", duration: 0.3, ease: "power2.out" }));
  }
}

export function animateCardRemove(card, onComplete) {
  gsap.to(card, {
    opacity: 0,
    y: -15,
    scale: 0.95,
    duration: 0.3,
    ease: "power2.in",
    onComplete: onComplete
  });
}

/**
 * History List Stagger Animation
 */
export function animateHistoryStagger(cards) {
  if (cards.length > 0) {
    gsap.fromTo(cards, 
      { opacity: 0, y: 30, scale: 0.98 }, 
      { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08, ease: "power3.out", clearProps: "all" }
    );
    
    if (!isTouchDevice()) {
      cards.forEach(card => {
        card.addEventListener('mouseenter', () => gsap.to(card, { y: -4, boxShadow: "0 12px 40px hsla(156, 50%, 10%, 0.08)", duration: 0.3, ease: "power2.out" }));
        card.addEventListener('mouseleave', () => gsap.to(card, { y: 0, boxShadow: "0 4px 20px hsla(156, 50%, 10%, 0.04)", duration: 0.3, ease: "power2.out" }));
      });
    }
  }
}

export function animateModalEntry(modalCard) {
  gsap.fromTo(modalCard, 
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
  );
}
