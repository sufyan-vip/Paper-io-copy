/* ============================================================
   Territory Trails 3D — vector icon system (no emojis)
   Inline SVG, currentColor-driven, crisp at any DPI.
   ============================================================ */
(function (global) {
  'use strict';
  const P = {
    coin: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm0 4a6 6 0 1 1-.01 12.01A6 6 0 0 1 12 6z"/><circle cx="12" cy="12" r="3.2"/>',
    skull: '<path d="M12 2C7 2 3 6 3 11c0 2.8 1.6 5.1 4 6.4V21a1 1 0 0 0 1 1h1.2v-2h1.6v2h2.4v-2h1.6v2H16a1 1 0 0 0 1-1v-3.6c2.4-1.3 4-3.6 4-6.4 0-5-4-9-9-9zM8.5 12.5A2 2 0 1 1 10.5 10.5a2 2 0 0 1-2 2zm7 0a2 2 0 1 1 2-2 2 2 0 0 1-2 2z"/>',
    gear: '<path d="M12 9.5A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zm9.4 4.1-2.1.5a7.6 7.6 0 0 1-.6 1.5l1.2 1.8a1 1 0 0 1-.13 1.27l-1.4 1.4a1 1 0 0 1-1.27.13l-1.8-1.2a7.6 7.6 0 0 1-1.5.6l-.5 2.1a1 1 0 0 1-1 .78h-2a1 1 0 0 1-1-.78l-.5-2.1a7.6 7.6 0 0 1-1.5-.6l-1.8 1.2a1 1 0 0 1-1.27-.13l-1.4-1.4a1 1 0 0 1-.13-1.27l1.2-1.8a7.6 7.6 0 0 1-.6-1.5l-2.1-.5a1 1 0 0 1-.78-1v-2a1 1 0 0 1 .78-1l2.1-.5a7.6 7.6 0 0 1 .6-1.5L2.7 6.9a1 1 0 0 1 .13-1.27l1.4-1.4a1 1 0 0 1 1.27-.13l1.8 1.2a7.6 7.6 0 0 1 1.5-.6l.5-2.1a1 1 0 0 1 1-.78h2a1 1 0 0 1 1 .78l.5 2.1a7.6 7.6 0 0 1 1.5.6l1.8-1.2a1 1 0 0 1 1.27.13l1.4 1.4a1 1 0 0 1 .13 1.27l-1.2 1.8a7.6 7.6 0 0 1 .6 1.5l2.1.5a1 1 0 0 1 .78 1v2a1 1 0 0 1-.78 1z"/>',
    gift: '<path d="M20 7h-2.2A3 3 0 0 0 13 3.6l-1 1-1-1A3 3 0 0 0 6.2 7H4a1 1 0 0 0-1 1v3h8v10h2V11h8V8a1 1 0 0 0-1-1zM9 5.5A1.5 1.5 0 0 1 10.5 7H9zm6 1.5h-1.5A1.5 1.5 0 1 1 15 5.5z"/>',
    target: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 3a7 7 0 1 1-7 7 7 7 0 0 1 7-7zm0 3a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm0 3a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/>',
    lock: '<path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3z"/>',
    pause: '<path d="M7 5h4v14H7zm6 0h4v14h-4z"/>',
    play: '<path d="M7 4l14 8-14 8z"/>',
    star: '<path d="M12 1.8l3 6.7 7.2.8-5.4 4.9 1.5 7.1-6.3-3.7-6.3 3.7 1.5-7.1L1.8 9.3 9 8.5z"/>',
    starO: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3.4l2.5 5.6 6 .7-4.5 4.1 1.3 6-5.3-3.1-5.3 3.1 1.3-6-4.5-4.1 6-.7z"/>',
    bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/>',
    magnet: '<path d="M5 3h5v8a2 2 0 0 0 4 0V3h5v8a7 7 0 0 1-14 0z"/><path fill="rgba(255,255,255,.75)" d="M5 3h5v3.5H5zM14 3h5v3.5h-5z"/>',
    cube: '<rect x="4" y="4" width="16" height="16" rx="3.5"/>',
    boat: '<path d="M3 14h18l-3.2 5H6.2z"/><path d="M13 3l6 9h-6z"/><path d="M11 5.5V12H5.5z"/>',
    penguin: '<path d="M12 2.5a6.5 6.5 0 0 1 6.5 6.5v6a6.5 6.5 0 0 1-13 0V9A6.5 6.5 0 0 1 12 2.5z"/><ellipse cx="12" cy="13.5" rx="3.2" ry="4.2" fill="rgba(255,255,255,.85)"/>',
    robot: '<rect x="5" y="9" width="14" height="10" rx="2.5"/><rect x="8" y="4" width="8" height="3.6" rx="1.2"/><circle cx="12" cy="2.6" r="1.4"/>',
    ghost: '<path d="M12 2.5a7 7 0 0 1 7 7V21l-2.4-2-2.3 2-2.3-2-2.3 2-2.3-2L5 21V9.5a7 7 0 0 1 7-7z"/>',
    crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    back: '<path d="M14 5l-7 7 7 7 2-2-5-5 5-5z"/>',
    trophy: '<path d="M6 3h12v2h3v3a5 5 0 0 1-4.6 5A6 6 0 0 1 13 16.9V19h3v2H8v-2h3v-2.1A6 6 0 0 1 7.6 13 5 5 0 0 1 3 8V5h3zm-1 4v1a3 3 0 0 0 2 2.8V7zm14 0h-2v3.8A3 3 0 0 0 19 8z"/>',
  };
  function ic(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  global.ICON = { ic, PATHS: P };
})(typeof window !== 'undefined' ? window : globalThis);
