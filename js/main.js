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
      card.className = 'story-card';
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

        set(false);
        toggle.addEventListener('click', function () {
          set(toggle.getAttribute('aria-expanded') !== 'true');
        });
      });
    });
  }

  initAccordions();
  initMailtoForms();
  initCarousels();
  initMarquees();
  whenFontsReady(initMarquees);
  /* document.fonts.ready can resolve before the Google Fonts stylesheet has
     even been parsed, leaving the shift measured against the fallback face —
     which shows up as a jump at the loop point. 'load' is the backstop. */
  window.addEventListener('load', initMarquees);
  window.addEventListener('resize', debounce(initMarquees, 150));
}());
