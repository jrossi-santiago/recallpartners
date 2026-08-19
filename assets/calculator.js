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

  /* How many of the clients who have gone quiet come back. Applied to
     the quiet ones only, never to the whole list. These are the only
     assumptions in the tool, and every visible figure and every rate
     quoted in the copy is written from them -- so the page can't end
     up quoting a rate it isn't actually using.

     RATE_TARGET drives the headline. It is deliberately NOT the
     ceiling: leading with "if all 1,200 came back" gets the whole page
     discounted by anyone numerate, so the ceiling is shown further
     down and labelled as unreachable instead.

     NOTE: the homepage hero aims at 30 appointments on a 2,000-contact
     database. If you change RATE_TARGET, sanity-check it against that
     figure so the two pages don't contradict each other. */
  var RATE_WORST  = 0.05;
  var RATE_TARGET = 0.15;
  var RATE_MAX    = 1.00;

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
  /* Only ever called with strings this file builds itself -- the
     visitor's own text goes through setText, never here. */
  function setHtml(id, html) { var el = $(id); if (el) el.innerHTML = html; }

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
     as a worked sum. The ceiling is one visit from every client who
     has gone quiet -- not lifetime value, not a forecast. Each tier is
     that ceiling scaled by its rate, so the three figures can never
     drift out of proportion with one another. */
  function compute(input) {
    var ceiling = input.dormant * input.ticket;

    function tier(rate) {
      var appts = Math.round(input.dormant * rate);
      return { rate: rate, appts: appts, money: ceiling * rate };
    }

    return {
      ceiling: ceiling,
      quietPct: Math.round((input.dormant / input.patients) * 100),
      worst: tier(RATE_WORST),
      target: tier(RATE_TARGET),
      max: tier(RATE_MAX)
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
    var pct = function (rate) { return Math.round(rate * 100); };
    var appts = function (n) { return withCommas(n) + ' ' + plural(n, 'appointment', 'appointments'); };

    /* Headline: the realistic figure, not the ceiling. */
    setText('resBigLabel',
      'from ' + withCommas(r.target.appts) + ' of the ' + withCommas(input.dormant) +
      ' clients at ' + input.practice + ' who haven’t been in for a year.');

    /* Step 1 -- how many have gone quiet. */
    setText('stepEq1', withCommas(input.dormant) + ' clients have gone quiet');
    setText('stepDesc1',
      'They haven’t been in for a year — that’s ' + r.quietPct + '% of the ' +
      withCommas(input.patients) + ' people on your list.');

    /* Step 2 -- the ceiling, named as unreachable. */
    setHtml('stepEq2',
      withCommas(input.dormant) + ' &times; ' + money(input.ticket) +
      ' = <b>' + money(r.ceiling) + '</b>');

    /* Step 3 -- the rate we actually aim for. */
    setHtml('stepEq3',
      withCommas(input.dormant) + ' &times; ' + pct(RATE_TARGET) + ' in 100 = <b>' +
      withCommas(r.target.appts) + ' clients</b>');
    setText('stepDesc3',
      'We aim for ' + pct(RATE_TARGET) + ' out of every 100 to book. These are people who ' +
      'already gave you their number and already know your name, which is why the rate looks ' +
      'nothing like cold outreach.');

    /* Step 4 -- the headline figure. */
    setHtml('stepEq4',
      withCommas(r.target.appts) + ' &times; ' + money(input.ticket) +
      ' = <b>' + moneySoft(r.target.money) + '</b>');

    /* Floor / target / ceiling. */
    setText('scenLowMoney', moneySoft(r.worst.money));
    setText('scenLowAppts', appts(r.worst.appts));
    setText('scenMidMoney', moneySoft(r.target.money));
    setText('scenMidAppts', appts(r.target.appts));
    setText('scenMaxMoney', money(r.max.money));
    setText('scenMaxAppts', appts(r.max.appts));

    /* The bridge into working with us, in this practice's own terms. */
    setText('nextTitle',
      'So how do you actually get that ' + moneySoft(r.target.money) + '?');
    setText('nextStep3',
      'We’re aiming to put ' + appts(r.target.appts) + ' back on your books, then we hand ' +
      'you the reporting and get out. No retainer, nothing to cancel.');

    var ctaTop = $('resCtaTop');
    if (ctaTop && input.firstName) {
      ctaTop.textContent = 'Book a Call and Let’s Go Get It, ' + input.firstName;
    }
    var cta = $('resCta');
    if (cta) {
      cta.textContent = input.firstName
        ? 'Book Your Free 15-Minute Call, ' + input.firstName
        : 'Book a Free 15-Minute Call';
    }
    /* No possessive on the practice name here -- "Glow Aesthetics's list"
       is the kind of thing a reader notices and nothing else. */
    setText('resCtaNote',
      'Free, and there’s no pitch if the numbers aren’t there. We’ll tell you straight ' +
      'whether the list at ' + input.practice + ' is worth running a campaign against.');

    show(stateRes);
    if (panel && panel.scrollIntoView) {
      panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    countUp($('resBig'), r.target.money);
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
      targetRevenue: moneySoft(r.target.money),
      targetAppointments: r.target.appts,
      worstCaseRevenue: moneySoft(r.worst.money),
      ceilingRevenue: money(r.ceiling),
      source: 'Client Value Calculator',
      pageUrl: window.location.href,
      referrer: document.referrer || '(direct)',
      _subject: 'Calculator lead: ' + input.practice + ' — ' + moneySoft(r.target.money) + ' target'
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
        target_revenue: Math.round(r.target.money)
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
    setText('resBigLabel', 'from the clients who stopped coming in.');
    setText('stepEq1', '0 clients have gone quiet');
    setText('stepDesc1', 'They haven’t been in for a year.');
    setHtml('stepEq2', '0 &times; $0 = <b>$0</b>');
    setHtml('stepEq3', '0 &times; 15 in 100 = <b>0 clients</b>');
    setHtml('stepEq4', '0 &times; $0 = <b>$0</b>');
    ['scenLowMoney', 'scenMidMoney', 'scenMaxMoney'].forEach(function (id) { setText(id, '$0'); });
    ['scenLowAppts', 'scenMidAppts', 'scenMaxAppts'].forEach(function (id) { setText(id, '0 appointments'); });
    setText('nextTitle', 'So how do you actually get it?');
    setText('nextStep3', 'Then we hand you the reporting and get out. No retainer, nothing to cancel.');

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
