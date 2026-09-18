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

  initMarquees();
  whenFontsReady(initMarquees);
  /* document.fonts.ready can resolve before the Google Fonts stylesheet has
     even been parsed, leaving the shift measured against the fallback face —
     which shows up as a jump at the loop point. 'load' is the backstop. */
  window.addEventListener('load', initMarquees);
  window.addEventListener('resize', debounce(initMarquees, 150));
}());
