/* ============================================================
   Recall Partners — dormant revenue calculator
   ------------------------------------------------------------
   Three states in one panel: form -> loading -> results.
   Nothing is persisted. The results exist only in the DOM of the
   current page view; "Start over" wipes them, and a refresh or a
   back-forward restore returns a blank form.

   No dependencies. If JS is off the form simply does nothing,
   which is the correct failure mode for a gated tool.
   ============================================================ */
(function () {
  'use strict';

  var FORMSPREE = 'https://formspree.io/f/xkjwkzor';

  /* Conservative reactivation band applied to DORMANT contacts only.
     Change these two numbers and every figure on the results panel,
     plus the copy that quotes the band, moves with them. The band is
     also written into the visible "How we got there" note so the page
     can never quote a rate it isn't actually using. */
  var RATE_LOW = 0.05;
  var RATE_HIGH = 0.10;

  /* Fake-progress script. Each message holds for HOLD_MS, so the whole
     sequence is messages.length * HOLD_MS. The Formspree POST fires in
     parallel and is never allowed to hold up the reveal. */
  var HOLD_MS = 780;
  var MESSAGES = [
    'Reading your database numbers…',
    'Calculating dormant revenue opportunity…',
    'Segmenting contacts by time since last visit…',
    'Modeling a 5-day reactivation window…',
    'Estimating recoverable appointments…',
    'Building your number…'
  ];

  var form = document.getElementById('calcForm');
  if (!form) return;

  var stateForm = document.getElementById('calcFormState');
  var stateLoad = document.getElementById('calcLoadState');
  var stateRes  = document.getElementById('calcResState');
  var loadMsg   = document.getElementById('calcLoadMsg');
  var loadBar   = document.getElementById('calcLoadBar');
  var submitBtn = document.getElementById('calcSubmit');
  var resetBtn  = document.getElementById('calcReset');
  var panel     = document.querySelector('.calcpanel');

  var timers = [];

  /* ---------- Formatting ---------- */

  function digitsOnly(s) { return String(s).replace(/[^\d]/g, ''); }

  function withCommas(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function money(n) {
    return '$' + withCommas(Math.round(n));
  }

  /* Round to a step so the range never reads as false precision --
     "$23,400 - $46,800" is honest, "$23,437 - $46,875" is not. */
  function roundTo(n, step) { return Math.round(n / step) * step; }

  function moneySoft(n) {
    var step = n >= 10000 ? 100 : (n >= 1000 ? 50 : 10);
    return money(roundTo(n, step));
  }

  /* ---------- Live input formatting ---------- */

  function bindThousands(el) {
    el.addEventListener('input', function () {
      var raw = digitsOnly(el.value);
      el.value = raw ? withCommas(raw) : '';
      clearError(el);
    });
  }

  function bindDecimal(el) {
    el.addEventListener('input', function () {
      // One decimal point, digits either side, thousands separators on
      // the whole part only.
      var v = el.value.replace(/[^\d.]/g, '');
      var parts = v.split('.');
      var whole = parts.shift();
      var frac = parts.join('').slice(0, 2);
      el.value = (whole ? withCommas(whole.replace(/^0+(?=\d)/, '')) : '')
               + (v.indexOf('.') > -1 ? '.' + frac : '');
      clearError(el);
    });
  }

  bindThousands(document.getElementById('patients'));
  bindThousands(document.getElementById('dormant'));
  bindDecimal(document.getElementById('ticket'));

  ['firstName', 'practice', 'email'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', function () { clearError(el); });
  });

  /* ---------- Validation ---------- */

  function fieldOf(el) { return el.closest('.field'); }

  function setError(el, msg) {
    var f = fieldOf(el);
    if (!f) return;
    f.classList.add('is-error');
    el.setAttribute('aria-invalid', 'true');
    if (msg) {
      var err = f.querySelector('.field__err');
      if (err) err.textContent = msg;
    }
  }

  function clearError(el) {
    var f = fieldOf(el);
    if (!f) return;
    f.classList.remove('is-error');
    el.removeAttribute('aria-invalid');
  }

  function num(el) {
    var v = parseFloat(String(el.value).replace(/,/g, ''));
    return isFinite(v) ? v : NaN;
  }

  function validate() {
    var patientsEl = document.getElementById('patients');
    var dormantEl  = document.getElementById('dormant');
    var ticketEl   = document.getElementById('ticket');
    var nameEl     = document.getElementById('firstName');
    var practiceEl = document.getElementById('practice');
    var emailEl    = document.getElementById('email');

    var first = null;
    function fail(el, msg) { setError(el, msg); if (!first) first = el; }

    var patients = num(patientsEl);
    var dormant  = num(dormantEl);
    var ticket   = num(ticketEl);

    if (!(patients >= 1)) fail(patientsEl, 'Enter your total contact count.');
    if (!(dormant >= 1)) {
      fail(dormantEl, 'Enter how many contacts have gone quiet.');
    } else if (patients >= 1 && dormant > patients) {
      fail(dormantEl, 'That’s more than your total contact count — check the number above.');
    }
    if (!(ticket > 0)) fail(ticketEl, 'Enter your average ticket.');
    if (!nameEl.value.trim()) fail(nameEl, 'Enter your first name.');
    if (!practiceEl.value.trim()) fail(practiceEl, 'Enter your practice name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailEl.value.trim())) {
      fail(emailEl, 'Enter a valid email address.');
    }

    if (first) {
      first.focus();
      if (first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return null;
    }

    return {
      patients: Math.round(patients),
      dormant: Math.round(dormant),
      ticket: ticket,
      firstName: nameEl.value.trim(),
      practice: practiceEl.value.trim(),
      email: emailEl.value.trim()
    };
  }

  /* ---------- The math ----------
     Deliberately simple, and every step of it is shown on the results
     panel. Dormant revenue is one visit from every dormant contact --
     not lifetime value, not a projection. The recovery band is the
     only assumption in the whole tool. */
  function compute(input) {
    var dormantRevenue = input.dormant * input.ticket;
    return {
      dormantRevenue: dormantRevenue,
      dormancyPct: (input.dormant / input.patients) * 100,
      recoveryLow: dormantRevenue * RATE_LOW,
      recoveryHigh: dormantRevenue * RATE_HIGH,
      apptsLow: Math.round(input.dormant * RATE_LOW),
      apptsHigh: Math.round(input.dormant * RATE_HIGH)
    };
  }

  /* ---------- State switching ---------- */

  function show(state) {
    [stateForm, stateLoad, stateRes].forEach(function (el) {
      if (el) el.hidden = (el !== state);
    });
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  /* ---------- Loading sequence ---------- */

  function runLoading(done) {
    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hold = reduced ? 260 : HOLD_MS;

    show(stateLoad);
    loadMsg.textContent = MESSAGES[0];
    if (loadBar) loadBar.style.width = (100 / MESSAGES.length) + '%';

    MESSAGES.slice(1).forEach(function (msg, i) {
      timers.push(setTimeout(function () {
        loadMsg.textContent = msg;
        // Restart the fade each time the text changes.
        loadMsg.style.animation = 'none';
        void loadMsg.offsetWidth;
        loadMsg.style.animation = '';
        if (loadBar) loadBar.style.width = ((i + 2) / MESSAGES.length * 100) + '%';
      }, hold * (i + 1)));
    });

    timers.push(setTimeout(done, hold * MESSAGES.length));
  }

  /* ---------- Count-up on the headline figure ---------- */

  function countUp(el, target) {
    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target <= 0) { el.textContent = money(target); return; }

    var duration = 1100;
    var start = null;

    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      // easeOutExpo -- fast off the line, settles on the real figure.
      var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = money(target * eased);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Results ---------- */

  function render(input, r) {
    document.getElementById('resBigLabel').innerHTML =
      'is sitting in the ' + withCommas(input.dormant) + ' contacts at ' +
      escapeHtml(input.practice) + ' who haven’t booked in a year.';

    document.getElementById('resMath').textContent =
      withCommas(input.dormant) + ' dormant × ' + money(input.ticket) + ' average ticket';

    document.getElementById('resDormancy').textContent =
      (r.dormancyPct >= 99.5 ? 100 : Math.round(r.dormancyPct)) + '%';
    document.getElementById('resDormancyNote').textContent =
      'of your ' + withCommas(input.patients) + ' contacts have gone quiet.';

    document.getElementById('resRecovery').textContent =
      moneySoft(r.recoveryLow) + '–' + moneySoft(r.recoveryHigh);

    document.getElementById('resAppts').textContent =
      withCommas(r.apptsLow) + '–' + withCommas(r.apptsHigh);

    document.getElementById('resAssumeMath').innerHTML =
      '<b>' + money(r.dormantRevenue) + '</b> is ' + withCommas(input.dormant) +
      ' dormant contacts × your ' + money(input.ticket) +
      ' average ticket — the value of one visit from each of them. The recovery range is ' +
      Math.round(RATE_LOW * 100) + '–' + Math.round(RATE_HIGH * 100) +
      '% of those contacts booking inside the 5-day window, which works out to ' +
      withCommas(r.apptsLow) + '–' + withCommas(r.apptsHigh) + ' appointments.';

    var cta = document.getElementById('resCta');
    if (cta) {
      cta.textContent = input.firstName
        ? 'Get Your Real Number, ' + input.firstName
        : 'Get the Real Number on a 15-Min Call';
    }

    show(stateRes);
    if (panel && panel.scrollIntoView) {
      panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    countUp(document.getElementById('resBig'), r.dormantRevenue);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Lead capture ----------
     Fired the moment the button is pressed, in parallel with the
     loading sequence. A network failure never blocks the results --
     the person asked for a number, they get the number. */
  function sendLead(input, r) {
    var payload = {
      firstName: input.firstName,
      practice: input.practice,
      email: input.email,
      totalContacts: input.patients,
      dormantContacts: input.dormant,
      averageTicket: money(input.ticket),
      dormancyRate: Math.round(r.dormancyPct) + '%',
      dormantRevenue: money(r.dormantRevenue),
      estimatedRecovery: moneySoft(r.recoveryLow) + ' - ' + moneySoft(r.recoveryHigh),
      estimatedAppointments: r.apptsLow + ' - ' + r.apptsHigh,
      source: 'Dormant Revenue Calculator',
      pageUrl: window.location.href,
      referrer: document.referrer || '(direct)',
      _subject: 'Calculator lead: ' + input.practice + ' — ' + money(r.dormantRevenue) + ' dormant'
    };

    if (!window.fetch) return;

    fetch(FORMSPREE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })['catch'](function () {
      // Swallowed on purpose. Surfacing a submission error on top of
      // the result the person came for helps nobody.
    });

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'calculator_submit', {
        dormant_contacts: input.dormant,
        dormant_revenue: Math.round(r.dormantRevenue)
      });
    }
  }

  /* ---------- Submit ---------- */

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Honeypot: a filled hidden field means a bot. Look successful,
    // send nothing.
    var hp = document.getElementById('_gotcha');
    if (hp && hp.value) { show(stateRes); return; }

    var input = validate();
    if (!input) return;

    var r = compute(input);

    submitBtn.disabled = true;
    sendLead(input, r);
    runLoading(function () { render(input, r); });
  });

  /* ---------- Start over ----------
     Wipes every rendered figure out of the DOM as well as resetting
     the form, so nothing from the previous run survives on the page. */
  function wipe() {
    clearTimers();

    document.getElementById('resBig').textContent = '$0';
    document.getElementById('resBigLabel').textContent =
      'is sitting in contacts who haven’t booked with you in a year.';
    document.getElementById('resMath').textContent = '';
    document.getElementById('resDormancy').textContent = '0%';
    document.getElementById('resDormancyNote').textContent = 'of your database is dormant.';
    document.getElementById('resRecovery').textContent = '$0';
    document.getElementById('resAppts').textContent = '0';
    document.getElementById('resAssumeMath').textContent = '';

    form.reset();
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('is-error'); });
    form.querySelectorAll('[aria-invalid]').forEach(function (el) {
      el.removeAttribute('aria-invalid');
    });

    submitBtn.disabled = false;
    if (loadBar) loadBar.style.width = '0';
    show(stateForm);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      wipe();
      var firstInput = document.getElementById('patients');
      if (panel && panel.scrollIntoView) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (firstInput) firstInput.focus({ preventScroll: true });
    });
  }

  /* A bfcache restore would otherwise bring the previous visitor's
     figures back on screen. Clear on the way out. */
  window.addEventListener('pagehide', wipe);
})();
