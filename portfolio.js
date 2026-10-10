(() => {
  const content = document.getElementById('page-content');
  const home = document.getElementById('home');
  const pigeon = document.getElementById('pigeon');
  const links = [...document.querySelectorAll('.page-nav a')];
  const menu = document.getElementById('section-nav');
  const toggle = document.getElementById('mas-toggle');
  const sectionReturn = document.querySelector('.section-return');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let angle = 0;
  let transition = 0;
  let navigation = 0;
  let profileAnimation;
  let idleTimer;
  let awaitingMotionEnd = false;
  let idleVersion = 0;
  function chooseMenuMotion(value) {
    return value < .32 ? null : value < .49 ? 'Blink' : value < .66 ? 'Peck' : value < .83 ? 'HeadTilt' : 'LookAround';
  }
  async function playMotion(name, version, loop = false) {
    pigeon.animationCrossfadeDuration = name === 'Blink' ? 45 : name === 'Breathing' && pigeon.animationName === 'Blink' ? 35 : 350;
    pigeon.animationName = name;
    await pigeon.updateComplete;
    if (version !== idleVersion) return;
    // Seeking here resets the entire mixer clock, invalidating active crossfades.
    // The viewer starts new clips and resets completed clips itself.
    awaitingMotionEnd = !loop;
    pigeon.play({ repetitions: loop ? Infinity : 1 });
  }
  async function scheduleIdle(keepBreathing = false) {
    const version = ++idleVersion;
    clearTimeout(idleTimer);
    awaitingMotionEnd = false;
    if (!pigeon.loaded) return;
    const page = document.body.dataset.page;
    const active = ['home', 'menu'].includes(page) && !document.hidden && !reducedMotion.matches;
    const continuing = active && page === 'menu' && keepBreathing === true && pigeon.animationName === 'Breathing' && !pigeon.paused;
    if (!active || page !== 'menu') {
      pigeon.pause();
      pigeon.currentTime = 0;
    }
    if (!active) return;
    if (page === 'menu' && !continuing && pigeon.availableAnimations.includes('Breathing')) {
      await playMotion('Breathing', version, true);
      if (version !== idleVersion) return;
    }
    idleTimer = setTimeout(async () => {
      idleTimer = undefined;
      const motion = page === 'home' ? 'Blink' : chooseMenuMotion(Math.random());
      if (!motion || !pigeon.availableAnimations.includes(motion)) return scheduleIdle(true);
      await playMotion(motion, version);
    }, 3000 + Math.random() * 4000);
  }
  pigeon.addEventListener('finished', () => {
    if (!awaitingMotionEnd) return;
    awaitingMotionEnd = false;
    return scheduleIdle();
  });
  document.addEventListener('visibilitychange', scheduleIdle);
  reducedMotion.addEventListener('change', scheduleIdle);
  const modelReady = new Promise(resolve => {
    const timeout = setTimeout(() => resolve(false), 12000);
    pigeon.addEventListener('load', () => { clearTimeout(timeout); resolve(true); }, { once: true });
    pigeon.addEventListener('error', () => { clearTimeout(timeout); resolve(false); }, { once: true });
  });

  function setAngle(value) {
    pigeon.cameraOrbit = `${value}deg 80deg 157.5%`;
    pigeon.jumpCameraToGoal();
  }

  async function turnTo(target, immediate = false) {
    const version = ++transition;
    await modelReady;
    if (version !== transition || !pigeon.loaded) return;
    const from = angle;
    const duration = reducedMotion.matches || immediate || from === target ? 0 : 1100;
    return new Promise(resolve => {
      const start = performance.now();
      function frame(now) {
        if (version !== transition) return resolve();
        const progress = duration ? Math.min((now - start) / duration, 1) : 1;
        const eased = progress * progress * (3 - 2 * progress);
        angle = from + (target - from) * eased;
        setAngle(angle);
        if (progress < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }
  // A slow model can finish after the entrance wait has timed out.
  pigeon.addEventListener('load', () => {
    angle = document.body.dataset.page === 'menu' ? 50 : 0;
    setAngle(angle);
    scheduleIdle();
  });

  async function render() {
    const version = ++navigation;
    let page = location.hash.slice(1);
    if (['experience', 'education', 'activities', 'awards'].includes(page)) page = 'history';
    if (page !== 'menu' && !Object.hasOwn(window.PORTFOLIO_CONTENT, page)) page = 'home';
    const showProfile = page === 'home' || page === 'menu';
    const hadProfile = !home.hidden;
    const opacity = getComputedStyle(home).opacity;
    profileAnimation?.cancel();
    if (!home.hidden && !showProfile && Number(opacity) > 0 && !reducedMotion.matches) {
      profileAnimation = home.animate([{ opacity }, { opacity: 0 }], { duration: 300, fill: 'forwards', easing: 'ease' });
      await profileAnimation.finished.catch(() => {});
      if (version !== navigation) return;
    }
    profileAnimation?.cancel();
    document.body.dataset.page = page;
    scheduleIdle();
    document.querySelector('.pigeon-links').inert = page !== 'home';
    menu.inert = page !== 'menu';
    toggle.textContent = page === 'home' ? 'mas? →' : '← mas.';
    toggle.href = page === 'home' ? '#menu' : '#top';
    toggle.setAttribute('aria-expanded', String(page !== 'home'));
    home.hidden = !showProfile;
    sectionReturn.hidden = showProfile;
    if (!showProfile && menu.contains(document.activeElement)) sectionReturn.focus({ preventScroll: true });
    if (page === 'menu' && document.activeElement === sectionReturn) links[0].focus({ preventScroll: true });
    content.hidden = showProfile;
    content.innerHTML = showProfile ? '' : window.PORTFOLIO_CONTENT[page];
    if (page === 'home' && menu.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    links.forEach(link => {
      if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = `${page === 'home' ? 'Chaemin Shin' : page[0].toUpperCase() + page.slice(1) + ' — Chaemin Shin'} · Portfolio`;
    const turning = turnTo(page === 'menu' ? 50 : 0, !showProfile);
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (showProfile && hadProfile && Number(opacity) > 0) {
      home.style.opacity = '1';
    } else if (showProfile) {
      home.style.opacity = '0';
      // Wait for entrance transitions, not the bubbles' continuous floating loop.
      await new Promise(requestAnimationFrame);
      if (version !== navigation) return;
      const animations = [
        ...document.querySelector('.scene').getAnimations({ subtree: true }),
        ...document.querySelector('.pigeon-links').getAnimations({ subtree: true })
      ].filter(animation => animation.effect.getTiming().iterations !== Infinity);
      await Promise.allSettled([turning, ...animations.map(animation => animation.finished)]);
      if (version !== navigation) return;
      profileAnimation = home.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: reducedMotion.matches ? 0 : 450, fill: 'forwards', easing: 'ease'
      });
    }
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.body.dataset.page !== 'home') location.hash = document.body.dataset.page === 'menu' ? 'top' : 'menu';
  });
  render();
})();
