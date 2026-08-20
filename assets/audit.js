/* ============================================================
   Recall Partners — quiet client audit intake
   ------------------------------------------------------------
   Three states in one panel: form -> sending -> confirmation, and
   the form state is itself four short steps.

   The twelve questions all earn their place -- the page cannot be
   written without them -- so the fix for the length was to show
   three or four at a time rather than to drop any. Validation is
   per-step: you cannot leave a step with an error on it, which
   means the final submit almost never fails validation.

   This is the opposite of the calculator. Nothing is computed and
   nothing is shown: the answers go to a person who builds the
   one-pager by hand and emails it back. The confirmation state
   only ever reads her own answers back to her, so this file must
   never render a figure it worked out itself.

   Because the deliverable arrives by email, a failed POST is
   surfaced rather than swallowed -- a lost submission means she
   waits for something that is never coming.

   No dependencies, no build step. If JS is off the form does
   nothing, which is the correct failure mode for a gated tool.
   ============================================================ */
(function () {
  'use strict';

  var FORMSPREE = 'https://formspree.io/f/xkjwkzor';

  /* The stated turnaround. It appears in the hero, on the submit
     button and in the confirmation copy in the HTML; this constant
     covers the confirmation lines that JS writes. Change it here AND
     in audit/index.html together -- a page that promises two days in
     one place and three in another is worse than either. */
  var TURNAROUND = 'two business days';

  /* Sending sequence. One subtitle at a time under a fixed
     "Sending your answers..." heading. Total is
     MESSAGES.length * HOLD_MS -- currently ~4 seconds. The POST runs
     in parallel; if it is still in flight when the sequence ends the
     panel holds on LATE_MSG until it settles, because here the send
     is the whole point and we can't pretend it finished. */
  var HOLD_MS = 1400;
  var MESSAGES = [
    'Packing up your answers…',
    'Sending them to a real person…',
    'Putting you in this week’s five…'
  ];
  var LATE_MSG = 'Still sending…';

  /* Formspree occasionally takes a while. Past this we call it a
     failure and tell her, rather than spinning forever. */
  var TIMEOUT_MS = 20000;

  /* Button labels. The turnaround is on the button in every state,
     including the retry -- it is the promise the page is making, and a
     retry button that drops it reads like a different offer. */
  var LABEL_SEND  = 'Send My Answers — One Page Back In 2 Days';
  var LABEL_RETRY = 'Try Again — One Page Back In 2 Days';

  var form = document.getElementById('auditForm');
  if (!form) return;

  var stateForm = document.getElementById('auditFormState');
  var stateLoad = document.getElementById('auditLoadState');
  var stateDone = document.getElementById('auditDoneState');
  var loadMsg   = document.getElementById('auditLoadMsg');
  var loadBar   = document.getElementById('auditLoadBar');
  var submitBtn = document.getElementById('auditSubmit');
  var errorBox  = document.getElementById('auditError');
  var redoBtn   = document.getElementById('auditRedo');
  var echoList  = document.getElementById('echoList');
  var panel     = document.querySelector('.toolpanel');

  var timers = [];

  function $(id) { return document.getElementById(id); }
  function setText(id, text) { var el = $(id); if (el) el.textContent = text; }

  /* ---------- The four steps ----------
     `fields` is both the running order for validation and the list
     of ids a step owns, so a field only ever has to be named once.
     A field with no entry in CHECKS is optional. */
  var STEPS = [
    { label: 'Your practice',               blurb: '3 questions on this screen',
      fields: ['practice', 'ptype', 'treats'] },
    { label: 'Your list',                   blurb: '4 questions on this screen',
      fields: ['onfile', 'quiet', 'visit', 'software'] },
    { label: 'Last time you contacted them', blurb: '2 questions, one you can skip',
      fields: ['lastsent', 'lastresult'] },
    { label: 'Where to send it',            blurb: 'Last screen',
      fields: ['firstName', 'email', 'phone'] }
  ];
  var LAST_STEP = STEPS.length;

  var steps    = form ? [].slice.call(form.querySelectorAll('.toolstep')) : [];
  var stepNow  = $('stepNow');
  var stepLeft = $('stepLeft');
  var stepFill = $('stepFill');
  var stepTrack = $('stepTrack');
  var current  = 1;

  /* ---------- Formatting ---------- */

  function digitsOnly(s) { return String(s).replace(/[^\d]/g, ''); }

  function withCommas(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function money(n) { return '$' + withCommas(Math.round(n)); }

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

  bindThousands($('onfile'));
  bindThousands($('quiet'));
  bindDecimal($('visit'));

  ['practice', 'treats', 'firstName', 'email', 'phone'].forEach(function (id) {
    var el = $(id);
    if (el) el.addEventListener('input', function () { clearError(el); });
  });

  /* A select shows its disabled placeholder until something is picked,
     so it is greyed like a placeholder until then. */
  ['ptype', 'software', 'lastsent'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.classList.add('is-empty');
    el.addEventListener('change', function () {
      el.classList.toggle('is-empty', !el.value);
      clearError(el);
    });
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

  function val(id) { var el = $(id); return el ? el.value.trim() : ''; }

  /* One check per field, keyed by id. Returning a string fails the
     field with that message; returning null passes it. Anything not
     in here (lastresult, phone when empty) is optional. */
  var CHECKS = {
    practice: function (el) {
      return el.value.trim() ? null : 'Enter your practice name.';
    },
    ptype: function (el) {
      return el.value ? null : 'Pick the closest one.';
    },
    treats: function (el) {
      return el.value.trim() ? null : 'Tell us what most of your bookings are for.';
    },
    onfile: function (el) {
      return num(el) >= 1 ? null : 'Enter how many people you have on file.';
    },
    quiet: function (el) {
      var q = num(el);
      var o = num($('onfile'));
      if (!(q >= 1)) return 'Enter how many have stopped coming in.';
      /* Only meaningful once the count above it is a real number --
         and it always is, because it lives on the same step. */
      if (o >= 1 && q > o) return 'That\u2019s more than you have on file \u2014 check the number above.';
      return null;
    },
    visit: function (el) {
      return num(el) > 0 ? null : 'Enter what a typical visit is worth.';
    },
    software: function (el) {
      return el.value ? null : 'Pick where your list lives.';
    },
    lastsent: function (el) {
      return el.value ? null : 'Pick the closest one.';
    },
    firstName: function (el) {
      return el.value.trim() ? null : 'Enter your first name.';
    },
    email: function (el) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim())
        ? null : 'Enter a valid email address.';
    },
    phone: function (el) {
      /* Optional -- only a filled-in one can be wrong. */
      if (!el.value.trim()) return null;
      return digitsOnly(el.value).length >= 10
        ? null : 'That doesn\u2019t look like a phone number \u2014 fix it or leave it empty.';
    }
  };

  /* Marks every bad field on one step and focuses the first of them.
     Returns true when the step is clean. */
  function validateStep(n) {
    var first = null;
    STEPS[n - 1].fields.forEach(function (id) {
      var el = $(id);
      var check = CHECKS[id];
      if (!el || !check) return;
      var msg = check(el);
      if (msg) {
        setError(el, msg);
        if (!first) first = el;
      } else {
        clearError(el);
      }
    });

    if (!first) return true;
    first.focus();
    if (first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }

  /* Belt and braces before the send. Steps are gated on the way
     forward, so this only bites if a field was emptied after being
     passed -- in which case it walks her back to that step. */
  function validateAll() {
    for (var n = 1; n <= LAST_STEP; n++) {
      if (!validateStep(n)) {
        if (n !== current) { goStep(n); validateStep(n); }
        return null;
      }
    }
    return collect();
  }

  function collect() {
    return {
      practice: val('practice'),
      ptype: val('ptype'),
      treats: val('treats'),
      onfile: Math.round(num($('onfile'))),
      quiet: Math.round(num($('quiet'))),
      visit: num($('visit')),
      software: val('software'),
      lastsent: val('lastsent'),
      lastresult: val('lastresult'),
      firstName: val('firstName'),
      email: val('email'),
      phone: val('phone')
    };
  }

  /* ---------- Step navigation ---------- */

  function goStep(n, move) {
    current = Math.min(Math.max(n, 1), LAST_STEP);

    steps.forEach(function (el, i) {
      el.hidden = (i + 1) !== current;
    });

    var step = STEPS[current - 1];
    if (stepNow) {
      stepNow.textContent = 'Step ' + current + ' of ' + LAST_STEP + ' \u00b7 ' + step.label;
    }
    if (stepLeft) stepLeft.textContent = step.blurb;
    if (stepFill) stepFill.style.width = (current / LAST_STEP * 100) + '%';
    if (stepTrack) stepTrack.setAttribute('aria-valuenow', String(current));

    /* Focus the step, not its first input: focusing an input pops the
       keyboard open on a phone and hides the question it belongs to.
       The panel is pulled back into view because each step is a
       different height and the viewport otherwise lands mid-form. */
    var el = steps[current - 1];
    if (el) el.setAttribute('tabindex', '-1');

    /* `move` is false only for the call that draws the first step on
       load -- taking focus and scrolling to the form the moment the
       page opens would skip the headline the visitor came for. */
    if (move === false) return;
    if (el) el.focus({ preventScroll: true });
    toPanel();
  }

  if (form) {
    form.addEventListener('click', function (e) {
      var next = e.target.closest('[data-next]');
      if (next) {
        if (validateStep(current)) goStep(current + 1);
        return;
      }
      if (e.target.closest('[data-back]')) goStep(current - 1);
    });
  }

  /* ---------- State switching ---------- */

  function show(state) {
    [stateForm, stateLoad, stateDone].forEach(function (el) {
      if (el) el.hidden = (el !== state);
    });
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function toPanel() {
    if (panel && panel.scrollIntoView) {
      panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  /* ---------- Sending sequence ---------- */

  function reducedMotion() {
    return !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function runLoading(done) {
    var hold = reducedMotion() ? 300 : HOLD_MS;

    show(stateLoad);

    /* The form is very tall and this panel is short, so swapping them
       collapses the page and leaves the viewport parked below the
       panel -- she would spend the whole wait looking at the footer.
       Pull the panel back into view. */
    toPanel();

    loadMsg.textContent = MESSAGES[0];
    if (loadBar) loadBar.style.width = (100 / MESSAGES.length) + '%';

    MESSAGES.slice(1).forEach(function (msg, i) {
      timers.push(setTimeout(function () {
        setLoadMsg(msg);
        if (loadBar) loadBar.style.width = ((i + 2) / MESSAGES.length * 100) + '%';
      }, hold * (i + 1)));
    });

    timers.push(setTimeout(done, hold * MESSAGES.length));
  }

  function setLoadMsg(msg) {
    loadMsg.textContent = msg;
    // Replay the fade so each subtitle arrives rather than snapping.
    loadMsg.style.animation = 'none';
    void loadMsg.offsetWidth;
    loadMsg.style.animation = '';
  }

  /* ---------- Confirmation ----------
     Every line here is either fixed copy or something she typed. No
     figure is worked out on this page. */

  function echoRow(label, value) {
    var li = document.createElement('li');
    var l = document.createElement('span');
    var v = document.createElement('i');
    l.textContent = label;
    v.textContent = value;
    li.appendChild(l);
    li.appendChild(v);
    echoList.appendChild(li);
  }

  function confirm(input) {
    setText('doneTitle', 'We’ve got your answers, ' + input.firstName + '.');
    setText('doneSub',
      'Nothing appears on this screen — that’s not how this one works. A real person reads ' +
      'what you sent, writes your page, and emails it to ' + input.email + ' within ' +
      TURNAROUND + '.');

    if (echoList) {
      echoList.innerHTML = '';
      echoRow('Practice', input.practice + ' · ' + input.ptype);
      echoRow('On your list', withCommas(input.onfile) + ' ' + plural(input.onfile, 'person', 'people'));
      echoRow('Haven’t been in for a year', withCommas(input.quiet) + ' ' + plural(input.quiet, 'person', 'people'));
      echoRow('A typical visit', money(input.visit));
      echoRow('You mostly treat', input.treats);
      echoRow('You book clients in', input.software);
      echoRow('You last contacted them', input.lastsent);
      if (input.lastresult) echoRow('How it went', input.lastresult);
      echoRow('We’ll email it to', input.email + (input.phone ? ' · ' + input.phone : ''));
    }

    /* Her answer to "what do you mostly treat" is free prose and can be a
       sentence, a list or one word -- splicing it into the middle of our
       sentence read badly for anything but a bare noun phrase. The
       practice name is the safe thing to personalise with here; her own
       words are already read straight back to her in the echo above. */
    setText('nextStep2',
      'The numbers, the five days of messages written around what ' + input.practice +
      ' actually treats, and what we’d change about the last time you contacted that list.');

    var cta = $('doneCta');
    if (cta) cta.textContent = 'Book the Call — Don’t Wait for the Email, ' + input.firstName;

    show(stateDone);
    toPanel();
  }

  /* ---------- Failure ----------
     Back to the form with everything she typed still in it, and a
     banner saying plainly that nothing reached us. */
  function failed() {
    show(stateForm);
    goStep(LAST_STEP);
    if (errorBox) {
      errorBox.hidden = false;
      if (errorBox.scrollIntoView) errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    submitBtn.disabled = false;
    submitBtn.textContent = LABEL_RETRY;
    if (loadBar) loadBar.style.width = '0';
  }

  /* ---------- Lead capture ----------
     XHR rather than fetch: this send is the entire product, so it has
     to work everywhere and it has to report a status code back.

     The subject line carries the practice name and the value of the
     quiet part of the list, so the inbox sorts by opportunity size on
     its own. That figure is deliberately the raw ceiling (quiet
     clients x one visit) and NOT the calculator's target rate -- a
     second copy of RATE_TARGET living over here would silently drift
     from the one in calculator.js, and since the rate is a constant
     the ordering is identical either way. It is an internal sorting
     key; it is never shown to her. */
  function sendLead(input, cb) {
    var listValue = input.quiet * input.visit;

    var payload = {
      firstName: input.firstName,
      email: input.email,
      phone: input.phone || '(not given)',
      practice: input.practice,
      practiceType: input.ptype,
      mostlyTreats: input.treats,
      peopleOnFile: input.onfile,
      quietClients: input.quiet,
      quietShare: Math.round((input.quiet / input.onfile) * 100) + '%',
      averageVisit: money(input.visit),
      quietListValue: money(listValue),
      listLivesIn: input.software,
      lastMessagedList: input.lastsent,
      whatHappened: input.lastresult || '(not given)',
      source: 'Quiet Client Audit',
      pageUrl: window.location.href,
      referrer: document.referrer || '(direct)',
      _subject: 'Audit request: ' + input.practice + ' — ' + money(listValue) +
                ' quiet list (' + withCommas(input.quiet) + ' people)'
    };

    var xhr = new XMLHttpRequest();
    var settled = false;
    function settle(ok) { if (!settled) { settled = true; cb(ok); } }

    xhr.open('POST', FORMSPREE, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = TIMEOUT_MS;
    xhr.onload = function () { settle(xhr.status >= 200 && xhr.status < 300); };
    xhr.onerror = function () { settle(false); };
    xhr.ontimeout = function () { settle(false); };

    try {
      xhr.send(JSON.stringify(payload));
    } catch (e) {
      settle(false);
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'audit_submit', {
        quiet_clients: input.quiet,
        quiet_list_value: Math.round(listValue)
      });
    }
  }

  /* ---------- Submit ---------- */

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Honeypot: a filled hidden field means a bot. Look successful,
    // send nothing.
    var hp = $('_gotcha');
    if (hp && hp.value) { show(stateDone); return; }

    /* Enter inside a text field submits the whole form, so on any
       step but the last that keystroke has to mean "continue". */
    if (current < LAST_STEP) {
      if (validateStep(current)) goStep(current + 1);
      return;
    }

    var input = validateAll();
    if (!input) return;

    if (errorBox) errorBox.hidden = true;
    submitBtn.disabled = true;

    /* The send and the sequence run in parallel and the panel waits
       for whichever finishes last. Unlike the calculator there is
       nothing to reveal early: if the POST hasn't landed there is no
       confirmation to make. */
    var sent = { settled: false, ok: false };
    var loaded = false;
    var shown = false;

    function finish() {
      if (shown || !sent.settled) return;
      shown = true;
      if (sent.ok) confirm(input); else failed();
    }

    sendLead(input, function (ok) {
      sent.settled = true;
      sent.ok = ok;
      if (loaded) finish();
    });

    runLoading(function () {
      loaded = true;
      if (sent.settled) {
        finish();
      } else {
        // Held open on purpose -- pretending the send finished when it
        // hasn't is the one thing this panel must never do.
        setLoadMsg(LATE_MSG);
        if (loadBar) loadBar.style.width = '100%';
      }
    });
  });

  /* ---------- Fill it in again ----------
     Keeps everything she typed so a correction is an edit, not a
     retype. The previous send has already gone; this is a second one. */
  if (redoBtn) {
    redoBtn.addEventListener('click', function () {
      clearTimers();
      submitBtn.disabled = false;
      submitBtn.textContent = LABEL_SEND;
      if (errorBox) errorBox.hidden = true;
      if (loadBar) loadBar.style.width = '0';
      show(stateForm);
      goStep(1);
    });
  }

  /* ---------- Nothing is persisted ----------
     Same rule as the calculator: a back-forward cache restore must
     not put the last visitor's answers back on a front-desk screen. */
  function wipe() {
    clearTimers();
    if (echoList) echoList.innerHTML = '';
    setText('doneTitle', 'We’ve got your answers.');
    setText('doneSub',
      'A real person reads them, writes your page, and emails it to you within ' +
      TURNAROUND + '.');
    setText('nextStep2',
      'The numbers, the five days of messages written around what you treat, and what we’d ' +
      'change about the last time you contacted that list.');

    form.reset();
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('is-error'); });
    form.querySelectorAll('[aria-invalid]').forEach(function (el) {
      el.removeAttribute('aria-invalid');
    });
    ['ptype', 'software', 'lastsent'].forEach(function (id) {
      var el = $(id);
      if (el) el.classList.add('is-empty');
    });

    submitBtn.disabled = false;
    submitBtn.textContent = LABEL_SEND;
    if (errorBox) errorBox.hidden = true;
    if (loadBar) loadBar.style.width = '0';
    show(stateForm);
    goStep(1);
  }

  window.addEventListener('pagehide', wipe);

  /* Start on step one with the bar drawn to match. */
  goStep(1, false);
})();
