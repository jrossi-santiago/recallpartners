/* ============================================================
   Recall Partners — client value calculator
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

  /* The conservative band, applied to the clients who have gone quiet
     -- never to the whole list. These two numbers are the only
     assumption in the tool. The visible copy is written from them, so
     the page can't end up quoting a rate it isn't using. */
  var RATE_LOW = 0.05;
  var RATE_HIGH = 0.10;

  /* Loading sequence. One subtitle at a time under a fixed
     "Results loading..." heading. Total wait is
     MESSAGES.length * HOLD_MS -- currently ~5 seconds. The Formspree
     POST runs in parallel and never holds up the reveal. */
  var HOLD_MS = 1700;
  var MESSAGES = [
    'Looking at your numbers…',
    'Sorting the clients who have gone quiet…',
    'Working out what they are worth…'
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

  function $(id) { return document.getElementById(id); }
  function setText(id, text) { var el = $(id); if (el) el.textContent = text; }

  /* ---------- Formatting ---------- */

  function digitsOnly(s) { return String(s).replace(/[^\d]/g, ''); }

  function withCommas(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function money(n) { return '$' + withCommas(Math.round(n)); }

  /* Round to a step so a range never reads as false precision --
     "$24,000 to $48,000" is honest, "$23,437 to $46,875" is not. */
  function roundTo(n, step) { return Math.round(n / step) * step; }

  function moneySoft(n) {
    var step = n >= 10000 ? 100 : (n >= 1000 ? 50 : 10);
    return money(roundTo(n, step));
  }

  function plural(n, one, many) { return n === 1 ? one : many; }

  /* ---------- Live input formatting ---------- */

  function bindThousands(el) {
    if (!el) return;
    el.addEventListener('input', function () {
      var raw = digitsOnly(el.value);
      el.value = raw ? withCommas(raw) : '';
      clearError(el);
    });
  }

  function bindDecimal(el) {
    if (!el) return;
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

  bindThousands($('patients'));
  bindThousands($('dormant'));
  bindDecimal($('ticket'));

  ['firstName', 'practice', 'email'].forEach(function (id) {
    var el = $(id);
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
    var patientsEl = $('patients');
    var dormantEl  = $('dormant');
    var ticketEl   = $('ticket');
    var nameEl     = $('firstName');
    var practiceEl = $('practice');
    var emailEl    = $('email');

    var first = null;
    function fail(el, msg) { setError(el, msg); if (!first) first = el; }

    var patients = num(patientsEl);
    var dormant  = num(dormantEl);
    var ticket   = num(ticketEl);

    if (!(patients >= 1)) fail(patientsEl, 'Enter how many people you have on file.');
    if (!(dormant >= 1)) {
      fail(dormantEl, 'Enter how many have stopped coming in.');
    } else if (patients >= 1 && dormant > patients) {
      fail(dormantEl, 'That’s more than you have on file — check the number above.');
    }
    if (!(ticket > 0)) fail(ticketEl, 'Enter what a typical visit is worth.');
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
     Deliberately simple, and every step is shown on the results panel
     as a worked sum. The headline figure is one visit from every
     client who has gone quiet -- not lifetime value, not a forecast.
     The recovery band is the only assumption. */
  function compute(input) {
    var total = input.dormant * input.ticket;
    return {
      total: total,
      quietPct: Math.round((input.dormant / input.patients) * 100),
      lowMoney: total * RATE_LOW,
      highMoney: total * RATE_HIGH,
      lowAppts: Math.round(input.dormant * RATE_LOW),
      highAppts: Math.round(input.dormant * RATE_HIGH)
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

  function reducedMotion() {
    return !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function runLoading(done) {
    var hold = reducedMotion() ? 300 : HOLD_MS;

    show(stateLoad);

    /* The form is tall and the loading panel is short, so swapping them
       collapses the page and leaves the viewport parked below the panel
       -- the visitor would spend the whole wait looking at the footer.
       Pull the panel back into view. */
    if (panel && panel.scrollIntoView) {
      panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    loadMsg.textContent = MESSAGES[0];
    if (loadBar) loadBar.style.width = (100 / MESSAGES.length) + '%';

    MESSAGES.slice(1).forEach(function (msg, i) {
      timers.push(setTimeout(function () {
        loadMsg.textContent = msg;
        // Replay the fade so each subtitle arrives rather than snapping.
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
    if (!el) return;
    if (reducedMotion() || target <= 0) { el.textContent = money(target); return; }

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
    setText('resBigLabel',
      'is sitting in the ' + withCommas(input.dormant) + ' clients at ' + input.practice +
      ' who haven’t been in for a year.');

    // The worked sum: count, ticket, total.
    setText('sumDormant', withCommas(input.dormant));
    setText('sumDormantDesc',
      'clients who haven’t been in for a year — that’s ' + r.quietPct +
      '% of the ' + withCommas(input.patients) + ' people on your list');
    setText('sumTicket', money(input.ticket));
    setText('sumTotal', money(r.total));

    // What's realistic, in natural frequencies rather than percentages.
    setText('scenLowMoney', moneySoft(r.lowMoney));
    setText('scenLowAppts',
      withCommas(r.lowAppts) + ' ' + plural(r.lowAppts, 'appointment', 'appointments') + ' back');
    setText('scenHighMoney', moneySoft(r.highMoney));
    setText('scenHighAppts',
      withCommas(r.highAppts) + ' ' + plural(r.highAppts, 'appointment', 'appointments') + ' back');

    setText('resPunch',
      'That’s ' + withCommas(r.lowAppts) + ' to ' + withCommas(r.highAppts) +
      ' appointments back on your calendar from people who already know your name. ' +
      'No ads, no new leads, and it takes five days.');

    var cta = $('resCta');
    if (cta) {
      cta.textContent = input.firstName
        ? 'Book a Free 15-Minute Call, ' + input.firstName
        : 'Book a Free 15-Minute Call';
    }

    show(stateRes);
    if (panel && panel.scrollIntoView) {
      panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    countUp($('resBig'), r.total);
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
      peopleOnFile: input.patients,
      quietClients: input.dormant,
      quietShare: r.quietPct + '%',
      averageVisit: money(input.ticket),
      totalIfAllReturned: money(r.total),
      realisticRange: moneySoft(r.lowMoney) + ' - ' + moneySoft(r.highMoney),
      appointmentRange: r.lowAppts + ' - ' + r.highAppts,
      source: 'Client Value Calculator',
      pageUrl: window.location.href,
      referrer: document.referrer || '(direct)',
      _subject: 'Calculator lead: ' + input.practice + ' — ' + money(r.total) + ' sitting idle'
    };

    if (window.fetch) {
      fetch(FORMSPREE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      })['catch'](function () {
        // Swallowed on purpose. Surfacing a submission error on top of
        // the result the person came for helps nobody.
      });
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'calculator_submit', {
        quiet_clients: input.dormant,
        idle_revenue: Math.round(r.total)
      });
    }
  }

  /* ---------- Submit ---------- */

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Honeypot: a filled hidden field means a bot. Look successful,
    // send nothing.
    var hp = $('_gotcha');
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

    setText('resBig', '$0');
    setText('resBigLabel', 'is sitting in the clients who stopped coming in.');
    setText('sumDormant', '0');
    setText('sumDormantDesc', 'clients who haven’t been in for a year');
    setText('sumTicket', '$0');
    setText('sumTotal', '$0');
    setText('scenLowMoney', '$0');
    setText('scenLowAppts', '0 appointments');
    setText('scenHighMoney', '$0');
    setText('scenHighAppts', '0 appointments');
    setText('resPunch', '');

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
      if (panel && panel.scrollIntoView) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
      var firstInput = $('patients');
      if (firstInput) firstInput.focus({ preventScroll: true });
    });
  }

  /* A bfcache restore would otherwise bring the previous visitor's
     figures back on screen. Clear on the way out. */
  window.addEventListener('pagehide', wipe);
})();
