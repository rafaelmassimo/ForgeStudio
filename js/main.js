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

     Cards per page come from the stylesheet (--carousel-per-page: three on
     desktop, one on mobile); one dot per page, seven at most on screen.
     The arrows wrap round from the last page to the first and back.
     ---------------------------------------------------------------------- */

  var MAX_DOTS = 7;

  function cardsPerPage(root) {
    var n = parseInt(getComputedStyle(root).getPropertyValue('--carousel-per-page'), 10);
    return n > 0 ? n : 3;
  }

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
    var perPage = 0;
    var pageCount = 0;
    var page = 0;
    var dots = [];

    function buildDots() {
      dots = [];
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
    }

    /* Re-paginates when the breakpoint changes the page size, keeping the
       first card that was showing in view. */
    function paginate() {
      var next = cardsPerPage(root);
      if (next === perPage) return;
      var firstShown = page * perPage;
      perPage = next;
      pageCount = Math.ceil(cards.length / perPage);
      buildDots();
      goTo(Math.floor(firstShown / perPage));
    }

    function goTo(index) {
      page = (index + pageCount) % pageCount;
      var first = page * perPage;

      /* Measured, not computed, so the shift always matches the card
         width + gap the stylesheet actually produced. */
      var shift = cards[first].offsetLeft - cards[0].offsetLeft;
      track.style.setProperty('--carousel-shift', shift + 'px');

      Array.prototype.forEach.call(cards, function (card, n) {
        var visible = n >= first && n < first + perPage;
        card.inert = !visible;
        card.setAttribute('aria-hidden', String(!visible));
      });
      /* At most MAX_DOTS show; the window slides to keep the current dot
         in the middle where it can. */
      var start = Math.min(Math.max(page - Math.floor(MAX_DOTS / 2), 0), Math.max(pageCount - MAX_DOTS, 0));
      dots.forEach(function (d, n) {
        if (n === page) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
        d.hidden = n < start || n >= start + MAX_DOTS;
      });
    }

    prev.addEventListener('click', function () { goTo(page - 1); });
    next.addEventListener('click', function () { goTo(page + 1); });

    /* Swipe: a mostly horizontal drag of 40px or more turns the page. */
    var viewport = track.parentElement;
    var startX = null;
    var startY = 0;
    viewport.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    viewport.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      startX = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      goTo(dx < 0 ? page + 1 : page - 1);
    });

    paginate();
    window.addEventListener('resize', debounce(paginate, 150));
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

        set(false);
        toggle.addEventListener('click', function () {
          set(toggle.getAttribute('aria-expanded') !== 'true');
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Modals (Services & Plans, Figma overlays 1174:17630–17702).

     A button with data-dialog-open="<id>" opens that <dialog> as a modal;
     anything with data-dialog-close inside it closes it. Esc and a click on
     the backdrop close it too — natively via closedby="any", and by hand
     where the browser doesn't support that yet (Safari). The slide in/out
     lives in css/services-and-plans.css.
     ---------------------------------------------------------------------- */

  var supportsClosedBy = 'HTMLDialogElement' in window &&
    'closedBy' in HTMLDialogElement.prototype;

  function initDialogs() {
    var openers = document.querySelectorAll('[data-dialog-open]');
    Array.prototype.forEach.call(openers, function (opener) {
      var dialog = document.getElementById(opener.getAttribute('data-dialog-open'));
      if (!dialog || typeof dialog.showModal !== 'function') return;
      opener.addEventListener('click', function () {
        /* Paged plan modals always open on page 1 (the story), never
           wherever they were left after a previous visit. */
        dialog.classList.remove('is-page-2');
        dialog.showModal();
      });
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
     Modal paging (Services & Plans, mobile Figma "…Modal - Mobile -
     Page1/Page2 - …"). Below 767px each plan-modal splits into two pages
     — the story (.plan-modal__copy) and the pricing (.plan-modal__pricing)
     — shown one at a time via .is-page-2 on the dialog; css/responsive.css
     does the actual show/hide. Above 767px these links are hidden by the
     .mobile-only utility and never fire.
     ---------------------------------------------------------------------- */

  function initModalPaging() {
    var modals = document.querySelectorAll('.plan-modal--paged');
    Array.prototype.forEach.call(modals, function (modal) {
      var next = modal.querySelectorAll('[data-modal-next]');
      var prev = modal.querySelectorAll('[data-modal-prev]');
      Array.prototype.forEach.call(next, function (button) {
        button.addEventListener('click', function () {
          modal.classList.add('is-page-2');
          modal.scrollTop = 0;
        });
      });
      Array.prototype.forEach.call(prev, function (button) {
        button.addEventListener('click', function () {
          modal.classList.remove('is-page-2');
          modal.scrollTop = 0;
        });
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

  initDialogs();
  initModalPaging();
  initMobileMenu();
  initAccordions();
  initMailtoForms();
  initCarousels();
  initToTop();
  initMarquees();
  whenFontsReady(initMarquees);
  /* document.fonts.ready can resolve before the Google Fonts stylesheet has
     even been parsed, leaving the shift measured against the fallback face —
     which shows up as a jump at the loop point. 'load' is the backstop. */
  window.addEventListener('load', initMarquees);
  window.addEventListener('resize', debounce(initMarquees, 150));
}());
