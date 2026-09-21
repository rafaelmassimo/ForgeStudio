/* ==========================================================================
   FORGE Strength Studio — behaviour
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Infinite horizontal scroll.

     Figma animates the track from translate 0 to -831px over 12s linear,
     looping forever — 831px is the width of one repeated group of labels.
     Because our webfont metrics won't match Figma's to the pixel, we measure
     the real group width and derive the duration from the designed speed
     (831px / 12s) instead of hard-coding the offset. That keeps the loop
     seamless and the scroll rate faithful.
     ---------------------------------------------------------------------- */

  var DESIGN_SHIFT = 831;   /* px  */
  var DESIGN_DURATION = 12; /* s   */
  var SPEED = DESIGN_SHIFT / DESIGN_DURATION;

  function setUpMarquee(track) {
    var groups = track.querySelectorAll('.marquee__group');
    if (!groups.length) return;

    /* Clear any previous sizing so measurement starts from a known state. */
    track.style.removeProperty('--marquee-shift');
    track.style.removeProperty('--marquee-duration');

    var shift = groups[0].getBoundingClientRect().width;
    if (!shift) return;

    /* The strip must be at least one group wider than the visible area, or
       the loop point becomes visible as a gap.

       The cap matters: this only terminates while the track sizes to its
       content (width: max-content). If a stylesheet change ever pins the
       track's width, the measurement stops growing and an uncapped loop
       would append clones until the tab dies. */
    var needed = track.parentElement.getBoundingClientRect().width + shift;
    var limit = Math.ceil(needed / shift) + 2;
    var added = 0;
    while (track.getBoundingClientRect().width < needed && added < limit) {
      track.appendChild(groups[0].cloneNode(true));
      added++;
    }

    track.style.setProperty('--marquee-shift', shift + 'px');
    track.style.setProperty('--marquee-duration', (shift / SPEED).toFixed(3) + 's');
  }

  function initMarquees() {
    var tracks = document.querySelectorAll('[data-marquee-track]');
    Array.prototype.forEach.call(tracks, setUpMarquee);
  }

  /* Re-measure once webfonts land — Antonio changes the label widths. */
  function whenFontsReady(fn) {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fn).catch(fn);
    } else {
      window.addEventListener('load', fn);
    }
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  /* ------------------------------------------------------------------------
     Testimonial carousel (Who We Are, Figma 1272:9648).

     The track's cards come from the JSON file named in data-carousel-src:
     an array of { id, quote } objects. The page ships the first page of
     cards in its HTML, so it reads correctly if the fetch fails — in that
     case the arrows and dots simply stay inert.

     Figma shows three cards per page; one dot per page. The arrows wrap
     round from the last page to the first and back.
     ---------------------------------------------------------------------- */

  var CARDS_PER_PAGE = 3;

  function renderCards(track, testimonials) {
    var fragment = document.createDocumentFragment();
    testimonials.forEach(function (item) {
      var card = document.createElement('li');
      var quote = document.createElement('blockquote');
      card.className = 'story-card hover-lift';
      quote.textContent = '“' + item.quote + '”';
      card.appendChild(quote);
      fragment.appendChild(card);
    });
    track.replaceChildren(fragment);
  }

  function setUpCarousel(root, testimonials) {
    var track = root.querySelector('[data-carousel-track]');
    var dotsBox = root.querySelector('[data-carousel-dots]');
    var prev = root.querySelector('[data-carousel-prev]');
    var next = root.querySelector('[data-carousel-next]');
    if (!track || !testimonials.length) return;

    renderCards(track, testimonials);

    var cards = track.children;
    var pageCount = Math.ceil(cards.length / CARDS_PER_PAGE);
    var page = 0;
    var dots = [];

    dotsBox.replaceChildren();
    for (var i = 0; i < pageCount; i++) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel__dot';
      dot.setAttribute('aria-label', 'Show testimonials page ' + (i + 1) + ' of ' + pageCount);
      dot.addEventListener('click', goTo.bind(null, i));
      dotsBox.appendChild(dot);
      dots.push(dot);
    }

    function goTo(index) {
      page = (index + pageCount) % pageCount;
      var first = page * CARDS_PER_PAGE;

      /* Measured, not computed, so the shift always matches the card
         width + gap the stylesheet actually produced. */
      var shift = cards[first].offsetLeft - cards[0].offsetLeft;
      track.style.setProperty('--carousel-shift', shift + 'px');

      Array.prototype.forEach.call(cards, function (card, n) {
        var visible = n >= first && n < first + CARDS_PER_PAGE;
        card.inert = !visible;
        card.setAttribute('aria-hidden', String(!visible));
      });
      dots.forEach(function (d, n) {
        if (n === page) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    }

    prev.addEventListener('click', function () { goTo(page - 1); });
    next.addEventListener('click', function () { goTo(page + 1); });
    goTo(0);
  }

  function initCarousels() {
    var roots = document.querySelectorAll('[data-carousel]');
    Array.prototype.forEach.call(roots, function (root) {
      var src = root.getAttribute('data-carousel-src');
      if (!src || !window.fetch) return;
      fetch(src)
        .then(function (response) {
          if (!response.ok) throw new Error(response.status + ' ' + src);
          return response.json();
        })
        .then(function (testimonials) { setUpCarousel(root, testimonials); })
        .catch(function (error) {
          /* Keep the static first page from the HTML. */
          console.warn('Testimonials could not be loaded:', error);
        });
    });
  }

  /* ------------------------------------------------------------------------
     Contact form (Contact, Figma 1319:5236).

     The site has no backend, so the form hands off to the visitor's email
     app: on submit it builds a mailto: link addressed to the value of
     data-mailto-form, with the fields as subject and body. The browser's
     own validation (required, type="email") runs first — the submit event
     only fires once the fields are valid.
     ---------------------------------------------------------------------- */

  function initMailtoForms() {
    var forms = document.querySelectorAll('[data-mailto-form]');
    Array.prototype.forEach.call(forms, function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();

        var field = function (name) {
          var input = form.elements[name];
          return input ? input.value.trim() : '';
        };
        var name = [field('first-name'), field('last-name')].filter(Boolean).join(' ');
        var subject = 'Website enquiry from ' + name;
        var body = field('message') + '\n\n' + name + '\n' + field('email');

        window.location.href = 'mailto:' + form.getAttribute('data-mailto-form') +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(body);
      });
    });
  }

  /* ------------------------------------------------------------------------
     FAQ accordion (Figma component 382:3642, Default ⇄ Expanded on click).

     Each question opens and closes on its own, as in the Figma prototype.
     The script only flips state — aria-expanded on the button, .is-open on
     the item, inert on the hidden answer — and css/faq.css does the motion.
     ---------------------------------------------------------------------- */

  function initAccordions() {
    var roots = document.querySelectorAll('[data-accordion]');
    Array.prototype.forEach.call(roots, function (root) {
      var toggles = root.querySelectorAll('.faq-item__toggle');
      Array.prototype.forEach.call(toggles, function (toggle) {
        var item = toggle.closest('.faq-item');
        var answer = document.getElementById(toggle.getAttribute('aria-controls'));

        function set(open) {
          toggle.setAttribute('aria-expanded', String(open));
          item.classList.toggle('is-open', open);
          if (answer) answer.inert = !open;
        }

        /* Start from the markup: an item that ships aria-expanded="true"
           opens by default. */
        set(toggle.getAttribute('aria-expanded') === 'true');
        toggle.addEventListener('click', function () {
          set(toggle.getAttribute('aria-expanded') !== 'true');
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Modals: the Services & Plans pricing sheets (Figma overlays
     1174:17630–17702) and the footer's Privacy Policy and Terms &
     Conditions, on every page.

     A button with data-dialog-open="<id>" opens that <dialog> as a modal;
     anything with data-dialog-close inside it closes it. Esc and a click on
     the backdrop close it too — natively via closedby="any", and by hand
     where the browser doesn't support that yet (Safari). The fade/rise in
     and out lives in css/services-and-plans.css (.plan-modal) and
     css/styles.css (.legal-modal).
     ---------------------------------------------------------------------- */

  var supportsClosedBy = 'HTMLDialogElement' in window &&
    'closedBy' in HTMLDialogElement.prototype;

  function initDialogs() {
    var openers = document.querySelectorAll('[data-dialog-open]');
    Array.prototype.forEach.call(openers, function (opener) {
      var dialog = document.getElementById(opener.getAttribute('data-dialog-open'));
      if (!dialog || typeof dialog.showModal !== 'function') return;
      opener.addEventListener('click', function () { dialog.showModal(); });
    });

    var dialogs = document.querySelectorAll('dialog');
    Array.prototype.forEach.call(dialogs, function (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target.closest('[data-dialog-close]')) {
          dialog.close();
          return;
        }
        /* Only dialogs that opt in with closedby="any" close from the
           backdrop; the mobile menu, like its Figma overlay, does not. */
        if (supportsClosedBy || event.target !== dialog ||
          dialog.getAttribute('closedby') !== 'any') return;

        /* A click on the dialog itself is either its own padding or the
           backdrop outside it; only the latter closes. */
        var rect = dialog.getBoundingClientRect();
        var inside = rect.top <= event.clientY && event.clientY <= rect.bottom &&
          rect.left <= event.clientX && event.clientX <= rect.right;
        if (!inside) dialog.close();
      });
    });
  }

  /* ------------------------------------------------------------------------
     Mobile menu (Figma 1200:13840). Opening and closing go through
     initDialogs (the hamburger carries data-dialog-open). The menu only
     exists below the 767px breakpoint, so it closes if the window is
     widened past it while open.
     ---------------------------------------------------------------------- */

  function initMobileMenu() {
    var menu = document.getElementById('mobile-menu');
    if (!menu || !window.matchMedia) return;

    var desktop = window.matchMedia('(min-width: 768px)');
    desktop.addEventListener('change', function (event) {
      if (event.matches && menu.open) menu.close();
    });
  }

  /* ------------------------------------------------------------------------
     Back to top. The button fades in once the visitor is a little way down
     the page, and scrolls smoothly back up (instantly for reduced motion).
     ---------------------------------------------------------------------- */

  function initToTop() {
    var button = document.querySelector('[data-to-top]');
    if (!button) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var ticking = false;

    function update() {
      ticking = false;
      button.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.75);
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });

      /* The button fades out once the page is back at the top, taking
         keyboard focus with it, so hand focus to the first control in the
         bar that is showing (the links on desktop, the wordmark on mobile). */
      var controls = document.querySelectorAll('.navbar a, .navbar button');
      var first = Array.prototype.find.call(controls, function (el) {
        return el.getClientRects().length > 0;
      });
      if (first) first.focus({ preventScroll: true });
    });

    update();
  }

  /* ------------------------------------------------------------------------
     Scroll reveal. Elements marked data-reveal start hidden (css/styles.css,
     under html.js) and get .is-revealed the first time they come into view
     — once; nothing hides again on the way back up. Inside a
     [data-reveal-group] they take turns: each waits one step longer than
     the one before it (the attribute's value in ms, or 90), capped so a
     long list never leaves its tail waiting.

     An element counts as in view once its top clears the bottom 12% of the
     viewport, so it starts moving while there is still room to move into.
     Without IntersectionObserver, or for reduced motion, everything just
     shows — the stylesheet already holds those elements still.
     ---------------------------------------------------------------------- */

  var REVEAL_STEP = 90;       /* ms between siblings in a group  */
  var REVEAL_MAX_DELAY = 720; /* ms                              */

  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    function showAll() {
      Array.prototype.forEach.call(targets, function (el) {
        el.classList.add('is-revealed');
      });
    }

    var reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!('IntersectionObserver' in window) || reduceMotion) {
      showAll();
      return;
    }

    /* Groups in document order, so a group nested in another has the last
       word on its own members' delays. */
    var groups = document.querySelectorAll('[data-reveal-group]');
    Array.prototype.forEach.call(groups, function (group) {
      var step = parseInt(group.getAttribute('data-reveal-group'), 10) || REVEAL_STEP;
      var members = group.querySelectorAll('[data-reveal]');
      Array.prototype.forEach.call(members, function (el, i) {
        el.style.setProperty('--reveal-delay', Math.min(i * step, REVEAL_MAX_DELAY) + 'ms');
      });
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    Array.prototype.forEach.call(targets, function (el) { observer.observe(el); });
  }

  initDialogs();
  initMobileMenu();
  initAccordions();
  initMailtoForms();
  initCarousels();
  initToTop();
  initReveal();
  initMarquees();
  whenFontsReady(initMarquees);
  /* document.fonts.ready can resolve before the Google Fonts stylesheet has
     even been parsed, leaving the shift measured against the fallback face —
     which shows up as a jump at the loop point. 'load' is the backstop. */
  window.addEventListener('load', initMarquees);
  window.addEventListener('resize', debounce(initMarquees, 150));
}());
