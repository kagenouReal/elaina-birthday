//=================
import { memo, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, ArrowUp, Gift, Sparkles, Star } from 'lucide-react';
import { ELAINA_ASSETS } from './data/elainaAssets';
//=================
const ease = [0.22, 1, 0.36, 1] as const;
const imageEase = [0.4, 0, 0.2, 1] as const;
const desktopScrollEase = (progress: number) => progress < 0.5
  ? 4 * progress * progress * progress
  : 1 - Math.pow(-2 * progress + 2, 3) / 2;
const desktopScrollDuration = 878 * 1.1;
const mobileScrollDuration = 920 * 1.15;
const scrollRevealTargetProgress = 0.8;
const ambientIntersectionProgress = 0.08;
const wheelGestureIdleDuration = 200;
const animationDuration = (seconds: number) => seconds * 0.9;
const heroOverlapDelays = { eyebrow: 0.45, heading: 0.43, supporting: 0.34, image: 0.28, link: 0.25, ornament: 0.18 } as const;
const revealDurations = {
text: animationDuration(0.74727),
image: animationDuration(1.0586325),
ornament: animationDuration(0.57913425),
} as const;
const entrance = { eyebrow: 0.25, heading: 0.55, supporting: 0.9, image: 0.95, link: 1.2, ornament: 1.45 } as const;
let storyHasStarted = false;
const storyStartSubscribers = new Set<() => void>();
function subscribeToStoryStart(callback: () => void) {
if (storyHasStarted) callback();
else storyStartSubscribers.add(callback);
return () => storyStartSubscribers.delete(callback);
}
function startStoryRevealObservers() {
if (storyHasStarted) return;
storyHasStarted = true;
storyStartSubscribers.forEach((callback) => callback());
storyStartSubscribers.clear();
}
const isMobileStoryLayout = () => window.matchMedia('(max-width: 760px), (pointer: coarse) and (hover: none) and (max-width: 1100px)').matches;
const isDesktopStory = () => window.matchMedia('(min-width: 1101px)').matches;
const isIntermediatePointerViewport = () =>
window.matchMedia('(min-width: 761px) and (min-height: 561px)').matches && !isMobileStoryLayout();
const revealObserverOptions = (threshold: number, warmAhead = false): IntersectionObserverInit => {
const desktop = isDesktopStory();
const mobile = isMobileStoryLayout();
return {
threshold: desktop || mobile ? 0.01 : threshold,
rootMargin: desktop && warmAhead ? `0px 0px ${Math.round(window.innerHeight * 0.08)}px 0px` : '0px',
};
};
const revealObservers = new Map<string, IntersectionObserver>();
const revealCallbacks = new WeakMap<Element, (entry: IntersectionObserverEntry) => void>();
function observeOnce(element: Element, options: IntersectionObserverInit, callback: (entry: IntersectionObserverEntry) => void) {
const key = `${options.threshold ?? 0}|${options.rootMargin ?? '0px'}`;
let observer = revealObservers.get(key);
if (!observer) {
observer = new IntersectionObserver((entries) => {
entries.forEach((entry) => {
if (!entry.isIntersecting) return;
observer?.unobserve(entry.target);
const reveal = revealCallbacks.get(entry.target);
revealCallbacks.delete(entry.target);
reveal?.(entry);
});
}, options);
revealObservers.set(key, observer);
}
revealCallbacks.set(element, callback);
observer.observe(element);
return () => {
observer?.unobserve(element);
revealCallbacks.delete(element);
};
}
const bezierCoordinate = (t: number, first: number, second: number) =>
3 * (1 - t) ** 2 * t * first + 3 * (1 - t) * t ** 2 * second + t ** 3;
const easingProgressForOpacity = (opacity: number, easing: readonly [number, number, number, number]) => {
let low = 0;
let high = 1;
for (let iteration = 0; iteration < 16; iteration += 1) {
const middle = (low + high) / 2;
if (bezierCoordinate(middle, easing[1], easing[3]) < opacity) low = middle;
else high = middle;
}
const t = (low + high) / 2;
return bezierCoordinate(t, easing[0], easing[2]);
};
const scrollTimeForProgress = (progress: number) => {
let low = 0;
let high = 1;
for (let iteration = 0; iteration < 16; iteration += 1) {
const middle = (low + high) / 2;
if (desktopScrollEase(middle) < progress) low = middle;
else high = middle;
}
return (low + high) / 2;
};
const scrollRevealDelay = (
intersectionProgress: number,
duration: number,
easing: readonly [number, number, number, number],
scrollDuration: number,
) => {
const progress = Math.max(0, Math.min(1, intersectionProgress));
const triggerTime = scrollTimeForProgress(progress) * scrollDuration / 1000;
const visibleTime = duration * easingProgressForOpacity(0.8, easing);
return Math.max(0, scrollDuration * scrollRevealTargetProgress / 1000 - triggerTime - visibleTime);
};
const transitionRevealDelay = (
element: Element,
entryTime: number,
duration: number,
easing: readonly [number, number, number, number],
) => {
const sectionId = element.closest<HTMLElement>('.story-section')?.id;
const transition = activeScrollTransition;
if (!sectionId || !transition?.sectionIds.includes(sectionId)) return null;
const timeRemaining = (transition.startTime + transition.duration * scrollRevealTargetProgress - entryTime) / 1000;
const visibleTime = duration * easingProgressForOpacity(0.8, easing);
return Math.max(0, timeRemaining - visibleTime);
};
const revealDelay = (delay: number, element: HTMLElement, kind: 'text' | 'image' | 'ornament') => {
const desktop = isDesktopStory();
const mobile = isMobileStoryLayout();
if (!desktop && !mobile) return delay;
const section = element.closest<HTMLElement>('.story-section');
const localTop = section
? element.getBoundingClientRect().top - section.getBoundingClientRect().top
: 0;
const desktopWarmMargin = desktop ? 0.08 : 0;
const intersectionProgress = localTop / window.innerHeight - desktopWarmMargin;
const easing = kind === 'image' ? imageEase : ease;
const scrollDuration = desktop ? desktopScrollDuration : mobileScrollDuration;
return scrollRevealDelay(intersectionProgress, revealDurations[kind], easing, scrollDuration);
};
const ambientRevealDelay = () => {
const desktop = isDesktopStory();
const mobile = isMobileStoryLayout();
if (!desktop && !mobile) return 0.85;
const intersectionProgress = ambientIntersectionProgress;
const scrollDuration = desktop ? desktopScrollDuration : mobileScrollDuration;
return scrollRevealDelay(intersectionProgress, revealDurations.ornament, imageEase, scrollDuration);
};
const sections = [
{ id: 'splash', label: 'Intro' },
{ id: 'home', label: 'Start' },
  { id: 'elaina', label: 'Elaina' },
{ id: 'letter', label: 'Note' },
{ id: 'finale', label: 'Wish' },
{ id: 'keepsake', label: 'Gift' },
{ id: 'journey', label: 'Gallery' },
];
const mobileStorySections = sections.filter((section) => section.id !== 'splash');
let cancelDesktopWheelMotion = () => {};
let cancelMobileWheelMotion = () => {};
let moveDesktopSection: ((direction: number) => void) | null = null;
let activeScrollTransition: { sectionIds: string[]; startTime: number; duration: number } | null = null;
let sectionScrollFrame = 0;
let sectionScrollAnimation = 0;
let cancelSectionScroll = () => {};
let activeNavigationTarget: string | null = null;
function animateToStoryPosition(targetY: number, sectionIds: string[], duration: number, navigationTarget: string) {
cancelSectionScroll();
const startY = window.scrollY;
const startTime = performance.now();
const animation = ++sectionScrollAnimation;
activeNavigationTarget = navigationTarget;
activeScrollTransition = { sectionIds, startTime, duration };
const animate = (time: number) => {
if (animation !== sectionScrollAnimation) return;
const progress = Math.min(1, (time - startTime) / duration);
window.scrollTo({ top: startY + (targetY - startY) * desktopScrollEase(progress), behavior: 'instant' });
if (progress < 1) {
sectionScrollFrame = requestAnimationFrame(animate);
} else {
sectionScrollFrame = 0;
activeScrollTransition = null;
activeNavigationTarget = null;
cancelSectionScroll = () => {};
}
};
cancelSectionScroll = () => {
sectionScrollAnimation += 1;
if (sectionScrollFrame) cancelAnimationFrame(sectionScrollFrame);
sectionScrollFrame = 0;
activeScrollTransition = null;
activeNavigationTarget = null;
cancelSectionScroll = () => {};
};
sectionScrollFrame = requestAnimationFrame(animate);
}
//=================
function scrollToSection(id: string) {
if (window.matchMedia('(min-width: 1101px)').matches) {
cancelDesktopWheelMotion();
const index = sections.findIndex((section) => section.id === id);
if (index >= 0) {
cancelMobileWheelMotion();
animateToStoryPosition(index * window.innerHeight, [id], desktopScrollDuration, id);
return;
}
}
const target = document.getElementById(id);
const sectionIndex = mobileStorySections.findIndex((section) => section.id === id);
if (target && sectionIndex >= 0 && isMobileStoryLayout()) {
cancelMobileWheelMotion();
const splashHeight = document.getElementById('splash')?.offsetHeight ?? window.innerHeight;
const sectionOffset = mobileStorySections.slice(0, sectionIndex).reduce((offset, section) => {
return offset + (document.getElementById(section.id)?.offsetHeight ?? window.innerHeight);
}, splashHeight);
animateToStoryPosition(sectionOffset, [id], mobileScrollDuration, id);
return;
}
const mobilePage = target?.closest<HTMLElement>('[data-mobile-page]');
if (mobilePage) {
cancelMobileWheelMotion();
const pages = Array.from(document.querySelectorAll<HTMLElement>('[data-mobile-page]'));
const pageIndex = pages.indexOf(mobilePage);
const splashHeight = document.getElementById('splash')?.offsetHeight ?? window.innerHeight;
const pageOffset = pages.slice(0, pageIndex).reduce((height, page) => height + page.offsetHeight, splashHeight);
const sectionIds = Array.from(mobilePage.querySelectorAll<HTMLElement>('.story-section')).map((section) => section.id);
animateToStoryPosition(pageOffset, sectionIds, mobileScrollDuration, id);
return;
}
target?.scrollIntoView({
behavior: 'smooth',
block: 'start',
});
}
//=================
type RevealTechnique = 'default' | 'mask' | 'eyebrow';
//=================
function Reveal({ children, className = '', delay = 0, from = 'up', kind = 'text', technique = 'default' }: { children: ReactNode; className?: string; delay?: number; from?: 'left' | 'right' | 'up' | 'down' | 'right-down'; kind?: 'text' | 'image' | 'ornament'; technique?: RevealTechnique }) {
const revealRef = useRef<HTMLDivElement>(null);
const [isInView, setIsInView] = useState(false);
const [observerDelay, setObserverDelay] = useState<number | null>(null);
useEffect(() => {
const element = revealRef.current;
if (isInView || !element) return;
let stopObserving = () => {};
const beginObserving = () => {
stopObserving = observeOnce(element, revealObserverOptions(0.16, true), (entry) => {
const duration = revealDurations[kind];
const easing = kind === 'image' ? imageEase : ease;
const transitionDelay = transitionRevealDelay(element, entry.time, duration, easing);
if (transitionDelay !== null) setObserverDelay(transitionDelay);
setIsInView(true);
});
};
const unsubscribe = subscribeToStoryStart(beginObserving);
return () => { unsubscribe(); stopObserving(); };
}, [isInView, kind]);
const compact = isMobileStoryLayout();
const distance = compact ? 24 : Math.min(52, Math.max(40, window.innerWidth * 0.035));
const offset = from === 'left' ? { x: -distance } : from === 'right' ? { x: distance } : from === 'right-down' ? { x: distance * 0.55, y: distance * 0.28 } : from === 'down' ? { y: -16 } : { y: kind === 'image' ? 16 : 12 };
const initial = technique === 'mask'
? { opacity: 0, y: 12 }
: technique === 'eyebrow'
? { opacity: 0, x: -16, letterSpacing: '.24em' }
: kind === 'image' ? { opacity: 0, ...offset, scale: 0.97 } : kind === 'ornament' ? { opacity: 0, ...offset, scale: 0.82, rotate: -8 } : { opacity: 0, ...offset };
const visible = technique === 'mask'
? { opacity: 1, x: 0, y: 0 }
: technique === 'eyebrow'
? { opacity: 1, x: 0, letterSpacing: '.19em' }
: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 };
const effectiveDelay = observerDelay ?? (revealRef.current ? revealDelay(delay, revealRef.current, kind) : 0);
return (
<motion.div
className={`${className} motion-${technique}`.trim()}
data-reveal=""
ref={revealRef}
initial={initial}
animate={isInView ? visible : initial}
transition={{ duration: revealDurations[kind], delay: effectiveDelay, ease: kind === 'image' ? imageEase : ease }}
>
{technique === 'mask' ? (
<motion.div
className="motion-mask-window"
initial={{ clipPath: 'inset(0 0 100% 0)' }}
animate={isInView ? { clipPath: 'inset(0 0 0% 0)' } : { clipPath: 'inset(0 0 100% 0)' }}
transition={{ duration: revealDurations[kind], delay: effectiveDelay, ease }}
>
{children}
</motion.div>
) : children}
</motion.div>
);
}
//=================
function SectionAtmosphere({ variant }: { variant: 'hero' | 'profile' | 'journey' | 'letter' | 'finale' | 'keepsake' }) {
const atmosphereRef = useRef<HTMLDivElement>(null);
const [isInView, setIsInView] = useState(false);
const [observerDelay, setObserverDelay] = useState<number | null>(null);
useEffect(() => {
const element = atmosphereRef.current;
if (isInView || !element) return;
let stopObserving = () => {};
const beginObserving = () => {
stopObserving = observeOnce(element, revealObserverOptions(0.08), (entry) => {
const transitionDelay = transitionRevealDelay(element, entry.time, revealDurations.ornament, imageEase);
if (transitionDelay !== null) setObserverDelay(transitionDelay);
setIsInView(true);
});
};
const unsubscribe = subscribeToStoryStart(beginObserving);
return () => { unsubscribe(); stopObserving(); };
}, [isInView]);
return (
<motion.div
className={`section-atmosphere section-atmosphere-${variant}`}
data-section-atmosphere=""
aria-hidden="true"
ref={atmosphereRef}
initial={{ opacity: 0 }}
animate={{ opacity: isInView ? 1 : 0 }}
transition={{ duration: revealDurations.ornament, delay: observerDelay ?? ambientRevealDelay(), ease: imageEase }}
/>
);
}
//=================
function SectionDoodles({ variant }: { variant: 'hero' | 'profile' | 'journey' | 'letter' | 'finale' | 'keepsake' }) {
const doodlesRef = useRef<HTMLDivElement>(null);
const [isInView, setIsInView] = useState(false);
const [observerDelay, setObserverDelay] = useState<number | null>(null);
useEffect(() => {
const element = doodlesRef.current;
if (isInView || !element) return;
let stopObserving = () => {};
const beginObserving = () => {
stopObserving = observeOnce(element, revealObserverOptions(0.08), (entry) => {
const transitionDelay = transitionRevealDelay(element, entry.time, revealDurations.ornament, imageEase);
if (transitionDelay !== null) setObserverDelay(transitionDelay);
setIsInView(true);
});
};
const unsubscribe = subscribeToStoryStart(beginObserving);
return () => { unsubscribe(); stopObserving(); };
}, [isInView]);

return (
<motion.div
ref={doodlesRef}
className={`section-doodles section-doodles-${variant}`}
aria-hidden="true"
initial={{ opacity: 0 }}
animate={{ opacity: isInView ? 1 : 0 }}
transition={{ duration: revealDurations.ornament, delay: observerDelay ?? ambientRevealDelay(), ease: imageEase }}
>
<span className="doodle-slashes doodle-slashes-a" />
<span className="doodle-slashes doodle-slashes-b" />
<span className="doodle-star doodle-star-a">✣</span>
<span className="doodle-star doodle-star-b">✦</span>
<span className="doodle-cross" />
<span className="doodle-dots" />
<svg className="doodle-hexes" viewBox="0 0 100 100">
<polygon points="28,5 48,16 48,39 28,50 8,39 8,16" />
<polygon points="68,35 88,46 88,69 68,80 48,69 48,46" />
<polygon points="28,61 42,69 42,85 28,93 14,85 14,69" />
</svg>
<svg className="doodle-orbit" viewBox="0 0 140 100">
<path d="M8 60C24 17 91 8 127 34c24 18 5 48-28 51C58 89 28 74 35 50c5-17 32-24 54-18" />
<circle cx="9" cy="60" r="2" /><circle cx="127" cy="34" r="2" />
</svg>
</motion.div>
);
}
//=================
function Artwork({ name, alt, className = '', characterBackdrop = false }: { name: keyof typeof ELAINA_ASSETS; alt: string; className?: string; characterBackdrop?: boolean }) {
const [failed, setFailed] = useState(false);
const src = ELAINA_ASSETS[name];
return (
<div className={`artwork ${className}${characterBackdrop ? ' character-art' : ''}`}>
{characterBackdrop && <CharacterBlockEffect className="character-art-backdrop" />}
{!failed && src ? (
<img src={src} alt={alt} draggable={false} loading={name === 'hero' ? 'eager' : 'lazy'} fetchPriority={name === 'hero' ? 'high' : 'auto'} decoding="async" onError={() => setFailed(true)} />
) : (
<div className="artwork-placeholder" role="img" aria-label={`${name} illustration placeholder for Elaina`}>
<div className="placeholder-sky"><span /><span /><span /></div>
<div className="placeholder-sun" />
<div className="placeholder-hill placeholder-hill-back" />
<div className="placeholder-hill placeholder-hill-front" />
<div className="placeholder-caption"><Sparkles size={14} /> Elaina illustration</div>
</div>
)}
</div>
);
}
//=================
//=================
function SectionLabel({ children }: { children: ReactNode }) {
return <p className="section-label"><span />{children}</p>;
}
//=================
function ProfileGfxLayers() {
return <>
<span className="profile-gfx-halo" />
<span className="profile-gfx-slab profile-gfx-slab-a" />
<span className="profile-gfx-slab profile-gfx-slab-b" />
<span className="profile-gfx-slab profile-gfx-slab-c" />
<span className="profile-gfx-slab profile-gfx-slab-d" />
<span className="profile-gfx-facet profile-gfx-facet-a" />
<span className="profile-gfx-facet profile-gfx-facet-b" />
<span className="profile-gfx-orbit" />
</>;
}
function CharacterBlockEffect({ className }: { className: string }) {
return <div className={`profile-gfx-depth ${className}`} aria-hidden="true"><ProfileGfxLayers /></div>;
}
//=================
function ProfileGfxArtwork() {
const sceneRef = useRef<HTMLDivElement>(null);
const { scrollYProgress } = useScroll({ target: sceneRef, offset: ['start end', 'end start'] });
const backgroundY = useTransform(scrollYProgress, [0, 1], [18, -18]);
const characterY = useTransform(scrollYProgress, [0, 1], [7, -7]);
const foregroundY = useTransform(scrollYProgress, [0, 1], [-12, 12]);
return (
<div ref={sceneRef} className="profile-gfx-scene">
<motion.div className="profile-gfx-depth" style={{ y: backgroundY }} aria-hidden="true">
<ProfileGfxLayers />
</motion.div>
<motion.div className="profile-gfx-character" style={{ y: characterY }}>
<Artwork name="profile" alt="Elaina profile illustration" className="profile-art" />
</motion.div>
<motion.div className="profile-gfx-foreground" style={{ y: foregroundY }} aria-hidden="true">
<span className="profile-gfx-light-point profile-gfx-light-point-a" />
<span className="profile-gfx-light-point profile-gfx-light-point-b" />
</motion.div>
<span className="art-note">A portrait of Elaina</span>
</div>
);
}
//=================
const Navbar = memo(function Navbar() {
const [active, setActive] = useState('splash');
useEffect(() => {
let frame = 0;
const updateActiveSection = () => {
frame = 0;
if (activeNavigationTarget) {
const navigationTarget = activeNavigationTarget;
setActive((previous) => previous === navigationTarget ? previous : navigationTarget);
return;
}
if (window.matchMedia('(min-width: 1101px)').matches) {
const activeIndex = Math.min(sections.length - 1, Math.floor((window.scrollY + window.innerHeight * 0.5) / window.innerHeight));
setActive((previous) => previous === sections[activeIndex].id ? previous : sections[activeIndex].id);
return;
}
if (isMobileStoryLayout()) {
let sectionStart = document.getElementById('splash')?.offsetHeight ?? window.innerHeight;
let currentId = sections[0].id;
for (const { id } of mobileStorySections) {
if (window.scrollY + window.innerHeight * 0.4 < sectionStart) break;
currentId = id;
const section = document.getElementById(id);
sectionStart += section?.offsetHeight ?? window.innerHeight;
}
setActive((previous) => previous === currentId ? previous : currentId);
return;
}
const groupMarker = window.scrollY + window.innerHeight * 0.4;
let groupStart = document.getElementById('splash')?.offsetHeight ?? window.innerHeight;
let currentGroup = 'splash';
for (const group of document.querySelectorAll<HTMLElement>('[data-mobile-page]')) {
if (groupMarker < groupStart) break;
currentGroup = group.dataset.mobilePage ?? currentGroup;
groupStart += group.offsetHeight;
}
setActive((previous) => previous === currentGroup ? previous : currentGroup);
};
const scheduleUpdate = () => {
if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
};
updateActiveSection();
window.addEventListener('scroll', scheduleUpdate, { passive: true });
window.addEventListener('resize', scheduleUpdate);
return () => {
window.removeEventListener('scroll', scheduleUpdate);
window.removeEventListener('resize', scheduleUpdate);
if (frame) window.cancelAnimationFrame(frame);
};
}, []);
const onNavigate = (id: string) => setActive(id);
const onSplash = active === 'splash';
return (
<motion.nav
className="site-nav"
aria-label="Main navigation"
aria-hidden={onSplash}
inert={onSplash}
initial={false}
animate={onSplash ? 'hidden' : 'visible'}
variants={{
hidden: { opacity: 0, y: -18, scale: 0.98 },
visible: { opacity: 1, y: 0, scale: 1 },
}}
transition={{ duration: 0.56, ease }}
style={{ pointerEvents: onSplash ? 'none' : 'auto' }}
>
<div className="nav-mark" aria-hidden="true"><Sparkles size={15} /><span>Majo no Tabitabi</span></div>
<div className="nav-links">
{sections.filter((section) => section.id !== 'splash').map((section) => <button key={section.id} type="button" className={active === section.id ? 'active' : ''} aria-controls={section.id} onClick={() => { onNavigate(section.id); scrollToSection(section.id); }}>{section.label}</button>)}
</div>
<span className="nav-gift" aria-hidden="true"><Gift size={16} /></span>
</motion.nav>
);
});
//=================
function useVelocityParallax(enabled: boolean) {
useEffect(() => {
if (!enabled || window.matchMedia('(min-width: 1101px)').matches) return;
const layers = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-layer]'));
const depths = layers.map((layer) => Number(layer.dataset.scrollLayer) || 1);
const original = layers.map((layer) => layer.style.transform);
let previousY = window.scrollY;
let previousTime = performance.now();
let velocity = 0;
let frame = 0;
const update = (time: number) => {
frame = 0;
const elapsed = Math.max(time - previousTime, 1);
previousTime = time;
velocity *= Math.exp(-elapsed / 115);
const offset = Math.max(-8, Math.min(8, -velocity * 1.25));
layers.forEach((layer, index) => {
layer.style.transform = `translate3d(0, ${offset * depths[index]}px, 0)`;
});
if (Math.abs(velocity) > 0.015) frame = requestAnimationFrame(update);
};
const onScroll = () => {
const now = performance.now();
const y = window.scrollY;
velocity = (y - previousY) / Math.max(now - previousTime, 1);
previousY = y;
if (!frame) frame = requestAnimationFrame(update);
};
layers.forEach((layer) => { layer.style.willChange = 'transform'; });
window.addEventListener('scroll', onScroll, { passive: true });
return () => {
window.removeEventListener('scroll', onScroll);
if (frame) cancelAnimationFrame(frame);
layers.forEach((layer, index) => {
layer.style.transform = original[index];
layer.style.willChange = '';
});
};
}, [enabled]);
}
//=================
function useDesktopWheelNavigation(enabled: boolean) {
useEffect(() => {
if (!enabled) return;
let frame = 0;
let animationId = 0;
let isAnimating = false;
let wheelGestureActive = false;
let wheelGestureTimer: ReturnType<typeof setTimeout> | null = null;
const cancel = () => {
animationId += 1;
if (frame) cancelAnimationFrame(frame);
if (wheelGestureTimer) clearTimeout(wheelGestureTimer);
wheelGestureTimer = null;
wheelGestureActive = false;
frame = 0;
isAnimating = false;
activeScrollTransition = null;
};
cancelDesktopWheelMotion = cancel;
const moveSection = (direction: number) => {
if (!window.matchMedia('(min-width: 1101px)').matches || direction === 0) return;
cancelSectionScroll();
if (isAnimating) return;
const now = performance.now();
const viewportHeight = window.innerHeight;
const currentIndex = Math.round(window.scrollY / viewportHeight);
const nextIndex = Math.max(0, Math.min(sections.length - 1, currentIndex + Math.sign(direction)));
if (nextIndex === currentIndex) return;
if (frame) cancelAnimationFrame(frame);
const startY = window.scrollY;
const targetY = nextIndex * viewportHeight;
const startTime = now;
const duration = desktopScrollDuration;
const currentAnimation = ++animationId;
isAnimating = true;
activeScrollTransition = { sectionIds: [sections[nextIndex].id], startTime, duration };
const animate = (time: number) => {
if (currentAnimation !== animationId) return;
const progress = Math.min(1, (time - startTime) / duration);
const eased = desktopScrollEase(progress);
window.scrollTo({ top: startY + (targetY - startY) * eased, behavior: 'instant' });
if (progress < 1) frame = requestAnimationFrame(animate);
else {
frame = 0;
isAnimating = false;
activeScrollTransition = null;
}
};
frame = requestAnimationFrame(animate);
};
moveDesktopSection = moveSection;
const onWheel = (event: WheelEvent) => {
if (!window.matchMedia('(min-width: 1101px)').matches || event.ctrlKey || event.deltaY === 0) return;
event.preventDefault();
if (wheelGestureTimer) clearTimeout(wheelGestureTimer);
wheelGestureTimer = setTimeout(() => {
wheelGestureActive = false;
wheelGestureTimer = null;
}, wheelGestureIdleDuration);
if (wheelGestureActive) return;
wheelGestureActive = true;
moveSection(Math.sign(event.deltaY));
};
let pointerStart: { id: number; x: number; y: number } | null = null;
const onPointerDown = (event: PointerEvent) => {
if (!window.matchMedia('(min-width: 1101px)').matches || event.pointerType !== 'mouse' || event.button !== 0) return;
if (event.target instanceof Element && event.target.closest('a, button, input, textarea, select, [role="button"]')) return;
pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
};
const onPointerUp = (event: PointerEvent) => {
const start = pointerStart;
pointerStart = null;
if (!start || start.id !== event.pointerId || event.pointerType !== 'mouse') return;
const deltaX = event.clientX - start.x;
const deltaY = event.clientY - start.y;
if (Math.abs(deltaY) < 76 || Math.abs(deltaY) < Math.abs(deltaX) * 1.2) return;
moveSection(-Math.sign(deltaY));
};
const onPointerCancel = () => { pointerStart = null; };
window.addEventListener('wheel', onWheel, { passive: false });
window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerCancel);
return () => {
window.removeEventListener('wheel', onWheel);
window.removeEventListener('pointerdown', onPointerDown);
window.removeEventListener('pointerup', onPointerUp);
window.removeEventListener('pointercancel', onPointerCancel);
cancel();
if (cancelDesktopWheelMotion === cancel) cancelDesktopWheelMotion = () => {};
if (moveDesktopSection === moveSection) moveDesktopSection = null;
};
}, [enabled]);
}
//=================
function useMobileWheelNavigation(enabled: boolean) {
useEffect(() => {
if (!enabled) return;
let frame = 0;
let animationId = 0;
let isAnimating = false;
let wheelGestureActive = false;
let wheelGestureTimer: ReturnType<typeof setTimeout> | null = null;
const cancel = () => {
animationId += 1;
if (frame) cancelAnimationFrame(frame);
if (wheelGestureTimer) clearTimeout(wheelGestureTimer);
frame = 0;
isAnimating = false;
wheelGestureActive = false;
wheelGestureTimer = null;
activeScrollTransition = null;
};
cancelMobileWheelMotion = cancel;
const movePage = (direction: number) => {
if (isIntermediatePointerViewport() || !direction) return;
cancelSectionScroll();
if (isAnimating) return;
const isPhoneLayout = isMobileStoryLayout();
const mobilePages = isPhoneLayout
? mobileStorySections.map(({ id }) => document.getElementById(id)).filter((page): page is HTMLElement => page instanceof HTMLElement)
: Array.from(document.querySelectorAll<HTMLElement>('[data-mobile-page]'));
let pageOffset = document.getElementById('splash')?.offsetHeight ?? window.innerHeight;
const pagePositions = mobilePages.map((page) => {
const offset = pageOffset;
pageOffset += page.offsetHeight;
return offset;
});
const pages = [0, ...pagePositions];
const currentIndex = pages.reduce((closest, position, index) =>
Math.abs(position - window.scrollY) < Math.abs(pages[closest] - window.scrollY) ? index : closest, 0);
const nextIndex = Math.max(0, Math.min(pages.length - 1, currentIndex + Math.sign(direction)));
if (nextIndex === currentIndex) return;
if (frame) cancelAnimationFrame(frame);
const startY = window.scrollY;
const targetY = pages[nextIndex];
const startTime = performance.now();
const currentAnimation = ++animationId;
isAnimating = true;
const targetSection = nextIndex === 0 ? sections[0] : mobileStorySections[nextIndex - 1];
activeScrollTransition = { sectionIds: [targetSection.id], startTime, duration: mobileScrollDuration };
const animate = (time: number) => {
if (currentAnimation !== animationId) return;
const progress = Math.min(1, (time - startTime) / mobileScrollDuration);
window.scrollTo({ top: startY + (targetY - startY) * desktopScrollEase(progress), behavior: 'instant' });
if (progress < 1) frame = requestAnimationFrame(animate);
else {
frame = 0;
isAnimating = false;
activeScrollTransition = null;
}
};
frame = requestAnimationFrame(animate);
};
const onWheel = (event: WheelEvent) => {
if (isIntermediatePointerViewport() || event.ctrlKey || event.deltaY === 0) return;
event.preventDefault();
if (wheelGestureTimer) clearTimeout(wheelGestureTimer);
wheelGestureTimer = setTimeout(() => {
wheelGestureActive = false;
wheelGestureTimer = null;
}, wheelGestureIdleDuration);
if (wheelGestureActive) return;
wheelGestureActive = true;
movePage(Math.sign(event.deltaY));
};
let pointerStart: { id: number; x: number; y: number } | null = null;
const onPointerDown = (event: PointerEvent) => {
if (event.pointerType !== 'touch' || (event.target instanceof Element && event.target.closest('a, button, input, textarea, select, [contenteditable="true"], [role="button"]'))) return;
pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
};
const onPointerUp = (event: PointerEvent) => {
const start = pointerStart;
pointerStart = null;
if (!start || start.id !== event.pointerId || event.pointerType !== 'touch') return;
const deltaX = event.clientX - start.x;
const deltaY = event.clientY - start.y;
if (Math.abs(deltaY) < 48 || Math.abs(deltaY) < Math.abs(deltaX) * 1.15) return;
movePage(-Math.sign(deltaY));
};
const onPointerCancel = () => { pointerStart = null; };
window.addEventListener('wheel', onWheel, { passive: false });
window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerCancel);
return () => {
window.removeEventListener('wheel', onWheel);
window.removeEventListener('pointerdown', onPointerDown);
window.removeEventListener('pointerup', onPointerUp);
window.removeEventListener('pointercancel', onPointerCancel);
animationId += 1;
if (frame) cancelAnimationFrame(frame);
if (wheelGestureTimer) clearTimeout(wheelGestureTimer);
wheelGestureTimer = null;
wheelGestureActive = false;
activeScrollTransition = null;
if (cancelMobileWheelMotion === cancel) cancelMobileWheelMotion = () => {};
};
}, [enabled]);
}
//=================
function Hero({ entered }: { entered: boolean }) {
return (
<section id="home" data-scroll-layer="0.25" className={`hero-section story-section ${entered ? 'is-entered' : ''}`}>
<SectionAtmosphere variant="hero" />
<SectionDoodles variant="hero" />
<motion.div className="hero-glow" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: entered ? 1 : 0 }} transition={{ duration: revealDurations.ornament, delay: 0.12, ease: imageEase }} />
<div className="hero-copy">
<motion.div className="motion-eyebrow" data-reveal="" initial={{ opacity: 0, x: -16, letterSpacing: '.24em' }} animate={entered ? { opacity: 1, x: 0, letterSpacing: '.19em' } : { opacity: 0, x: -16, letterSpacing: '.24em' }} transition={{ duration: revealDurations.text, delay: heroOverlapDelays.eyebrow, ease }}>
<SectionLabel>Made for Elaina</SectionLabel>
</motion.div>
<motion.h1 data-reveal="" initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }} animate={entered ? { opacity: 1, clipPath: 'inset(0 0 0% 0)' } : { opacity: 0, clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: revealDurations.text, delay: heroOverlapDelays.heading, ease }}>
Happy Birthday,<br /><em>Elaina!</em>
</motion.h1>
<motion.p className="hero-subtitle" data-reveal="" initial={{ opacity: 0, x: 40 }} animate={entered ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }} transition={{ duration: revealDurations.text, delay: heroOverlapDelays.supporting, ease }}>
My favorite witch since 2020. This little birthday page is for you.
</motion.p>
<motion.button type="button" className="text-link" data-reveal="" onClick={() => scrollToSection('elaina')} initial={{ opacity: 0, y: 25 }} animate={entered ? { opacity: 1, y: 0 } : { opacity: 0, y: 25 }} transition={{ duration: revealDurations.text, delay: heroOverlapDelays.link, ease }}>
Explore the page <ArrowRight size={16} />
</motion.button>
</div>
<motion.div className="hero-art-wrap" data-reveal="" initial={{ opacity: 0, x: isMobileStoryLayout() ? 24 : 50, scale: 0.97 }} animate={entered ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: isMobileStoryLayout() ? 24 : 50, scale: 0.97 }} transition={{ duration: revealDurations.image, delay: heroOverlapDelays.image, ease: imageEase }}>
<Artwork name="hero" alt="Elaina birthday hero illustration" className="hero-art" characterBackdrop />
<motion.span className="hero-sparkle sparkle-one" initial={{ opacity: 0, scale: 0.8, rotate: -8 }} animate={entered ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0 }} transition={{ duration: revealDurations.ornament, delay: 0.22 }}><Star size={17} /></motion.span>
<motion.span className="hero-sparkle sparkle-two" initial={{ opacity: 0, scale: 0.8, rotate: 8 }} animate={entered ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0 }} transition={{ duration: revealDurations.ornament, delay: 0.28 }}><Sparkles size={20} /></motion.span>
</motion.div>
<span className="hero-index" aria-hidden="true">01 / 06</span>
</section>
);
}
//=================
const MeetElaina = memo(function MeetElaina() {
return (
<section id="elaina" data-scroll-layer="0.5" className="profile-section story-section">
<SectionAtmosphere variant="profile" />
<SectionDoodles variant="profile" />
<Reveal className="profile-art-column profile-art-column-gfx" from="left" kind="image" delay={entrance.image}><ProfileGfxArtwork /></Reveal>
<div className="profile-copy">
<Reveal technique="eyebrow" delay={entrance.eyebrow}><SectionLabel>THE ASHEN WITCH</SectionLabel></Reveal>
<Reveal technique="mask" delay={entrance.heading}><h2>Why <em>Elaina?</em></h2><p className="eyebrow">WHAT I LIKE ABOUT HER</p></Reveal>
<Reveal delay={entrance.supporting} from="right"><p className="body-copy">I like her curiosity, her confidence, and the way every journey brings a new story.</p></Reveal>
<Reveal className="profile-footnote" delay={entrance.ornament} kind="ornament"><span>✳</span><span>Still my favorite witch.</span></Reveal>
</div>
<span className="section-number">02 / 06</span>
</section>
);
});
//=================
const chapters = [
{ number: 'I', title: 'The journeys', text: 'Every place has its own story.', art: 'journeyOne' as const, alt: 'Elaina on the open road' },
{ number: 'II', title: 'Elaina herself', text: "She's the reason this series became special to me.", art: 'journeyTwo' as const, alt: 'Elaina discovering a new place' },
];
//=================
const Journey = memo(function Journey() {
return (
<section id="journey" data-scroll-layer="0.75" className="journey-section story-section">
<SectionAtmosphere variant="journey" />
<SectionDoodles variant="journey" />
<div className="section-heading">
<Reveal technique="eyebrow" delay={entrance.eyebrow}><SectionLabel>FROM MAJO NO TABITABI</SectionLabel></Reveal>
<Reveal technique="mask" delay={entrance.heading}><h2>Elaina's <em>world</em></h2></Reveal>
<Reveal delay={entrance.supporting}><p>Two things I'll always love about the series.</p></Reveal>
</div>
<div className="journey-route" aria-hidden="true"><span /><i /><span /></div>
<div className="chapter-grid">
{chapters.map((chapter, index) => <div key={chapter.number} className={`chapter chapter-${index + 1}`}>
<Reveal className="chapter-art-reveal" delay={0.5 + index * 0.18} from={index === 0 ? 'left' : 'right'} kind="image">
<div className="chapter-photo-canvas">
<Artwork name={chapter.art} alt={chapter.alt} className="chapter-art" />
<div className="chapter-photo-mark" aria-hidden="true">
<span>POSTCARD 0{index + 1}</span>
<i>{String(index + 1).padStart(2, '0')} / 02</i>
</div>
</div>
</Reveal>
<Reveal className="chapter-caption" delay={0.88 + index * 0.18}><span className="chapter-number">{chapter.number}</span><div><h3>{chapter.title}</h3><p>{chapter.text}</p></div><Reveal className="chapter-star" delay={0.32 + index * 0.16} kind="ornament"><span>✳</span></Reveal></Reveal>
</div>)}
</div>
<footer className="site-footer"><span>© Kagenou · A birthday page for Elaina</span></footer>
<span className="section-number">06 / 06</span>
</section>
);
});
//=================
const Letter = memo(function Letter() {
return (
<section id="letter" data-scroll-layer="0.5" className="letter-section story-section">
<SectionAtmosphere variant="letter" />
<SectionDoodles variant="letter" />
<div className="letter-copy"><Reveal technique="eyebrow" delay={entrance.eyebrow}><SectionLabel>A NOTE FROM KAGENOU</SectionLabel></Reveal><Reveal technique="mask" delay={entrance.heading}><h2>A note for <em>Elaina</em></h2></Reveal>
<div className="letter-text">
<Reveal delay={0.82} from="right"><p>Dear Elaina,</p></Reveal>
<Reveal delay={0.94} from="right"><p>Happy birthday! I'm glad Majo no Tabitabi introduced me to you.</p></Reveal>
<Reveal delay={1.06} from="right"><p>I hope this little message brings a smile to your day.</p></Reveal>
<Reveal delay={1.3} from="right"><p className="letter-signoff">— Kagenou</p></Reveal>
</div>
</div>
<div className="letter-art-column"><Reveal className="letter-art-reveal" delay={entrance.image} from="right" kind="image"><Artwork name="letter" alt="Elaina letter section illustration" className="letter-art" characterBackdrop /></Reveal></div>
<span className="section-number">03 / 06</span>
</section>
);
});
//=================
const Finale = memo(function Finale() {
return (
<section id="finale" data-scroll-layer="0.25" className="finale-section story-section">
<SectionAtmosphere variant="finale" />
<SectionDoodles variant="finale" />
<div className="finale-copy">
<Reveal technique="eyebrow" delay={entrance.eyebrow}><SectionLabel>A BIRTHDAY WISH</SectionLabel></Reveal>
<Reveal technique="mask" delay={entrance.heading}><h2>Keep wandering,<br /><em>Elaina.</em></h2></Reveal>
<Reveal className="finale-message" delay={entrance.supporting}><p>Happy birthday, Elaina.</p><p>I hope we get to see more of your adventures.</p></Reveal>
</div>
<Reveal className="finale-art-wrap" from="left" kind="image" delay={0.5}>
<div className="finale-gfx-slashes" aria-hidden="true"><i /><i /><i /><i /><i /></div>
<Artwork name="finale" alt="Elaina birthday finale illustration" className="finale-art" characterBackdrop />
<Reveal className="finale-star finale-star-a" delay={0.85} kind="ornament"><span>✧</span></Reveal><Reveal className="finale-star finale-star-b" delay={1} kind="ornament"><span>✳</span></Reveal><Reveal className="finale-star finale-star-c" delay={1.15} kind="ornament"><span>✧</span></Reveal>
</Reveal>
<span className="section-number">04 / 06</span>
</section>
);
});
//=================
const Keepsake = memo(function Keepsake() {
return (
<section id="keepsake" data-scroll-layer="0.5" className="letter-section keepsake-section story-section">
<SectionAtmosphere variant="keepsake" />
<SectionDoodles variant="keepsake" />
<div className="letter-copy keepsake-copy">
<Reveal technique="eyebrow" delay={entrance.eyebrow} from="left"><SectionLabel>A LITTLE BIRTHDAY GIFT</SectionLabel></Reveal>
<Reveal technique="mask" delay={entrance.heading} from="left"><h2>Something I made <em>for you.</em></h2></Reveal>
<Reveal delay={entrance.supporting} from="left"><p className="body-copy">I wanted to do more than post a birthday wish, so I made this little tribute.</p></Reveal>
<Reveal className="profile-footnote" delay={entrance.ornament} kind="ornament"><span>✳</span><span>From Kagenou, with love.</span></Reveal>
</div>
<Reveal className="keepsake-art-column" from="right" kind="image" delay={entrance.image}>
<Artwork name="keepsake" alt="Elaina with a small puppet familiar" className="keepsake-art" characterBackdrop />
</Reveal>
<span className="section-number">05 / 06</span>
</section>
);
});
//=================
function SplashScreen({ onEnter, active }: { onEnter: () => void; active: boolean }) {
const pointerStartY = useRef<number | null>(null);
const hasEntered = useRef(false);
const enterOnce = () => {
if (!active || hasEntered.current) return;
hasEntered.current = true;
onEnter();
};
const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
const start = pointerStartY.current;
pointerStartY.current = null;
if (active && start !== null && start - event.clientY > 72) enterOnce();
};
const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
if (!active) return;
if ((event.target as HTMLElement).closest('button')) return;
pointerStartY.current = event.clientY;
};
const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
if (active && event.deltaY > 0) enterOnce();
};
const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
if (active && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowUp')) {
event.preventDefault();
enterOnce();
}
};
return (
<div
 className={`splash-screen${active ? ' is-active' : ''}`}
role={active ? 'dialog' : 'region'}
aria-modal={active}
aria-label={active ? "Swipe up to enter Elaina's birthday page by Kagenou" : 'Birthday page for Elaina by Kagenou'}
aria-hidden={!active}
tabIndex={active ? 0 : -1}
onPointerDown={handlePointerDown}
onPointerUp={handlePointerUp}
onPointerCancel={() => { pointerStartY.current = null; }}
onWheel={handleWheel}
onKeyDown={handleKeyDown}
>
<div className="splash-orbit splash-orbit-one" aria-hidden="true" />
<div className="splash-orbit splash-orbit-two" aria-hidden="true" />
<motion.div className="splash-stars" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: active ? 1 : 0 }} transition={{ delay: 0.55, duration: animationDuration(0.8), ease }}>
<Star /><Sparkles /><Star />
</motion.div>
<motion.div className="splash-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: animationDuration(1), ease }}>
<div className="splash-title-group">
<motion.span className="splash-eyebrow" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.36, duration: animationDuration(0.75), ease }}><i /> A birthday page by Kagenou <i /></motion.span>
<motion.h1 id="splash-title" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: animationDuration(.9), ease }}>Elaina</motion.h1>
<motion.span className="splash-rule" aria-hidden="true" initial={{ opacity: 0, scaleX: 0.45 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.62, duration: animationDuration(0.8), ease }}><i /><span>✦</span><i /></motion.span>
<motion.p className="splash-tagline" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.76, duration: animationDuration(0.8), ease }}>For my favorite witch.</motion.p>
</div>
</motion.div>
<motion.span className="splash-swipe-hint" aria-hidden="true" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: animationDuration(.9), ease }}><span>SWIPE UP TO BEGIN</span><ArrowUp size={18} /></motion.span>
</div>
);
}
//=================
export default function App() {
const [showSplash, setShowSplash] = useState(true);
const [heroEntered, setHeroEntered] = useState(false);
useVelocityParallax(!showSplash);
useDesktopWheelNavigation(!showSplash);
useMobileWheelNavigation(!showSplash);
const enterStory = () => {
startStoryRevealObservers();
setShowSplash(false);
setHeroEntered(true);
if (isDesktopStory()) {
const beginPageTurn = () => {
if (moveDesktopSection) moveDesktopSection(1);
else requestAnimationFrame(beginPageTurn);
};
requestAnimationFrame(beginPageTurn);
} else {
requestAnimationFrame(() => {
const splashHeight = document.getElementById('splash')?.offsetHeight ?? window.innerHeight;
window.scrollTo({ top: splashHeight, behavior: 'smooth' });
});
}
};
useEffect(() => {
const body = document.body;
const previousOverflow = body.style.overflow;
if (showSplash) body.style.overflow = 'hidden';
return () => { body.style.overflow = previousOverflow; };
}, [showSplash]);
useEffect(() => {
const preventPageSelectAll = (event: KeyboardEvent) => {
if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return;
const target = event.target;
if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) return;
event.preventDefault();
};
document.addEventListener('keydown', preventPageSelectAll, true);
return () => document.removeEventListener('keydown', preventPageSelectAll, true);
}, []);
return (
<main className="birthday-page">
<section id="splash" className="splash-transition story-section" aria-label="Opening splash">
<SplashScreen onEnter={enterStory} active={showSplash} />
</section>
<Navbar />
<div className="mobile-page-group" data-mobile-page="home">
<Hero entered={heroEntered} />
<MeetElaina />
</div>
<div className="mobile-page-group" data-mobile-page="letter">
<Letter />
<Finale />
</div>
<div className="mobile-page-group" data-mobile-page="keepsake">
<Keepsake />
<Journey />
</div>
</main>
);
}
//=================
