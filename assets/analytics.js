/* ============================================================
   Google Analytics 4 — global site tag (gtag.js)
   ------------------------------------------------------------
   Loaded from the <head> of every page so the measurement ID
   and config live in one place. To add analytics to a new page,
   drop this into its <head>:

     <link rel="preconnect" href="https://www.googletagmanager.com">
     <script src="assets/analytics.js"></script>

   To change property, edit MEASUREMENT_ID below — nothing else.
   ============================================================ */
(function () {
  var MEASUREMENT_ID = 'G-TS7ZG55P8E';

  // Load the gtag.js library asynchronously so it never blocks render.
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
  document.head.appendChild(s);

  // Standard gtag bootstrap. Queues commands until the library loads.
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };

  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID);
})();
