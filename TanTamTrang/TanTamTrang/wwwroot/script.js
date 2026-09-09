function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.topnav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}
setActiveNav();

/* Vertical face counter on the About and Poster pages.
   The rail draws a LOOP, not a line: face N-1 is followed by face 0, so the
   scale it stands for is one whole revolution and the divisor is N, not N-1.
   Dividing by N-1 pinned the last label to 100% — the very same point as 01
   at 0% — and then let the marker run 1/(N-1) of the rail PAST the bottom
   before it wrapped: 66px into empty space with seven faces, 132px with four.
   With N the marker stays inside [0,100%) on its own and 100% IS 0%, so the
   wrap needs no special case.
   The labels are built from the faces instead of being typed into the page,
   so the rail can no longer disagree with the cube about how many there are —
   poster.html had grown to seven faces while the stylesheet still positioned
   four, and 05, 06 and 07 had no `top` at all and piled up on top of 01. */
function buildRail(rail, n) {
  if (!rail) return null;
  const marker = rail.querySelector('.progress-marker');
  rail.querySelectorAll('.progress-label').forEach((el) => el.remove());
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'progress-label';
    s.textContent = String(i + 1).padStart(2, '0');
    s.style.top = (i / n * 100).toFixed(3) + '%';
    frag.appendChild(s);
  }
  rail.insertBefore(frag, marker);   // marker stays last so it paints on top
  return marker;
}

/* Headroom for the endless roll.
   maintainLoop() fakes an infinite scroll by silently jumping the scroll
   position two revolutions back whenever it comes within one revolution of
   either end of the spacer — and it refuses to do that unless the spacer is
   worth at least five revolutions, because with less there is nowhere safe to
   land. One revolution is `count` viewport-heights, so the height the spacer
   needs is a function of how many items are on the roll.
   It used to be a constant per page with the count of the day baked into it
   (24 viewport-heights for a four-face cube, 42 for a seven-work reel). Going
   from four posters to seven raised the requirement from 20 to 35 while the
   spacer stayed at 24, so the loop quietly switched itself off — no error, the
   scroll just ran to the bottom and stopped dead on the third poster.
   Derive it from the real count instead. Still expressed in vh, so it keeps
   following the viewport on resize exactly as the constant did. */
const SPACER_LOOPS = 8;             // revolutions of headroom; maintainLoop needs 5
function sizeLoopSpacer(spacer, count) {
  if (!spacer || !count) return;
  spacer.style.height = (count * SPACER_LOOPS * 100) + 'vh';
}

const aboutPage = document.querySelector('.about-page');
if (aboutPage) {
  const cube = document.getElementById('aboutCube');
  const faces = [...document.querySelectorAll('.cube-face')];
  const leftTitle = document.getElementById('leftTitle');
  const leftBody = document.getElementById('leftBody');
  const rightLabel = document.getElementById('rightLabel');
  const rightTitle = document.getElementById('rightTitle');
  const rightBody = document.getElementById('rightBody');
  const count = document.getElementById('aboutCount');
  const marker = buildRail(document.querySelector('.progress-rail'), faces.length);
  sizeLoopSpacer(document.querySelector('.about-cube-spacer'), faces.length);

  const N_FACES = faces.length;

  const slides = [
    {
      lt: 'VISUAL DESIGNER',
      lb: 'I build visual ideas through image-making, typography and atmosphere.',
      rl: 'FOCUS',
      rt: 'CONCEPT / IMAGE / DIRECTION',
      rb: 'Selected works, experiments and personal visual research.'
    },
    {
      lt: 'HYBRID PRACTICE',
      lb: 'My practice moves between visual design, photography, type and experience.',
      rl: 'APPROACH',
      rt: 'RESEARCH / TEST / REFINE',
      rb: 'Research and experimentation shape the visual language before the final execution.'
    },
    {
      lt: 'ART DIRECTION',
      lb: 'I am interested in building complete visual worlds rather than isolated graphics.',
      rl: 'NEXT',
      rt: '3D / MOTION / CULTURE',
      rb: 'My practice will keep evolving into motion, 3D and larger visual systems.'
    },
    {
      lt: 'BEYOND STILL',
      lb: 'Increasingly, the work lives across formats — stills, motion and interactive space.',
      rl: 'NOW',
      rt: 'DESIGN / MOTION / SPACE',
      rb: 'Currently expanding this practice into spatial and interactive visual work.'
    }
  ];

  let activeIndex = -1;
  let ticking = false;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap = (i) => ((i % N_FACES) + N_FACES) % N_FACES;
  const STEP_DEG = 360 / N_FACES;
  // shortest circular distance between two face indices (handles the 4→0 wrap)
  const circDist = (a, b) => { const d = Math.abs(a - b) % N_FACES; return d > N_FACES / 2 ? N_FACES - d : d; };

  // Cube geometry: 4 faces 90° apart, pushed back by half the face height
  // so they meet edge-to-edge like a real box — same regular-polygon math
  // as the Works reel, just rotating around X (rolling) instead of Y (spinning).
  // The whole cube is then pushed forward by that same radius so the
  // frontal face sits exactly at the zone's natural (undistorted) plane.
  let radius = 0;
  let lastBoxW = 0, lastBoxH = 0;
  // NEVER measure the cube itself. It carries the live rotateX()/translateZ(),
  // so getBoundingClientRect() hands back the *projected* box (perspective
  // scales it too), not the layout box. Feeding that back in as the radius
  // makes the faces stop meeting at the edges and the cube visibly deforms.
  // On a phone the URL bar fires resize over and over mid-scroll, so the
  // error compounded on every one of them. The zone is untransformed.
  function cubeBox() {
    const zone = cube && cube.parentElement;
    if (zone) { const r = zone.getBoundingClientRect(); if (r.height) return r; }
    return { width: cube ? cube.offsetWidth : 0, height: cube ? cube.offsetHeight : 0 };
  }
  function layoutCube(force) {
    if (!cube) return;
    const b = cubeBox();
    if (!b.height) return;
    // a URL-bar nudge that did not actually change the box is not a relayout
    if (!force && Math.abs(b.width - lastBoxW) < 1 && Math.abs(b.height - lastBoxH) < 1) return;
    lastBoxW = b.width; lastBoxH = b.height;
    // NOTE: the About roll is deliberately NOT a sealed prism — three panels
    // at height/2 stand apart from each other, and that spacing is the look.
    // (The poster roll below does use the true apothem: it has seven faces,
    // which at this radius would cut through one another.)
    radius = b.height / 2;
    faces.forEach((f, i) => {
      f.dataset.baseTf = `rotateX(${(i * STEP_DEG).toFixed(2)}deg) translateZ(${(-radius).toFixed(1)}px)`;
      f.style.transform = f.dataset.baseTf;
    });
  }
  layoutCube(true);

  function updateText(i) {
    if (i === activeIndex) return;
    activeIndex = i;

    const textEls = [leftTitle, leftBody, rightLabel, rightTitle, rightBody];
    textEls.forEach(el => el.classList.add('text-fade-out'));

    setTimeout(() => {
      const s = slides[i];
      leftTitle.textContent = s.lt;
      leftBody.textContent = s.lb;
      rightLabel.textContent = s.rl;
      rightTitle.textContent = s.rt;
      rightBody.textContent = s.rb;
      count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(N_FACES).padStart(2, '0');
      textEls.forEach(el => el.classList.remove('text-fade-out'));
    }, 120);
  }

  // One full revolution = N_FACES viewport-heights of scroll, exactly like
  // the Works reel — scrolling by any exact multiple of that spins the cube
  // whole turns (visually identical), so the position can be silently
  // re-centred near either end of the spacer for an endless roll.
  function maintainLoop() {
    const vh = viewH();
    const period = N_FACES * vh;
    const maxScroll = document.documentElement.scrollHeight - vh;
    const buffer = period * 1;
    const y = window.scrollY;
    if (maxScroll < period * 5) return;
    if (y < buffer) {
      window.scrollTo({ top: y + period * 2, left: 0, behavior: 'instant' });
    } else if (y > maxScroll - buffer) {
      window.scrollTo({ top: y - period * 2, left: 0, behavior: 'instant' });
    }
  }

  let snapTimer = null;
  let snapRAF = null;
  let programmaticY = null;
  // A fling keeps firing scroll events with gaps in them; snapping after only
  // 70ms would start while the momentum is still running and fight it, which
  // is what made the roll judder on a phone. Wait longer on touch, and never
  // snap while a finger is still down.
  const COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const SNAP_DELAY = COARSE ? 190 : 70;
  const SNAP_DURATION = 190;
  let touchDown = false;
  // The mobile URL bar changes innerHeight mid-scroll. Recomputing f = scrollY/vh
  // against a viewport that just moved makes the roll jump a whole step, so hold
  // the height steady while a scroll is in flight and re-sync once it settles.
  let vhRef = window.innerHeight;
  let lastVW = window.innerWidth;
  let lastScrollT = 0;
  const viewH = () => vhRef || window.innerHeight;

  function cancelSnap() {
    if (snapRAF) { cancelAnimationFrame(snapRAF); snapRAF = null; }
  }

  function animateScrollTo(targetY, duration) {
    cancelSnap();
    if (!Number.isFinite(targetY)) return;
    const startY = window.scrollY;
    const delta = targetY - startY;
    if (Math.abs(delta) < 0.5) return;
    programmaticY = Math.round(startY);
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const y = startY + delta * eased;
      programmaticY = Math.round(y);
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      snapRAF = p < 1 ? requestAnimationFrame(step) : null;
      if (p >= 1) programmaticY = null;
    }
    snapRAF = requestAnimationFrame(step);
  }

  // Once the user stops scrolling, roll the rest of the way so the nearest
  // face lands dead-on instead of stopping mid-roll.
  function snapToNearest() {
    if (touchDown) return;
    const vh = viewH();
    const targetF = Math.round(window.scrollY / vh);
    animateScrollTo(targetF * vh, SNAP_DURATION);
  }

  function renderAbout() {
    ticking = false;

    const vh = viewH();
    const f = window.scrollY / vh;
    if (!Number.isFinite(f)) return;

    const nearest = wrap(Math.round(f));
    updateText(nearest);

    if (marker) {
      let cyclePos = f % N_FACES;
      if (cyclePos < 0) cyclePos += N_FACES;
      marker.style.top = `${(cyclePos / N_FACES * 100).toFixed(2)}%`;
    }

    if (cube) {
      cube.style.transform = `translateZ(${radius.toFixed(1)}px) rotateX(${(-f * STEP_DEG).toFixed(2)}deg)`;
    }

    faces.forEach((f2, i) => {
      const d = circDist(f, i);
      // dim faces as they roll away from front-facing (skip identical writes —
      // restyling a filter on a preserve-3d child is expensive on mobile)
      const br = lerp(1, 0.45, clamp(d, 0, 1)).toFixed(2);
      if (f2.dataset.br !== br) { f2.dataset.br = br; f2.style.filter = `brightness(${br})`; }
    });

    maintainLoop();
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(renderAbout);
      ticking = true;
    }
    lastScrollT = performance.now();
    if (touchDown) return;               // let the fling finish on its own
    if (programmaticY === null || Math.abs(window.scrollY - programmaticY) > 2) {
      cancelSnap();
      clearTimeout(snapTimer);
      snapTimer = setTimeout(snapToNearest, SNAP_DELAY);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  function onViewportChange() {
    const w = window.innerWidth;
    const scrolling = performance.now() - lastScrollT < 250;
    // a real resize (rotation, window drag) resyncs the held height; a URL-bar
    // nudge in the middle of a scroll does not
    if (w !== lastVW || !scrolling) { lastVW = w; vhRef = window.innerHeight; }
    layoutCube();
    renderAbout();
  }
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', () => {
    lastVW = -1;
    setTimeout(() => { onViewportChange(); layoutCube(true); renderAbout(); }, 120);
  });
  window.addEventListener('touchstart', () => {
    touchDown = true; cancelSnap(); clearTimeout(snapTimer);
  }, { passive: true });
  window.addEventListener('touchend', () => {
    touchDown = false; clearTimeout(snapTimer);
    snapTimer = setTimeout(snapToNearest, SNAP_DELAY);
  }, { passive: true });
  window.addEventListener('touchcancel', () => { touchDown = false; }, { passive: true });
  renderAbout();
}


/* =========================================================
   POSTER — ROLLING CUBE  (same mechanism as the About page)
   Four posters on the four vertical faces of a fixed cube; the
   wheel rolls it around X. A tall spacer gives the scroll room,
   the position is silently re-centred near either end so the
   roll loops forever, and once the wheel stops the nearest face
   snaps dead-on. Left/right copy swaps per face.
   ========================================================= */
(function () {
  const page = document.querySelector('.poster-cube-page');
  if (!page) return;

  const cube  = document.getElementById('posterCube');
  const faces = [...page.querySelectorAll('.cube-face')];
  const elTitle = document.getElementById('pcTitle');
  const elBody  = document.getElementById('pcBody');
  const elTag   = document.getElementById('pcTag');
  const elNote  = document.getElementById('pcNote');
  const elCount = document.getElementById('pcCount');
  if (!cube || faces.length < 3) return;

  const marker  = buildRail(page.querySelector('.progress-rail'), faces.length);
  sizeLoopSpacer(page.querySelector('.about-cube-spacer'), faces.length);
  const N_FACES = faces.length;

  const slides = [
    {
      title: 'TRUNG THU',
      body:  'Mid-autumn festival poster — soft light, warm colour, a little astronaut for scale.',
      tag:   'FESTIVAL / ILLUSTRATION',
      note:  'Made for Trung Thu — one frame, warm and quiet.'
    },
    {
      title: 'OCTOPUS IN THE DARK',
      body:  'Editorial poster study — a glowing silhouette, halftone texture, circular type running through it.',
      tag:   'EDITORIAL / TYPE',
      note:  'A study in silhouette, halftone and type on a curve.'
    },
    {
      title: 'INTO THE FOREST',
      body:  'Soundtrack poster — a photo-composite of a fox mid-leap through forest god-rays, reaching for a small burning flower.',
      tag:   'SOUNDTRACK / COMPOSITE',
      note:  'Composited light — rays, particles, one warm accent.'
    },
    {
      title: 'CƠM TẤM',
      body:  'Paper-collage food poster — Saigon landmarks torn from old newsprint, gathered around a plate of broken rice.',
      tag:   'FOOD / COLLAGE',
      note:  'Newsprint, landmarks and a plate — the taste of a city.'
    },
    {
      title: 'MADE IN VIETNAM',
      body:  'Product poster — gold type on lacquer red, with two pairs of chopsticks standing in for the letters they interrupt.',
      tag:   'PRODUCT / TYPOGRAPHY',
      note:  'The hand completes the word — craft as the letterform.'
    },
    {
      title: 'VÒNG XOÁY TUYỆT VỌNG',
      body:  'Environmental poster — Vietnam held inside a blackened globe, bound in chain, one smokestack still running.',
      tag:   'ENVIRONMENT / AWARENESS',
      note:  'Two colours only: red for the warning, black for the cost.'
    },
    {
      title: 'LOOKING',
      body:  'Duotone type study — a kitten pushing out from behind oversized outlined letters, framed by heavy quote marks.',
      tag:   'TYPE / DUOTONE',
      note:  'Green on green, with the animal reading the line back at you.'
    }
  ];

  let activeIndex = -1;
  let ticking = false;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap = (i) => ((i % N_FACES) + N_FACES) % N_FACES;
  const STEP_DEG = 360 / N_FACES;
  const circDist = (a, b) => { const d = Math.abs(a - b) % N_FACES; return d > N_FACES / 2 ? N_FACES - d : d; };

  let radius = 0;
  let lastBoxW = 0, lastBoxH = 0;
  // NEVER measure the cube itself. It carries the live rotateX()/translateZ(),
  // so getBoundingClientRect() hands back the *projected* box (perspective
  // scales it too), not the layout box. Feeding that back in as the radius
  // makes the faces stop meeting at the edges and the cube visibly deforms.
  // On a phone the URL bar fires resize over and over mid-scroll, so the
  // error compounded on every one of them. The zone is untransformed.
  function cubeBox() {
    const zone = cube && cube.parentElement;
    if (zone) { const r = zone.getBoundingClientRect(); if (r.height) return r; }
    return { width: cube ? cube.offsetWidth : 0, height: cube ? cube.offsetHeight : 0 };
  }
  function layoutCube(force) {
    if (!cube) return;
    const b = cubeBox();
    if (!b.height) return;
    // a URL-bar nudge that did not actually change the box is not a relayout
    if (!force && Math.abs(b.width - lastBoxW) < 1 && Math.abs(b.height - lastBoxH) < 1) return;
    lastBoxW = b.width; lastBoxH = b.height;
    // Apothem of a regular N-sided prism whose faces are b.height tall.
    // height/2 is only the answer for N = 4, where tan(45deg) = 1. With seven
    // faces that radius is barely half what it needs to be and the panels
    // drive straight through one another. Identical at four, correct at any.
    radius = (b.height / 2) / Math.tan(Math.PI / N_FACES);
    faces.forEach((f, i) => {
      f.dataset.baseTf = `rotateX(${(i * STEP_DEG).toFixed(2)}deg) translateZ(${(-radius).toFixed(1)}px)`;
      f.style.transform = f.dataset.baseTf;
    });
  }
  layoutCube(true);

  function updateText(i) {
    if (i === activeIndex) return;
    activeIndex = i;
    const els = [elTitle, elBody, elTag, elNote].filter(Boolean);
    els.forEach(el => el.classList.add('text-fade-out'));
    setTimeout(() => {
      const s = slides[i] || slides[0];
      if (elTitle) elTitle.textContent = s.title;
      if (elBody)  elBody.textContent  = s.body;
      if (elTag)   elTag.textContent   = s.tag;
      if (elNote)  elNote.textContent  = s.note;
      if (elCount) elCount.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(N_FACES).padStart(2, '0');
      els.forEach(el => el.classList.remove('text-fade-out'));
    }, 120);
  }

  function maintainLoop() {
    const vh = viewH();
    const period = N_FACES * vh;
    const maxScroll = document.documentElement.scrollHeight - vh;
    const buffer = period * 1;
    const y = window.scrollY;
    if (maxScroll < period * 5) return;
    if (y < buffer) {
      window.scrollTo({ top: y + period * 2, left: 0, behavior: 'instant' });
    } else if (y > maxScroll - buffer) {
      window.scrollTo({ top: y - period * 2, left: 0, behavior: 'instant' });
    }
  }

  let snapTimer = null;
  let snapRAF = null;
  let programmaticY = null;
  // A fling keeps firing scroll events with gaps in them; snapping after only
  // 70ms would start while the momentum is still running and fight it, which
  // is what made the roll judder on a phone. Wait longer on touch, and never
  // snap while a finger is still down.
  const COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const SNAP_DELAY = COARSE ? 190 : 70;
  const SNAP_DURATION = 190;
  let touchDown = false;
  // The mobile URL bar changes innerHeight mid-scroll. Recomputing f = scrollY/vh
  // against a viewport that just moved makes the roll jump a whole step, so hold
  // the height steady while a scroll is in flight and re-sync once it settles.
  let vhRef = window.innerHeight;
  let lastVW = window.innerWidth;
  let lastScrollT = 0;
  const viewH = () => vhRef || window.innerHeight;

  function cancelSnap() {
    if (snapRAF) { cancelAnimationFrame(snapRAF); snapRAF = null; }
  }

  function animateScrollTo(targetY, duration) {
    cancelSnap();
    if (!Number.isFinite(targetY)) return;
    const startY = window.scrollY;
    const delta = targetY - startY;
    if (Math.abs(delta) < 0.5) return;
    programmaticY = Math.round(startY);
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const y = startY + delta * eased;
      programmaticY = Math.round(y);
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      snapRAF = p < 1 ? requestAnimationFrame(step) : null;
      if (p >= 1) programmaticY = null;
    }
    snapRAF = requestAnimationFrame(step);
  }

  function snapToNearest() {
    if (touchDown) return;
    const vh = viewH();
    const targetF = Math.round(window.scrollY / vh);
    animateScrollTo(targetF * vh, SNAP_DURATION);
  }

  function renderPoster() {
    ticking = false;
    const vh = viewH();
    const f = window.scrollY / vh;
    if (!Number.isFinite(f)) return;

    updateText(wrap(Math.round(f)));

    if (marker) {
      let cyclePos = f % N_FACES;
      if (cyclePos < 0) cyclePos += N_FACES;
      marker.style.top = `${(cyclePos / N_FACES * 100).toFixed(2)}%`;
    }

    cube.style.transform = `translateZ(${radius.toFixed(1)}px) rotateX(${(-f * STEP_DEG).toFixed(2)}deg)`;

    faces.forEach((f2, i) => {
      const d = circDist(f, i);
      const br = lerp(1, 0.45, clamp(d, 0, 1)).toFixed(2);
      if (f2.dataset.br !== br) { f2.dataset.br = br; f2.style.filter = `brightness(${br})`; }
    });

    maintainLoop();
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(renderPoster);
      ticking = true;
    }
    lastScrollT = performance.now();
    if (touchDown) return;               // let the fling finish on its own
    if (programmaticY === null || Math.abs(window.scrollY - programmaticY) > 2) {
      cancelSnap();
      clearTimeout(snapTimer);
      snapTimer = setTimeout(snapToNearest, SNAP_DELAY);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  function onViewportChange() {
    const w = window.innerWidth;
    const scrolling = performance.now() - lastScrollT < 250;
    // a real resize (rotation, window drag) resyncs the held height; a URL-bar
    // nudge in the middle of a scroll does not
    if (w !== lastVW || !scrolling) { lastVW = w; vhRef = window.innerHeight; }
    layoutCube();
    renderPoster();
  }
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', () => {
    lastVW = -1;
    setTimeout(() => { onViewportChange(); layoutCube(true); renderPoster(); }, 120);
  });
  window.addEventListener('touchstart', () => {
    touchDown = true; cancelSnap(); clearTimeout(snapTimer);
  }, { passive: true });
  window.addEventListener('touchend', () => {
    touchDown = false; clearTimeout(snapTimer);
    snapTimer = setTimeout(snapToNearest, SNAP_DELAY);
  }, { passive: true });
  window.addEventListener('touchcancel', () => { touchDown = false; }, { passive: true });
  renderPoster();
})();








/* =========================================================
   HOME — INFINITE VIDEO REEL
   Four muted, looping videos stacked full-screen. Each <video>
   is parked on a virtual loop (scrollY % period) so the four
   just keep coming around forever; the tall spacer only exists
   to give the wheel / trackpad something real to move. Native
   colours, no filters. The scrollbar is hidden in CSS.
   ========================================================= */
(function () {
  const reel = document.getElementById('homeReel');
  if (!reel) return;

  const stage = document.getElementById('homeReelStage');
  const spacer = document.getElementById('homeReelSpacer');
  const slides = [...reel.querySelectorAll('.home-slide')];
  const N = slides.length;
  if (!stage || !spacer || !N) return;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const LOOPS = 40;            // how many full cycles the spacer holds
  const MID = LOOPS / 2;       // start cycle (middle of the spacer)
  let vh = window.innerHeight;
  let period = N * vh;         // scroll distance for one full cycle
  let ticking = false;
  let carry = 0;               // sub-pixel glide the scroll position can't hold

  function sizeSpacer() {
    vh = window.innerHeight;
    period = N * vh;
    spacer.style.height = (period * LOOPS) + 'px';
  }

  function safePlay(v) {
    if (!v || !v.paused) return;
    v.muted = true;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }

  // Bind each <video> once: re-assert playback if the browser pauses a
  // clip that is still on screen (background tabs, power saving, etc.).
  slides.forEach(s => {
    s._video = s.querySelector('video');
    if (!s._video) return;
    s._video.muted = true;
    s._video.addEventListener('pause', () => {
      if (s._want && !document.hidden) safePlay(s._video);
    });
  });

  function applyPlayback(slide, want) {
    slide._want = want;
    const v = slide._video;
    if (!v) return;
    if (want) safePlay(v);
    else if (!v.paused) v.pause();
  }

  function render() {
    ticking = false;
    // carry is the sub-pixel part of the glide the scroll position cannot
    // hold (see glideTick). Folding it in here is what actually makes the
    // motion smooth: transforms composite at sub-pixel precision, scroll
    // offsets do not.
    const y0 = window.scrollY + carry;
    for (let i = 0; i < N; i++) {
      let y = ((i * vh - y0) % period + period) % period;   // [0, period)
      if (y >= period - vh) y -= period;                     // -> [-vh, period - vh)
      slides[i].style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
      applyPlayback(slides[i], y > -vh && y < vh);           // only decode what's on screen
    }
    maintainLoop();
  }

  function maintainLoop() {
    const max = document.documentElement.scrollHeight - vh;
    if (max < period * 6) return;
    const y = window.scrollY;
    if (y < period * 2 || y > max - period * 2) {
      // hop a whole number of cycles back toward the middle -> zero visual change
      const shift = Math.round((period * MID - y) / period) * period;
      if (shift) window.scrollTo({ top: y + shift, left: 0, behavior: 'instant' });
    }
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(render);
      ticking = true;
    }
  }

  // re-centre on a clean cycle boundary (one full-screen clip showing)
  function center() {
    sizeSpacer();
    carry = 0;
    window.scrollTo({ top: period * MID, left: 0, behavior: 'instant' });
    render();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    // keep the same point in the cycle across a viewport change
    const phase = period ? (window.scrollY % period) / period : 0;
    sizeSpacer();
    window.scrollTo({ top: period * MID + phase * period, left: 0, behavior: 'instant' });
    render();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  /* ---- self-scroll ------------------------------------------------------
     The reel glides on its own: ~one full-screen clip every SLIDE_MS.
     Any real input (wheel, touch, arrows) hands control back to the user;
     after RESUME_MS of stillness the glide picks up again. Delta-timed so
     a hidden tab or a loop hop never causes a jump.

     It stays perfectly still until the intro is off the screen. The intro
     ends by zooming bugs-home to full frame, and bugs-home is this reel's
     first slide — so the reel must be parked on that same slide, motionless,
     when the canvas dissolves away, or the illusion of one continuous shot
     dies the instant the handover happens. Then it holds a beat longer, and
     eases up to speed over RAMP_MS rather than snapping into motion.      */
  const SLIDE_MS = 8000;
  const RESUME_MS = 2600;
  const HOLD_MS = 2000;        // stillness after the intro hands the frame over
  const RAMP_MS = 1600;        // time to reach full pace from a standstill
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let armed = false;           // intro is done and the hold has elapsed
  let glide = !reduceMotion;   // the user has not taken over
  let speed = 0;               // 0..1 of full pace
  let lastT = 0;
  let resumeTimer = 0;

  function pauseGlide() {
    glide = false;
    speed = 0;                 // yield to the user at once — only the return eases
    if (resumeTimer) clearTimeout(resumeTimer);
    if (!reduceMotion) resumeTimer = setTimeout(() => { glide = true; }, RESUME_MS);
  }

  ['wheel', 'touchstart', 'touchmove', 'pointerdown'].forEach(ev =>
    window.addEventListener(ev, pauseGlide, { passive: true }));
  window.addEventListener('keydown', e => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Spacebar'].includes(e.key)) pauseGlide();
  });

  function glideTick(t) {
    const dt = lastT ? Math.min(t - lastT, 50) : 16;
    lastT = t;
    const want = armed && glide && !document.hidden;
    if (!want) { carry = 0; window.requestAnimationFrame(glideTick); return; }

    if (speed < 1) speed = Math.min(1, speed + dt / RAMP_MS);
    // smoothstep: zero acceleration at both ends, so there is no kick as
    // the reel leaves the standstill and none as it reaches full pace
    const k = speed * speed * (3 - 2 * speed);

    /* A document scroll offset is a whole number of pixels — scrollTo simply
       refuses a fraction. Handing it scrollY + 1.14 every frame therefore
       moved it 1px and binned the 0.14, which cost 12% of the pace and, far
       worse, flattened the whole ramp: every step below 1px read as no
       movement at all, so the reel sat still and then snapped straight to
       full speed. So bank the fraction instead, spend it once it is worth a
       whole pixel, and let render() draw the remainder as a transform. */
    carry += (vh / SLIDE_MS) * dt * k;
    const whole = Math.floor(carry);
    if (whole >= 1) {
      carry -= whole;
      window.scrollTo({ top: window.scrollY + whole, left: 0, behavior: 'instant' });
    }
    render();
    window.requestAnimationFrame(glideTick);
  }
  window.requestAnimationFrame(glideTick);

  function armGlide() { armed = true; }

  /* Wait for the intro to report in, then hold. If there is no intro on the
     page at all (libraries blocked, a re-entry that skipped it) there is
     nothing to wait for, and the hard stop guarantees the reel is never
     left frozen because the intro failed to say it was done. */
  const introLayer = document.getElementById('canvas-container');
  if (!introLayer || getComputedStyle(introLayer).display === 'none') {
    setTimeout(armGlide, HOLD_MS);
  } else {
    const waitIntro = setInterval(() => {
      if (!window.introFinished) return;
      clearInterval(waitIntro);
      setTimeout(armGlide, HOLD_MS);
    }, 120);
    setTimeout(() => { clearInterval(waitIntro); armGlide(); }, 26000);
  }

  /* The intro's final act is bugs-home filling the frame, and slide 0 is
     that same clip — so put the two on the same frame just before the
     dissolve starts. Both crop it the same way (cover, centred), so once
     the timecodes agree the cross-fade reads as one continuous shot
     instead of a cut to another take. */
  window.addEventListener('intro:handoff', (e) => {
    center();                                  // park exactly on slide 0
    const v = slides[0] && slides[0]._video;
    const t = e.detail && e.detail.time;
    if (!v || typeof t !== 'number' || !isFinite(t)) return;
    if (v.readyState < 2 || !v.duration || t < 0 || t >= v.duration) return;
    // Only jump to a point already downloaded: a seek that has to go and
    // fetch would stall on a blank frame, which is far worse than being a
    // couple of seconds out on a shot that looks the same either way.
    let ready = false;
    for (let i = 0; i < v.buffered.length; i++) {
      if (t >= v.buffered.start(i) && t <= v.buffered.end(i) - 0.15) { ready = true; break; }
    }
    if (!ready) return;
    if (Math.abs(v.currentTime - t) > 0.12) v.currentTime = t;
    safePlay(v);
  });

  center();
  // viewport height isn't final until layout settles — re-centre once it is
  window.addEventListener('load', center);
  // idle safety net: nothing scrolling, but a visible clip got paused
  setInterval(() => {
    if (document.hidden) return;
    slides.forEach(s => { if (s._want) safePlay(s._video); });
  }, 900);
})();


/* =========================
   V8 3D CREATIVE CODING (THREE.JS + GSAP)
   The original home intro: a cylinder of the transition images
   spins up, the featured one zooms to fill the screen, the 3D
   canvas fades out — then the infinite video reel underneath
   takes over.
   ========================= */
const canvasContainer = document.getElementById('canvas-container');
const webglCanvas = document.getElementById('webgl-canvas');

/* Fail-safe: whatever happens to the intro (a texture 404, a blocked
   library, a stalled GSAP timeline), never let its opaque black layers
   sit on top of the reel forever — but never pre-empt a healthy intro
   either, so when we do step in we FADE, we don't cut.
     - if the GSAP timeline never even started within 10s, the libs or
       textures are dead: dismiss now.
     - if it started but still hasn't finished after 20s, it's wedged:
       dismiss then. A normal run (even a slow one) finishes well inside
       that and clears these layers itself with its own 2s fade. */
function dismissIntroLayers() {
  if (window.introFinished) return;
  window.introFinished = true;
  [document.getElementById('canvas-container'),
   document.getElementById('camcorder-preloader')].forEach((el) => {
    if (!el || getComputedStyle(el).display === 'none') return;
    el.style.transition = 'opacity .8s ease';
    el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none'; }, 850);
  });
  if (window.animationFrameId) cancelAnimationFrame(window.animationFrameId);
  if (window.__introCleanup) window.__introCleanup();
}
/* In a background tab rAF is frozen, so GSAP never ticks and the timeline
   genuinely cannot start — that is not a wedged intro, it is a visitor who
   has not looked yet. Wait for them instead of burning the intro unseen. */
(function armIntroFailSafe() {
  setTimeout(() => {
    if (window.introStarted || window.introFinished) return;
    if (document.hidden) { armIntroFailSafe(); return; }
    dismissIntroLayers();
  }, 10000);
})();
(function armIntroHardStop() {
  setTimeout(() => {
    if (window.introFinished) return;
    if (document.hidden) { armIntroHardStop(); return; }
    dismissIntroLayers();
  }, 20000);
})();

if (canvasContainer && webglCanvas && window.THREE && window.gsap) {
  // 1. Setup Three.js Scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.03); // Cinematic fog

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0); // Camera is in the center of the cylinder

  const renderer = new THREE.WebGLRenderer({
    canvas: webglCanvas,
    alpha: true,
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // 3. Create the cylindrical carousel — every panel is a live video now.
  //    bugs-home sits at index 0: it is the panel parked in front of the
  //    camera on load, and the one that zooms out to fill the screen when
  //    the spin ends, exactly as the still hero used to.
  //
  //    These clips are served from this site, NOT from the Release CDN the
  //    reel below uses: release assets carry no Access-Control-Allow-Origin,
  //    so WebGL would refuse them as a tainted texture. They are small on
  //    purpose (~3 MB for all eight) because the intro is what the visitor
  //    waits on — the full-quality versions still stream in underneath.
  const MEDIA = [
    { src: 'media/intro/bugs-home.mp4',   poster: 'images/poster/bugs-home.jpg' },  // hero
    { src: 'media/intro/city-home.mp4',   poster: 'images/poster/city-home.jpg' },
    { src: 'media/intro/fish-home.mp4',   poster: 'images/poster/fish-home.jpg' },
    { src: 'media/intro/video-home.mp4',  poster: 'images/poster/video-home.jpg' },
    { src: 'media/intro/canyon-home.mp4', poster: 'images/poster/canyon-home.jpg' },
    { src: 'media/intro/mono-home.mp4',   poster: 'images/poster/mono-home.jpg' },
    { src: 'media/intro/ember-home.mp4',  poster: 'images/poster/ember-home.jpg' },
    { src: 'media/intro/c-works.mp4',     poster: 'images/poster/c-works.jpg' }
  ];

  const textureLoader = new THREE.TextureLoader();
  const totalImages = MEDIA.length;
  // Tang radius de khoang cach giua cac hinh rong hon
  const radius = Math.max(15, totalImages * 3.5);

  const carouselGroup = new THREE.Group();
  scene.add(carouselGroup);

  let introFinished = false; // Flag kiem soat hieu ung zoom dau trang
  const planes = [];
  const introVideos = [];
  const introTextures = [];

  const loadingPct = document.getElementById('load-pct');
  const preloader = document.getElementById('camcorder-preloader');

  // Every clip is 1920x1080, so the panel size is known up front — no need to
  // wait for a texture before the cylinder can exist. One shared geometry.
  const panelH = radius * 0.45;
  const panelW = panelH * (16 / 9);
  const panelGeo = new THREE.PlaneGeometry(panelW, panelH, 1, 1);

  // Off-screen but still laid out: display:none would let the browser suspend
  // decoding, and a suspended video hands WebGL a frozen frame.
  const videoHost = document.createElement('div');
  videoHost.setAttribute('aria-hidden', 'true');
  videoHost.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;' +
    'opacity:0;pointer-events:none;z-index:-1';
  document.body.appendChild(videoHost);

  let readyCount = 0;
  let launched = false;
  let heroVideo = null;
  // the intro clips were cut with -ss 0.5, so clip time + this = master time
  const INTRO_CLIP_OFFSET = 0.5;

  MEDIA.forEach((item, index) => {
    const material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true
    });

    // Dam bao hinh chinh (index 0) luon hien thi de len cac hinh khac khi phong to
    if (index === 0) material.depthTest = false;

    const plane = new THREE.Mesh(panelGeo, material);
    if (index === 0) plane.renderOrder = 10;

    // Cong them Math.PI de hinh dau tien nam ngay truoc mat Camera khi moi load
    const angle = (index / totalImages) * Math.PI * 2 + Math.PI;
    plane.position.x = Math.sin(angle) * radius;
    plane.position.z = Math.cos(angle) * radius;
    // lookAt already aims the plane's front (+Z) straight at the camera in
    // the middle. The extra 180deg turn this used to carry span it round to
    // its BACK face, which side:DoubleSide rendered without complaint — as a
    // horizontal mirror. Never showed on the abstract stills; obvious the
    // moment real footage went on the panels.
    plane.lookAt(0, 0, 0);

    carouselGroup.add(plane);
    planes[index] = plane;

    // Poster first so a panel is never an empty black rectangle, then the
    // video takes the slot over the moment it has a decodable frame.
    textureLoader.load(item.poster, (t) => {
      if (material.userData.live) return;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      material.map = t;
      material.needsUpdate = true;
      introTextures.push(t);
    });

    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('loop', '');
    video.src = item.src;
    videoHost.appendChild(video);
    introVideos.push(video);
    if (index === 0) heroVideo = video;

    let counted = false;
    const countIn = () => {
      if (counted) return;
      counted = true;
      readyCount++;
      if (loadingPct) loadingPct.innerText = Math.round((readyCount / totalImages) * 100);
      if (readyCount === totalImages) launch();
    };

    video.addEventListener('loadeddata', () => {
      if (!material.userData.live) {
        material.userData.live = true;
        const vt = new THREE.VideoTexture(video);
        vt.minFilter = THREE.LinearFilter;   // video frames are NPOT: no mipmaps
        vt.magFilter = THREE.LinearFilter;
        vt.generateMipmaps = false;
        vt.wrapS = vt.wrapT = THREE.ClampToEdgeWrapping;
        material.map = vt;
        material.needsUpdate = true;
        introTextures.push(vt);
      }
      video.play().catch(() => {});
      countIn();
    }, { once: true });

    // A dead clip must not hold the door shut — the poster carries that panel.
    video.addEventListener('error', countIn, { once: true });
    video.load();
  });

  // Free the decoders the moment the intro is done: the reel underneath has
  // eight videos of its own and does not need to share the GPU with these.
  window.__introCleanup = function () {
    introVideos.forEach((v) => {
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
    });
    introVideos.length = 0;
    introTextures.forEach((t) => { try { t.dispose(); } catch (e) {} });
    introTextures.length = 0;
    if (videoHost.parentNode) videoHost.parentNode.removeChild(videoHost);
  };

  function launch() {
    if (launched) return;
    launched = true;

    const startIntro = () => {
      window.introStarted = true; // tell the fail-safe the timeline is live
      const tl = gsap.timeline();

      // Tinh toan ty le phong to vua khit man hinh (dua tren FOV va khoang cach)
      const vFov = camera.fov * Math.PI / 180;
      const visibleHeight = 2 * Math.tan(vFov / 2) * radius;
      const visibleWidth = visibleHeight * camera.aspect;

      const pW = panelW;
      const pH = panelH;

      const scaleY = visibleHeight / pH;
      const scaleX = visibleWidth / pW;
      const targetScale = Math.max(scaleX, scaleY) * 1.02; // Lay ty le lon hon va +2% bu goc canh

      // 1. Xoay cuc nhanh 2 vong voi nhip do gat va dien anh hon (expo)
      tl.to(carouselGroup.rotation, {
        y: Math.PI * 4,
        duration: 3.2,
        ease: "expo.inOut"
      });

      // 2. Anticipation: Phong nho (co lai) nhe hon de lay da truoc khi no tung ra
      tl.to(planes[0].scale, {
        x: 0.9, y: 0.9, z: 0.9,
        duration: 0.8,
        ease: "power2.out"
      }, "-=0.8");

      // 3. Phong to manh me ra vua khit man hinh
      tl.to(planes[0].scale, {
        x: targetScale, y: targetScale, z: targetScale,
        duration: 1.4,
        ease: "power4.inOut"
      });

      // 3b. Lift the fog off the hero as it fills the frame, so the clip lands
      //     at full brightness instead of half-swallowed by the cylinder haze.
      tl.to(scene.fog, {
        density: 0,
        duration: 1.4,
        ease: "power2.inOut"
      }, "<");

      // 4. Cho 0.1s roi fade out toan bo Canvas 3D (nen den) de lo dan video reel ben duoi
      tl.to("#canvas-container", {
        opacity: 0,
        duration: 2,
        ease: "power2.out",
        onStart: () => {
          // Tell the reel underneath which frame of bugs-home we are holding,
          // so its own copy can line up before this canvas dissolves away.
          window.dispatchEvent(new CustomEvent('intro:handoff', {
            detail: {
              time: heroVideo && isFinite(heroVideo.currentTime)
                ? heroVideo.currentTime + INTRO_CLIP_OFFSET : null
            }
          }));
        },
        onComplete: () => {
          introFinished = true; // Ket thuc intro 3D
          window.introFinished = true; // let the fail-safe know it's done

          // Intro xong -> nhuong lai cho video reel dang chay ben duoi
          canvasContainer.style.display = 'none';

          // Huy 3D animation loop de tiet kiem tai nguyen
          if (window.animationFrameId) {
            cancelAnimationFrame(window.animationFrameId);
          }
          if (window.__introCleanup) window.__introCleanup();
        }
      }, "+=0.1");
    };

    if (preloader) {
      gsap.to(preloader, {
        opacity: 0,
        duration: 1.5,
        delay: 0.5,
        ease: "power2.inOut",
        onComplete: () => {
          preloader.style.display = 'none';
          startIntro();
        }
      });
    } else {
      startIntro();
    }
  }

  // Never let one slow clip keep the visitor on the loading title: whatever
  // has arrived by now goes on stage, the rest keep their posters.
  setTimeout(launch, 6000);

  // Floating animation
  const clock = new THREE.Clock();

  function animate() {
    window.animationFrameId = requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    if (introFinished) {
      // Khi da vao trang home, tu dong cuon (xoay) khong co diem dung
      carouselGroup.rotation.y += 0.002;
    }

    // Add subtle floating effect to planes
    planes.forEach((plane, index) => {
      if (plane) {
        plane.position.y = Math.sin(elapsedTime * 0.8 + index) * 0.3;
      }
    });

    renderer.render(scene, camera);
  }
  animate();

  // Handle Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

} else if (canvasContainer) {
  // Libraries blocked / offline: skip the 3D intro, just hide its layers.
  canvasContainer.style.display = 'none';
  const preloader = document.getElementById('camcorder-preloader');
  if (preloader) preloader.style.display = 'none';
}


/* ==========================================
   V9 PAGE TRANSITION CONTROLLER
   ========================================== */

(function () {
  const overlay = document.getElementById('pageTransition');
  const hwOverlay = document.getElementById('hwTransition');
  const wcOverlay = document.getElementById('wcTransition');
  const fromLabel = document.getElementById('transitionFrom');
  const toLabel = document.getElementById('transitionTo');

  // Let the entrance curtain animate only after DOM is ready.
  requestAnimationFrame(() => {
    document.body.classList.add('page-ready');
  });

  if (!overlay) return;

  const currentFile = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  const pageNames = {
    'index.html': 'HOME',
    'works.html': 'WORKS',
    'contact.html': 'CONTACT',
    'about.html': 'ABOUT'
  };

  const currentName = pageNames[currentFile] || 'PAGE';

  // Arriving on Works straight from the Home -> Works transition:
  // the frame-5 image is already covering the screen; tear it in half to reveal Works.
  if (
    hwOverlay &&
    currentFile === 'works.html' &&
    document.documentElement.classList.contains('hw-tear-pending')
  ) {
    // permanent: the tear replaces the entrance curtain, keep it suppressed
    document.documentElement.classList.add('hw-tear-done');
    hwOverlay.classList.add('active', 'tear');
    // small wind-up beat, then the rip
    setTimeout(() => hwOverlay.classList.add('tear-go'), 140);
    setTimeout(() => {
      hwOverlay.classList.remove('active', 'tear', 'tear-go');
      document.documentElement.classList.remove('hw-tear-pending');
    }, 1050);
  }

  // Arriving on Works or Contact from the Works <-> Contact transition:
  // the frame-5 image is already covering the screen; split it apart on a
  // curved edge to reveal the page.
  if (
    wcOverlay &&
    (currentFile === 'works.html' || currentFile === 'contact.html') &&
    document.documentElement.classList.contains('wc-split-pending')
  ) {
    document.documentElement.classList.add('wc-split-done');
    wcOverlay.classList.add('active', 'split');
    setTimeout(() => wcOverlay.classList.add('split-go'), 150);
    setTimeout(() => {
      wcOverlay.classList.remove('active', 'split', 'split-go');
      document.documentElement.classList.remove('wc-split-pending');
    }, 1200);
  }

  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');

    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      link.target === '_blank'
    ) {
      return;
    }

    let targetFile = href.split('/').pop().split('?')[0].split('#')[0].toLowerCase();

    if (!pageNames[targetFile]) return;
    if (targetFile === currentFile) return;

    const isHomeWorks =
      (currentFile === 'index.html' && targetFile === 'works.html') ||
      (currentFile === 'works.html' && targetFile === 'index.html');

    const isWorksContact =
      (currentFile === 'works.html' && targetFile === 'contact.html') ||
      (currentFile === 'contact.html' && targetFile === 'works.html');

    link.addEventListener('click', e => {
      e.preventDefault();

      // Works <-> Contact: montage -> hold 1.25s -> curved split reveal (both ways).
      if (isWorksContact && wcOverlay) {
        const wcFrom = document.getElementById('wcFrom');
        const wcTo = document.getElementById('wcTo');
        if (wcFrom) wcFrom.textContent = currentName;
        if (wcTo) wcTo.textContent = pageNames[targetFile];

        wcOverlay.classList.remove('active');
        void wcOverlay.offsetWidth;
        wcOverlay.classList.add('active');

        try { sessionStorage.setItem('wcSplit', '1'); } catch (e) {}
        // frame 5 fully covers at ~1.18s; +1.25s hold => navigate at ~2.43s
        setTimeout(() => { window.location.href = href; }, 2430);
        return;
      }

      // Dedicated transition only between Home and Works (both ways).
      if (isHomeWorks && hwOverlay) {
        const hwFrom = document.getElementById('hwFrom');
        const hwTo = document.getElementById('hwTo');
        if (hwFrom) hwFrom.textContent = currentName;
        if (hwTo) hwTo.textContent = pageNames[targetFile];

        // Going to Works: hold the last frame for 1.25s, then jump to Works
        // where a tear-in-half reveal plays.
        const toWorks = targetFile === 'works.html';

        hwOverlay.classList.remove('active', 'to-works');
        if (toWorks) hwOverlay.classList.add('to-works');
        void hwOverlay.offsetWidth;
        hwOverlay.classList.add('active');

        if (toWorks) {
          try { sessionStorage.setItem('hwTear', '1'); } catch (e) {}
          // frame 5 is fully revealed at ~1.18s; +1.25s hold => navigate at ~2.43s
          setTimeout(() => { window.location.href = href; }, 2430);
        } else {
          setTimeout(() => { window.location.href = href; }, 1340);
        }
        return;
      }

      fromLabel.textContent = currentName;
      toLabel.textContent = pageNames[targetFile];

      overlay.classList.remove('active');

      // restart CSS animations reliably
      void overlay.offsetWidth;
      overlay.classList.add('active');

      // Hand the last frame (transition-05) over to the destination's
      // entrance curtain so there is no black frame between them.
      try { sessionStorage.setItem('ptEnter', '1'); } catch (e) {}

      // Navigate once frame 5 has fully covered the screen (~1.18s) plus a beat.
      setTimeout(() => {
        window.location.href = href;
      }, 1400);
    });
  });
})();

/* ==========================================
   WORKS PAGE TOGGLE
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
  const workRows = document.querySelectorAll('.work-row');
  workRows.forEach(row => {
    row.addEventListener('click', (e) => {
      // Prevent default only if they clicked the main row itself, 
      // but in this setup, the whole row is an <a> tag pointing to "#"
      const href = row.getAttribute('href');
      if (href === '#' || href === '') {
        e.preventDefault();
      }

      // Close others (accordion style) - optional but nice
      workRows.forEach(otherRow => {
        if (otherRow !== row) {
          otherRow.classList.remove('is-open');
        }
      });

      // Toggle current
      row.classList.toggle('is-open');
    });
  });
});

/* ==========================================
   WORKS — INSIDE-OUT LABEL CYLINDER
   All work images sit side by side on one rounded-rect
   "label" wrapped around a vertical cylinder, the way a
   label wraps a bottle. Instead of viewing it from outside
   (convex), the camera sits inside: the work directly ahead
   is flat and frontal, the rest curve away to the sides.
   Scrolling spins the cylinder around its vertical axis.
   ========================================== */
(function () {
  const reel = document.getElementById('worksReel');
  if (!reel) return;

  const ring = document.getElementById('reelRing');
  if (!ring) return;

  const WORKS = [
    { name: 'Arachnid',         role: 'Photography',   img: 'images/spider-bw.jpg', caption: 'Experience Design' },
    { name: 'Jurassic Era',     role: 'Exhibition',     img: 'images/dino-01.jpg', caption: '3D/Video' },
    { name: 'Fossil Structure', role: 'Visual Study',   img: 'images/dino-02.jpg', caption: 'Photography', link: 'photography.html' },
    { name: 'Night Mirror',     role: 'Self Portrait',  img: 'images/about-user-01.png', caption: 'Poster', link: 'poster.html' },
    { name: 'Fogged Glass',     role: 'Photography',    img: 'images/about-user-02.png', caption: 'Typography', link: 'typography.html' },
    { name: 'Thermal Study',    role: 'Experiment',     img: 'images/about-user-03.png', caption: 'Calendar', link: 'calendar.html' },
    { name: 'Digital Art',      role: 'Drawing / Vector', img: 'images/digital-art-01.png', caption: 'Digital Art', link: 'digital-art.html' }
  ];
  const N = WORKS.length;
  sizeLoopSpacer(reel.querySelector('.reel-scroll-spacer'), N);
  const STEP_DEG = 360 / N;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm180 = (deg) => ((deg + 180) % 360 + 360) % 360 - 180;

  const cards = [];
  const captions = [];
  WORKS.forEach((w) => {
    const c = document.createElement('div');
    c.className = 'reel-card';
    c.innerHTML = '<img src="' + w.img + '" alt="' + w.name + '" loading="lazy" draggable="false">';
    ring.appendChild(c);
    cards.push(c);

    let cap = null;
    if (w.caption) {
      cap = document.createElement('div');
      cap.className = 'reel-card-caption';
      cap.textContent = w.caption;
      ring.appendChild(cap);
    }
    captions.push(cap);
  });

  // Size the cards + ring radius so the "label" wraps around the cylinder
  // (regular N-gon inscribed radius for the given card width), pulled out
  // a bit further so neighbouring works sit further apart.
  let RADIUS = 0;
  let FORWARD = 0;
  function layout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Phones get a wider, shorter card: 36% of a narrow viewport is a sliver
    // that is hard to read and hard to tap. Desktop sizing is untouched.
    const narrow = vw <= 700;
    const w = narrow ? Math.min(vw * 0.58, 340) : Math.min(vw * 0.36, 420);
    const h = narrow ? Math.min(vh * 0.58, 540) : vh * 0.70;
    const radius = (w / (2 * Math.tan(Math.PI / N))) * 1.22;   // bigger ring, still some spacing
    RADIUS = radius;
    FORWARD = radius * 0.72;   // brings the frontal work forward to screen centre

    cards.forEach((c, i) => {
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      c.style.marginLeft = (-w / 2) + 'px';
      c.style.marginTop = (-h / 2) + 'px';
      // base position around the ring — render() adds a per-frame scale()
      // on top of this so the frontal work grows and the sides shrink.
      // Negated angle (vs. plain i*STEP_DEG) mirrors the arrangement so the
      // scroll-to-spin direction reads correctly — see render()'s matching sign.
      c.dataset.baseTf = 'rotateY(' + (-i * STEP_DEG).toFixed(2) + 'deg) translateZ(' + (-radius).toFixed(1) + 'px)';
      c.style.transform = c.dataset.baseTf;

      const cap = captions[i];
      if (cap) {
        cap.style.width = w + 'px';
        cap.style.marginLeft = (-w / 2) + 'px';
        cap.dataset.baseTf = c.dataset.baseTf + ' translateY(' + (h / 2 + 22) + 'px)';
        cap.style.transform = cap.dataset.baseTf;
      }
    });
    return radius;
  }
  layout();
  window.addEventListener('resize', () => { layout(); render(); });

  // "Night Mirror" is the featured work — start the reel centred on it
  // instead of work #0, and stop the browser fighting that with its own
  // remembered scroll position on reload/back-navigation.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const FEATURED_IDX = WORKS.findIndex((w) => w.name === 'Night Mirror');
  if (FEATURED_IDX > 0) {
    window.scrollTo({ top: FEATURED_IDX * window.innerHeight, left: 0, behavior: 'instant' });
  }

  // One full revolution = N viewport-heights of scroll. Scrolling by any
  // exact multiple of that spins the ring by whole turns — visually
  // identical — so we can silently re-centre the scroll position whenever
  // it drifts near either end of the spacer, giving an endless loop in
  // both directions.
  function maintainLoop() {
    const vh = window.innerHeight;
    const period = N * vh;                   // scroll distance for one full 360° turn
    const maxScroll = document.documentElement.scrollHeight - vh;
    const buffer = period * 1;
    const y = window.scrollY;
    if (maxScroll < period * 5) return;      // spacer too short — skip
    // `behavior:'instant'` is required here — the page uses smooth scrolling
    // globally, which would otherwise animate this "invisible" re-centre
    // jump and make it visible.
    if (y < buffer) {
      window.scrollTo({ top: y + period * 2, left: 0, behavior: 'instant' });
    } else if (y > maxScroll - buffer) {
      window.scrollTo({ top: y - period * 2, left: 0, behavior: 'instant' });
    }
  }

  let ticking = false;
  let currentIdx = 0;                // work currently dead-centre — used to know what a click on the reel should open
  let snapTimer = null;
  let snapRAF = null;
  let programmaticY = null;         // last y our own snap animation set — lets onScroll tell it apart from a real user scroll
  const SNAP_DELAY = 70;            // ms of no scroll movement before locking to the nearest work
  const SNAP_DURATION = 190;        // ms — fast, fixed-speed ease instead of the browser's slow default smooth-scroll

  function cancelSnap() {
    if (snapRAF) { cancelAnimationFrame(snapRAF); snapRAF = null; }
  }

  // Fixed-duration eased scroll, independent of distance, so the lock always
  // feels equally snappy — bypasses the page's global smooth-scroll (which
  // has no speed control and reads as sluggish for this).
  function animateScrollTo(targetY, duration) {
    cancelSnap();
    if (!Number.isFinite(targetY)) return;
    const startY = window.scrollY;
    const delta = targetY - startY;
    if (Math.abs(delta) < 0.5) return;
    // hold this steady immediately (not just once the first rAF tick lands)
    // so a still-pending scroll notification from just before doesn't get
    // mistaken for fresh user input and cancel the animation we're about to start
    programmaticY = Math.round(startY);
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);   // easeOutCubic
      const y = startY + delta * eased;
      programmaticY = Math.round(y);
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      snapRAF = p < 1 ? requestAnimationFrame(step) : null;
      if (p >= 1) programmaticY = null;
    }
    snapRAF = requestAnimationFrame(step);
  }

  // Once the user stops scrolling, snap the rest of the way so the nearest
  // work lands dead-centre instead of stopping mid-rotation.
  function snapToNearest() {
    if (dragging) return;   // never lock while the user is still actively dragging
    const vh = window.innerHeight;
    const targetF = Math.round(window.scrollY / vh);
    animateScrollTo(targetF * vh, SNAP_DURATION);
  }

  function render() {
    ticking = false;
    const vh = window.innerHeight;

    // one work = one viewport of scroll; the cylinder spins to match
    const f = window.scrollY / vh;
    if (!Number.isFinite(f)) return;
    const ringAngle = f * STEP_DEG;
    // Ring rotates the opposite way of before (paired with the negated angle
    // in each card's baseTf above) — same frontal index at the same scroll
    // position, but the spin direction reads correctly against scroll.
    ring.style.transform =
      'translate(-50%,-50%) translateZ(' + FORWARD.toFixed(1) + 'px) rotateY(' + (ringAngle).toFixed(2) + 'deg)';

    let bestIdx = 0;
    let bestAbs = 999;

    cards.forEach((c, i) => {
      const rel = norm180(ringAngle - i * STEP_DEG);   // angle from dead-ahead
      const ad = Math.abs(rel);
      if (ad < bestAbs) { bestAbs = ad; bestIdx = i; }

      const t = clamp(ad / 92, 0, 1);
      const scale = lerp(1, 0.55, t);   // frontal work stays its normal size, side works shrink
      c.style.opacity = clamp(1.15 - ad / 125, 0, 1).toFixed(3);
      c.style.filter = 'brightness(' + lerp(1, 0.42, t).toFixed(2) + ')';
      c.style.transform = c.dataset.baseTf + ' scale(' + scale.toFixed(3) + ')';
    });

    // captions only show on the exact work they belong to, and only while
    // that work is dead-centre — not a continuous fade like the cards
    captions.forEach((cap, i) => {
      if (cap) cap.style.opacity = i === bestIdx ? '1' : '0';
    });

    currentIdx = bestIdx;
    reel.classList.toggle('reel-link-active', !!(WORKS[bestIdx] && WORKS[bestIdx].link));
    maintainLoop();
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(render);
      ticking = true;
    }
    // only react to real user scrolling — ignore the events our own snap
    // animation generates, so it doesn't keep re-triggering/cancelling itself.
    // Also stay quiet while actively dragging — pointerup triggers the snap
    // itself, so a mid-drag pause must not start a competing lock animation.
    if (!dragging && (programmaticY === null || Math.abs(window.scrollY - programmaticY) > 2)) {
      cancelSnap();
      clearTimeout(snapTimer);
      snapTimer = setTimeout(snapToNearest, SNAP_DELAY);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- drag / swipe to rotate ----
  // Mouse: press and drag left-right — unchanged from before.
  // Touch: the gesture is axis-locked first. A mostly-vertical move is left to
  // the page (scrolling spins the ring anyway); a mostly-horizontal one is taken
  // over here. A quick flick carries on to the next work, and a finger that goes
  // down and up without moving is a tap that opens the centred work.
  let dragging = false;
  let dragMoved = false;        // did this pointerdown->up turn into an actual drag?
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartScroll = 0;
  let touchGesture = false;     // this gesture came from a finger / pen
  let axisPending = false;      // touch: still deciding horizontal vs vertical
  let lastMoveX = 0;
  let lastMoveT = 0;
  let velocity = 0;             // smoothed horizontal px/ms
  const DRAG_SENSITIVITY = 3;   // mouse: px of virtual scroll per px of drag
  const CLICK_SLOP = 6;         // px of movement still treated as a plain click
  const AXIS_SLOP = 8;          // px before a touch gesture commits to an axis
  const FLICK_VELOCITY = 0.35;  // px/ms that counts as a flick

  // on a phone a comfortable ~45%-of-screen swipe should travel one whole work
  function touchSensitivity() {
    const s = window.innerHeight / Math.max(1, window.innerWidth * 0.45);
    return Math.max(2.5, Math.min(s, 8));
  }

  function openCentred() {
    const w = WORKS[currentIdx];
    if (w && w.link) window.location.href = w.link;
  }

  function beginDrag(e) {
    dragging = true;
    dragStartScroll = window.scrollY;
    cancelSnap();
    clearTimeout(snapTimer);
    reel.classList.add('is-dragging');
    if (reel.setPointerCapture) { try { reel.setPointerCapture(e.pointerId); } catch (err) {} }
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    touchGesture = e.pointerType === 'touch' || e.pointerType === 'pen';
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    lastMoveX = e.clientX;
    lastMoveT = e.timeStamp || performance.now();
    velocity = 0;
    dragMoved = false;

    if (touchGesture) {
      // don't claim the gesture yet, and don't preventDefault — a vertical
      // swipe has to stay a normal page scroll (touch-action: pan-y)
      axisPending = true;
      dragging = false;
      dragStartScroll = window.scrollY;
      return;
    }

    beginDrag(e);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging && !axisPending) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (!Number.isFinite(dx)) return;

    if (axisPending) {
      if (Math.abs(dy) > AXIS_SLOP && Math.abs(dy) >= Math.abs(dx)) {
        axisPending = false;              // vertical — hand it back to the page
        return;
      }
      if (Math.abs(dx) > AXIS_SLOP) {
        axisPending = false;
        dragStartX = e.clientX;           // re-baseline at the take-over point
        dragMoved = true;                 // past the slop: this is a drag, not a tap
        beginDrag(e);
      } else {
        return;                           // still undecided
      }
    }

    const t = e.timeStamp || performance.now();
    if (t > lastMoveT) {
      const inst = (e.clientX - lastMoveX) / (t - lastMoveT);
      velocity = velocity * 0.7 + inst * 0.3;
      lastMoveX = e.clientX;
      lastMoveT = t;
    }

    const moved = e.clientX - dragStartX;
    if (Math.abs(moved) > CLICK_SLOP) dragMoved = true;
    const sens = touchGesture ? touchSensitivity() : DRAG_SENSITIVITY;
    const y = Math.max(0, dragStartScroll - moved * sens);
    programmaticY = Math.round(y);
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    if (!touchGesture) e.preventDefault();
  }

  function onPointerUp() {
    const wasPending = axisPending;
    axisPending = false;

    if (!dragging) {
      // finger down and up on the reel without ever picking an axis = a tap
      if (wasPending && touchGesture) openCentred();
      return;
    }

    dragging = false;
    reel.classList.remove('is-dragging');

    // a plain click (no real drag) on the frontal work opens its page, if it has one
    if (!dragMoved) { openCentred(); return; }

    // a quick flick keeps going instead of settling back to where it started
    if (touchGesture && Math.abs(velocity) > FLICK_VELOCITY) {
      const vh = window.innerHeight;
      const fromIdx = Math.round(dragStartScroll / vh);
      const dir = velocity < 0 ? 1 : -1;   // finger sweeps left -> next work
      let target = Math.round(window.scrollY / vh);
      target = dir > 0 ? Math.max(target, fromIdx + 1) : Math.min(target, fromIdx - 1);
      animateScrollTo(target * vh, SNAP_DURATION);
      return;
    }
    snapToNearest();
  }

  function onPointerCancel() {
    axisPending = false;
    if (!dragging) return;
    dragging = false;
    reel.classList.remove('is-dragging');
    snapToNearest();
  }

  reel.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);

  render();
})();


/* =========================================================
   TYPOGRAPHY — SELF-TURNING BOOK(S)  (4-leaf flipbook)
   Runs on every `.book[data-prefix]` on the page. Pages come from
   data-prefix + data-from..data-to (zero-padded, .jpg) -> spreads.
   Four leaves in two stacks of two: right = [RT (turns next), RU],
   left = [LT (current left page), LU]. A turn rotates RT 0->-180deg
   (Web Animations API, compositor) and LEAVES it there — nothing
   snaps back. RT lifting uncovers RU, which already holds the next
   right page (set a full cycle earlier), so the right page never
   blinks or changes shadow at the hand-off. During the pause the
   leaf now at the BOTTOM of the left stack — occluded both ends —
   is silently carried to the bottom of the right stack and
   re-imaged for two turns ahead. Cast shadow + sheen ride the
   turn's own timeline and end fully transparent before touchdown.
   ========================================================= */
(function () {
  const books = [...document.querySelectorAll('.book[data-prefix]')];
  if (!books.length) return;

  const FLIP_MS = 1650;
  const HOLD_MS = 850;
  const EASE = 'cubic-bezier(.42,.03,.35,1)';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const setSrc = (el, src) => { if (el && el.getAttribute('src') !== src) el.src = src; };
  const decode = el => (el && el.decode ? el.decode().catch(() => {}) : Promise.resolve());

  function initBook(book) {
    const bpLeft  = book.querySelector('.book-page-left img');
    const bpRight = book.querySelector('.book-page-right img');
    const cast    = book.querySelector('.book-cast');
    const leaves  = [...book.querySelectorAll('.leaf')];
    const stage   = book.closest('.book-stage');
    const numEl   = stage && stage.querySelector('.book-num');
    const totalEl = stage && stage.querySelector('.book-total');
    if (!bpLeft || !bpRight || !cast || leaves.length < 4) return;

    const prefix = book.dataset.prefix;
    const from = parseInt(book.dataset.from, 10);
    const to   = parseInt(book.dataset.to, 10);
    const PAGES = [];
    for (let i = from; i <= to; i++) PAGES.push(prefix + String(i).padStart(2, '0') + '.jpg');
    const SPREADS = [];
    for (let i = 0; i + 1 < PAGES.length; i += 2) SPREADS.push({ left: PAGES[i], right: PAGES[i + 1] });
    const N = SPREADS.length;
    if (N < 4) return;                       // need >= 4 spreads for the 4-leaf recycle
    if (totalEl) totalEl.textContent = String(N).padStart(2, '0');

    const img   = (leaf, side) => leaf.querySelector('.leaf-' + side + ' img');
    const sheen = leaf => leaf.querySelector('.leaf-sheen');
    const spL = i => SPREADS[((i % N) + N) % N].left;
    const spR = i => SPREADS[((i % N) + N) % N].right;

    let cur = 0, pw = 0;
    let R = { LT: 0, LU: 1, RT: 2, RU: 3 };
    let gen = 0;               // bumped on every activate/deactivate; a stale cycle sees the mismatch and exits
    let active = false;        // in view -> running
    let paused = false;        // tab hidden -> idle without resetting
    let stopped = false;       // page unloading
    let curAnims = [];         // WAAPI animations of the turn currently in flight
    const measure = () => { pw = book.querySelector('.book-page-left').getBoundingClientRect().width; };

    PAGES.forEach(src => { const im = new Image(); im.src = src; decode(im); });

    function applyZ() {
      leaves[R.LT].style.zIndex = 40;
      leaves[R.LU].style.zIndex = 30;
      leaves[R.RT].style.zIndex = 20;
      leaves[R.RU].style.zIndex = 10;
    }

    function init() {
      measure();
      cur = 0;
      R = { LT: 0, LU: 1, RT: 2, RU: 3 };
      setSrc(img(leaves[R.LT], 'back'),  spL(0));
      setSrc(img(leaves[R.LT], 'front'), spR(-1));
      setSrc(img(leaves[R.LU], 'back'),  spL(-1));
      setSrc(img(leaves[R.LU], 'front'), spR(-2));
      setSrc(img(leaves[R.RT], 'front'), spR(0));
      setSrc(img(leaves[R.RT], 'back'),  spL(1));
      setSrc(img(leaves[R.RU], 'front'), spR(1));
      setSrc(img(leaves[R.RU], 'back'),  spL(2));
      leaves[R.LT].style.transform = leaves[R.LU].style.transform = 'rotateY(-180deg)';
      leaves[R.RT].style.transform = leaves[R.RU].style.transform = 'rotateY(0deg)';
      cast.style.opacity = '0';
      cast.style.transform = 'translateX(' + pw + 'px)';
      applyZ();
      if (numEl) numEl.textContent = '01';
      setSrc(bpLeft, spL(0));
      setSrc(bpRight, spR(0));
    }

    const dead = token => stopped || token !== gen || !active;

    async function turn(token) {
      const dur = reduce ? 1 : FLIP_MS;
      const flipLeaf = leaves[R.RT];
      flipLeaf.style.zIndex = 50;

      const aLeaf = flipLeaf.animate(
        [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }],
        { duration: dur, easing: EASE, fill: 'forwards' }
      );
      const aSheen = sheen(flipLeaf).animate(
        [{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }],
        { duration: dur, easing: 'ease-in-out' }
      );
      const aCast = cast.animate(
        [
          { opacity: 0,    transform: 'translateX(' + pw + 'px)',         offset: 0 },
          { opacity: 0.32, transform: 'translateX(' + (pw * 0.5) + 'px)',  offset: 0.38 },
          { opacity: 0.12, transform: 'translateX(' + (pw * 0.24) + 'px)', offset: 0.6 },
          { opacity: 0,    transform: 'translateX(' + (pw * 0.06) + 'px)', offset: 0.76 },
          { opacity: 0,    transform: 'translateX(0px)',                   offset: 1 }
        ],
        { duration: dur, easing: 'linear' }
      );
      curAnims = [aLeaf, aSheen, aCast];

      try { await aLeaf.finished; } catch (e) { return; }
      if (dead(token)) return;

      cur = (cur + 1) % N;
      if (numEl) numEl.textContent = String(cur + 1).padStart(2, '0');
      flipLeaf.style.transform = 'rotateY(-180deg)';
      aLeaf.cancel(); aSheen.cancel(); aCast.cancel();
      curAnims = [];

      const recycled = leaves[R.LU];
      R = { LT: R.RT, LU: R.LT, RT: R.RU, RU: R.LU };
      applyZ();

      setSrc(img(recycled, 'front'), spR(cur + 1));
      setSrc(img(recycled, 'back'),  spL(cur + 2));
      await Promise.all([decode(img(recycled, 'front')), decode(img(recycled, 'back'))]);
      if (dead(token)) return;
      recycled.style.transform = 'rotateY(0deg)';

      setSrc(bpLeft,  spL(cur));
      setSrc(bpRight, spR(cur));
    }

    async function runCycle(token) {
      init();                               // always start a fresh visit from spread 01
      await wait(HOLD_MS + 450);
      while (!dead(token)) {
        if (paused) { await wait(200); continue; }
        await turn(token);
        if (dead(token)) break;
        await wait(HOLD_MS);
      }
    }

    function activate() {
      if (active || stopped) return;
      active = true;
      gen++;
      runCycle(gen);
    }
    function deactivate() {
      if (!active) return;
      active = false;
      gen++;                                // any in-flight cycle now reads dead()===true
      curAnims.forEach(a => { try { a.cancel(); } catch (e) {} });
      curAnims = [];
      init();                               // reset to the initial spread + leaf layout
    }

    document.addEventListener('visibilitychange', () => { paused = document.hidden; });
    window.addEventListener('pagehide', () => { stopped = true; });

    init();                                 // static first paint: spread 01, not turning
    return { book, activate, deactivate, measure };
  }

  const ctrls = books.map(initBook).filter(Boolean);
  if (!ctrls.length) return;

  // don't let the browser drop us mid-page on reload — the mockups are meant to
  // be met by scrolling down to them
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // Only ONE book runs at a time: the one whose middle is nearest the middle of
  // the viewport (and clearly on screen). Scroll to a book -> it starts from
  // spread 01; scroll away -> it stops and resets to spread 01.
  function pickActive() {
    const vh = window.innerHeight;
    let best = null, bestDist = Infinity;
    for (const c of ctrls) {
      const r = c.book.getBoundingClientRect();
      if (!r.height) continue;                                     // not laid out yet
      if (r.bottom <= vh * 0.2 || r.top >= vh * 0.8) continue;     // essentially off screen
      const d = Math.abs((r.top + r.bottom) / 2 - vh / 2);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    for (const c of ctrls) (c === best ? c.activate : c.deactivate)();
  }

  let scheduled = false;
  const onScroll = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; pickActive(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { ctrls.forEach(c => c.measure()); pickActive(); });
  window.addEventListener('load', () => { ctrls.forEach(c => c.measure()); pickActive(); });
  pickActive();
})();


/* =========================================================
   PHOTOGRAPHY — FLIP LIGHTBOX
   Click a photo: it grows from its grid slot to full screen
   (translate + uniform scale, inverted then played). Close with
   the corner X, the backdrop, or Esc: it shrinks back to the
   same slot it came from. Scroll is locked while open so the
   slot stays put for the zoom-out.
   ========================================================= */
(function () {
  const grid = document.querySelector('.photo-grid');
  const lb = document.getElementById('photoLb');
  if (!grid || !lb) return;
  const frame = lb.querySelector('.photo-lb-frame');
  const lbImg = frame && frame.querySelector('img');
  const closeBtn = document.getElementById('photoLbClose');
  if (!frame || !lbImg || !closeBtn) return;

  const DUR = 470;
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  let openFig = null;
  let busy = false;

  // Geometry for morphing the frame between its full-screen box and a grid slot.
  // The two never share an aspect ratio — the frame matches the picture (3:2),
  // the slot is a 4:3 (or 20:9 lead) cover-crop — so a single uniform scale can
  // not land on the slot: it used to finish ~11% short in height, and ~48% off
  // on the wide lead frame. That leftover gap is what you saw as a jolt the
  // instant the real thumbnail took over.
  //   frame -> scaled non-uniformly so it lands exactly ON the slot
  //   picture inside -> given the inverse scale
  // The two compose to exactly the uniform cover-scale the thumbnail itself
  // uses, so nothing is stretched at either end and the hand-off is seamless.
  function morph(fromRect, toRect) {
    const sx = toRect.width / fromRect.width;
    const sy = toRect.height / fromRect.height;
    const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2);
    const dy = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2);
    const cover = Math.max(sx, sy);
    return {
      frame: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})`,
      img: `scale(${(cover / sx).toFixed(5)}, ${(cover / sy).toFixed(5)})`
    };
  }

  let anims = [];
  function stopAnims() {
    anims.forEach(a => { try { a.cancel(); } catch (e) {} });
    anims = [];
  }
  function runMorph(fromTf, toTf) {
    stopAnims();
    frame.style.willChange = 'transform';
    lbImg.style.willChange = 'transform';
    const opts = { duration: DUR, easing: EASE, fill: 'forwards' };
    const a1 = frame.animate([{ transform: fromTf.frame }, { transform: toTf.frame }], opts);
    const a2 = lbImg.animate([{ transform: fromTf.img }, { transform: toTf.img }], opts);
    anims = [a1, a2];
    return a1;
  }
  const IDENTITY = { frame: 'none', img: 'none' };

  // fit the frame to the picture's largest box that fits inside the viewport
  // margins — so the enlarged image is never taller/wider than the screen
  function fitFrame() {
    const mx = Math.max(16, Math.min(window.innerWidth * 0.03, 72));
    const my = Math.max(16, Math.min(window.innerHeight * 0.05, 64));
    const availW = window.innerWidth - mx * 2;
    const availH = window.innerHeight - my * 2;
    const ar = (lbImg.naturalWidth && lbImg.naturalHeight)
      ? lbImg.naturalWidth / lbImg.naturalHeight : 3 / 2;
    let w = availW, h = availW / ar;
    if (h > availH) { h = availH; w = availH * ar; }
    frame.style.width = Math.round(w) + 'px';
    frame.style.height = Math.round(h) + 'px';
  }

  function open(fig) {
    if (busy || openFig) return;
    const thumb = fig.querySelector('img');
    if (!thumb) return;
    busy = true;
    openFig = fig;

    lbImg.src = thumb.currentSrc || thumb.src;
    stopAnims();
    frame.style.transition = 'none';
    frame.style.transform = 'none';
    lbImg.style.transform = 'none';
    lb.classList.add('is-on');
    lb.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('lb-lock');

    const play = () => {
      fitFrame();
      const full = frame.getBoundingClientRect();
      const slot = thumb.getBoundingClientRect();
      fig.classList.add('is-open');                  // empty the grid slot
      frame.style.transformOrigin = 'center center';
      lbImg.style.transformOrigin = 'center center';
      // start sitting exactly on the slot, play out to full screen
      runMorph(morph(full, slot), IDENTITY).finished
        .then(() => { frame.style.willChange = ''; lbImg.style.willChange = ''; busy = false; })
        .catch(() => { busy = false; });
    };

    if (lbImg.complete && lbImg.naturalWidth) requestAnimationFrame(play);
    else lbImg.addEventListener('load', () => requestAnimationFrame(play), { once: true });
  }

  function close() {
    if (busy || !openFig) return;
    busy = true;
    const fig = openFig;
    const thumb = fig.querySelector('img');
    const full = frame.getBoundingClientRect();
    const slot = thumb.getBoundingClientRect();

    // shrink from full screen down onto the slot, landing on it exactly
    const a = runMorph(IDENTITY, morph(full, slot));
    lb.classList.remove('is-on');                    // backdrop + X fade alongside

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // Hand off in this order so nothing is ever visibly out of place:
      // the frame is sitting pixel-exact on the slot, so putting the real
      // thumbnail back and then emptying the frame is a pure content swap —
      // no geometry moves. Only once it holds nothing do we reset it.
      fig.classList.remove('is-open');
      lbImg.removeAttribute('src');
      stopAnims();
      frame.style.willChange = '';
      lbImg.style.willChange = '';
      frame.style.transform = 'none';
      lbImg.style.transform = 'none';
      frame.style.width = '';
      frame.style.height = '';
      lb.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('lb-lock');
      openFig = null;
      busy = false;
    };
    a.finished.then(finish).catch(finish);
    setTimeout(finish, DUR + 120);                   // safety net
  }

  grid.addEventListener('click', e => {
    const fig = e.target.closest('figure');
    if (fig && grid.contains(fig)) open(fig);
  });
  closeBtn.addEventListener('click', close);
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openFig) close(); });
  window.addEventListener('resize', () => {
    if (openFig && !busy) {
      stopAnims();
      frame.style.transform = 'none';
      lbImg.style.transform = 'none';
      fitFrame();
    }
  });
})();
