(function () {
  'use strict';

  // ---- gallery: framed prints, each with its duotone and its recipe ----
  var GALLERY = [
    {
      name: 'Waves', meta: 'waves · 6s', file: 'assets/waves/frames.json',
      fg: '#1f3a4a', fg2: '#7d9aa8',
      recipe: '{\n  "sourceId": "waves",\n  "sourceParams": { "waves": {\n    "scale": 3,\n    "layers": 3,\n    "radial": 0.5\n  } },\n  "duration": 6\n}',
    },
    {
      name: 'Rain', meta: 'rain · 6s', file: 'assets/rain/frames.json',
      fg: '#1e3a34', fg2: '#7ba193',
      recipe: '{\n  "sourceId": "rain",\n  "sourceParams": { "rain": {\n    "density": 0.7,\n    "tail": 14,\n    "glitter": 0.5\n  } },\n  "duration": 6\n}',
    },
    {
      name: 'Knot', meta: 'shapes3d · 8s', file: 'assets/knot/frames.json',
      fg: '#4a3320', fg2: '#b98d5f',
      recipe: '{\n  "sourceId": "shapes3d",\n  "sourceParams": { "shapes3d": {\n    "shape": "knot",\n    "spinX": 1,\n    "spinY": 1\n  } },\n  "duration": 8\n}',
    },
    {
      name: 'Ripples', meta: 'expr · 6s', file: 'assets/ripples/frames.json',
      fg: '#2c2647', fg2: '#8a83b0',
      recipe: '{\n  "sourceId": "expr",\n  "sourceParams": { "expr": { "expr":\n    "0.5 + 0.5*sin(\n       8*length(x,y)\n       - 2*theta)" } },\n  "duration": 6\n}',
    },
    {
      name: 'Spring', meta: 'parametric3d · 8s', file: 'assets/spring/frames.json',
      fg: '#2f3d1f', fg2: '#869a63',
      recipe: '{\n  "sourceId": "parametric3d",\n  "sourceParams": { "parametric3d": {\n    "xExpr": "(1+0.3*cos(v))*cos(u*3)*(0.4+u/9)",\n    "yExpr": "u/3 - 1 + 0.3*sin(v)",\n    "zExpr": "(1+0.3*cos(v))*sin(u*3)*(0.4+u/9)"\n  } },\n  "duration": 8\n}',
    },
  ];

  var gallery = document.getElementById('gallery');
  GALLERY.forEach(function (item) {
    var fig = document.createElement('figure');
    fig.className = 'print';
    fig.tabIndex = 0;

    var plate = document.createElement('div');
    plate.className = 'plate';
    var holder = document.createElement('div');
    holder.className = 'glc-ascii';
    holder.setAttribute('aria-hidden', 'true');
    holder.dataset.embed = item.file;
    holder.dataset.mode = 'gradient';
    holder.dataset.fg = item.fg;
    holder.dataset.fg2 = item.fg2;
    var recipe = document.createElement('pre');
    recipe.className = 'recipe';
    recipe.textContent = item.recipe;
    plate.appendChild(holder);
    plate.appendChild(recipe);

    var cap = document.createElement('figcaption');
    var name = document.createElement('span');
    name.className = 'pname';
    name.textContent = item.name;
    var meta = document.createElement('span');
    meta.className = 'pmeta';
    meta.textContent = item.meta;
    cap.appendChild(name);
    cap.appendChild(meta);

    fig.appendChild(plate);
    fig.appendChild(cap);
    var actions = document.createElement('div');
    actions.className = 'example-actions';
    var open = document.createElement('a');
    open.className = 'example-action';
    open.href = '/studio/?recipe=' + encodeURIComponent(item.recipe);
    open.textContent = 'Open this preset';
    open.dataset.event = 'example_opened';
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'example-action';
    copy.textContent = 'Copy embed';
    copy.dataset.copyEmbed = item.file;
    actions.append(open, copy);
    fig.appendChild(actions);
    gallery.appendChild(fig);
  });

  // Provider-neutral event hook. The hosted site installs a narrow first-party
  // sink below; source checkouts and other hosts send nothing by default.
  function emit(name, properties) {
    var detail = { name: name, at: new Date().toISOString(), properties: properties || {} };
    window.dispatchEvent(new CustomEvent('glyphloop:event', { detail: detail }));
    if (typeof window.glyphloopTelemetry === 'function') window.glyphloopTelemetry(detail);
  }

  function installHostedTelemetry() {
    if (window.glyphloopTelemetry || !/^(www\.)?glyphloop\.art$/.test(window.location.hostname)) return;
    if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1') return;
    try {
      if (localStorage.getItem('glyphloop-analytics-disabled') === '1') return;
      var anonymousId = telemetryId(localStorage, 'glyphloop-anonymous-id');
      var sessionId = telemetryId(sessionStorage, 'glyphloop-session-id');
      if (!anonymousId || !sessionId) return;
      window.glyphloopTelemetry = function (event) {
        var body = JSON.stringify({
          name: event.name,
          anonymousId: anonymousId,
          sessionId: sessionId,
          path: window.location.pathname,
          version: 'site',
          properties: {},
        });
        fetch('/api/events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body,
          credentials: 'omit',
          keepalive: true,
        }).catch(function () {});
      };
    } catch (_) {
      // Storage can be unavailable in private or embedded contexts.
    }
  }

  function telemetryId(storage, key) {
    var id = storage.getItem(key);
    if (id && /^[0-9a-f-]{36}$/i.test(id)) return id;
    if (!window.crypto || typeof window.crypto.randomUUID !== 'function') return '';
    id = window.crypto.randomUUID();
    storage.setItem(key, id);
    return id;
  }

  installHostedTelemetry();

  document.addEventListener('click', function (event) {
    var target = event.target.closest && event.target.closest('[data-event]');
    if (target) emit(target.dataset.event, { href: target.getAttribute('href') || '' });
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-copy-embed]');
    if (!button) return;
    var frames = new URL(button.dataset.copyEmbed, window.location.href).href;
    var player = new URL('player.js', window.location.href).href;
    var snippet = '<div id="glyphloop-animation"></div>\n' +
      '<script src="' + player + '"><\/script>\n' +
      '<script>fetch("' + frames + '").then(r => r.json()).then(data => AsciiPlayer(document.getElementById("glyphloop-animation"), data));<\/script>';
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      button.textContent = 'Copy unavailable';
      return;
    }
    navigator.clipboard.writeText(snippet).then(function () {
      var original = button.textContent;
      button.textContent = 'Copied';
      emit('embed_copied', { frames: button.dataset.copyEmbed });
      setTimeout(function () { button.textContent = original; }, 1600);
    }).catch(function () {
      button.textContent = 'Copy failed';
    });
  });

  // ---- embed player: duotone gradient text, pause offscreen ----
  function reduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var playbackObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var el = e.target;
      if (!el._ctrl) return;
      if (e.isIntersecting) { if (!reduced()) el._ctrl.play(); }
      else el._ctrl.pause();
    });
  }, { rootMargin: '250px 0px' });

  function mount(el) {
    if (el._ctrl || el._loading) return;
    var src = el.dataset.embed;
    if (el.dataset.embedPortrait && window.innerHeight > window.innerWidth) src = el.dataset.embedPortrait;
    el._loading = fetch(src)
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load ' + src);
        return r.json();
      })
      .then(function (data) {
        var cols = data.cols, ramp = data.ramp;
        var colored = !!(data.palette && data.colorFrames && data.colorFrames.length);

        function expandChars(pairs) {
          var arr = [];
          for (var i = 0; i < pairs.length; i += 2) {
            var ch = ramp[pairs[i + 1]];
            for (var n = 0; n < pairs[i]; n++) arr.push(ch);
          }
          return arr;
        }

        var frames;
        if (colored) {
          // per-cell palette colors: render each frame as spans per color run
          frames = data.frames.map(function (pairs, fi) {
            var chars = expandChars(pairs);
            var cpairs = data.colorFrames[fi] || data.colorFrames[0];
            var html = '';
            var pos = 0;
            for (var i = 0; i < cpairs.length; i += 2) {
              var len = cpairs[i], color = data.palette[cpairs[i + 1]];
              var text = '';
              for (var k = 0; k < len; k++) {
                if (pos > 0 && pos % cols === 0) text += '\n';
                text += chars[pos++];
              }
              text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
              html += '<span style="color:' + color + '">' + text + '</span>';
            }
            return html;
          });
        } else {
          frames = data.frames.map(function (pairs) {
            var arr = expandChars(pairs);
            var out = '';
            for (var rr = 0; rr < arr.length; rr += cols) out += arr.slice(rr, rr + cols).join('') + '\n';
            return out;
          });
        }

        var pre = document.createElement('pre');
        var fg = el.dataset.fg || '#2b333a';
        var fg2 = el.dataset.fg2 || '#efe6d4';
        if (colored) {
          // spans carry their own colors
        } else if (el.dataset.mode === 'gradient') {
          pre.style.backgroundImage = 'linear-gradient(to top, ' + fg + ' 0%, ' + fg2 + ' 100%)';
          pre.style.webkitBackgroundClip = 'text';
          pre.style.backgroundClip = 'text';
          pre.style.color = 'transparent';
        } else {
          pre.style.color = fg;
        }
        var show = colored
          ? function (i) { pre.innerHTML = frames[i]; }
          : function (i) { pre.textContent = frames[i]; };
        show(0);
        // image underlay beneath the glyphs (mirrors the embed player)
        if (data.underlay) {
          var im = document.createElement('img');
          im.src = data.underlay;
          im.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;pointer-events:none;';
          if (data.underlayOpacity != null) im.style.opacity = String(data.underlayOpacity);
          if (data.underlayBrightness != null) im.style.filter = 'brightness(' + data.underlayBrightness + ')';
          if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
          el.appendChild(im);
          pre.style.position = 'relative';
        }
        if (data.animOpacity != null && data.animOpacity < 1) pre.style.opacity = String(data.animOpacity);
        el.appendChild(pre);

        var rows = data.rows || 1;
        var fit = function () {
          var w = el.clientWidth, h = el.clientHeight;
          if (w <= 0) return;
          var size = w / (cols * 0.602);
          if (el.dataset.fit === 'cover' && h > 0) size = Math.max(size, h / rows);
          el.style.fontSize = Math.max(2, size) + 'px';
        };
        fit();
        requestAnimationFrame(fit);
        if (window.ResizeObserver) {
          var ro = new ResizeObserver(fit);
          ro.observe(el);
        }

        // data-sync="#selector" slaves the frame clock to a <video>, so ramp
        // variants stay frame-locked with the original even across switches.
        var syncEl = el.dataset.sync ? document.querySelector(el.dataset.sync) : null;
        var ctrl = { raf: null, start: null, last: -1 };
        var tick = function (now) {
          var i;
          if (syncEl && syncEl.readyState >= 2) {
            i = Math.floor(syncEl.currentTime * data.fps) % frames.length;
          } else {
            if (ctrl.start === null) ctrl.start = now;
            i = Math.floor(((now - ctrl.start) / 1000) * data.fps) % frames.length;
          }
          if (i !== ctrl.last) { show(i); ctrl.last = i; }
          ctrl.raf = requestAnimationFrame(tick);
        };
        ctrl.play = function () { if (!ctrl.raf && frames.length > 1) { ctrl.start = null; ctrl.raf = requestAnimationFrame(tick); } };
        ctrl.pause = function () { if (ctrl.raf) { cancelAnimationFrame(ctrl.raf); ctrl.raf = null; } };
        el._ctrl = ctrl;
        playbackObserver.observe(el);
        if (!reduced()) ctrl.play();
      })
      .catch(function () {});
  }

  var loadObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      loadObserver.unobserve(el);
      if (el.matches('video[data-src]')) {
        var reduceMotion = reduced();
        if (reduceMotion) {
          el.removeAttribute('autoplay');
          el.autoplay = false;
          el.addEventListener('loadeddata', function () { el.pause(); }, { once: true });
        }
        el.src = el.dataset.src;
        el.removeAttribute('data-src');
        el.load();
      } else {
        mount(el);
      }
    });
  }, { rootMargin: '0px' });

  [].slice.call(document.querySelectorAll('.glc-ascii[data-embed]')).forEach(function (el) {
    if (!el.hidden) loadObserver.observe(el);
  });
  [].slice.call(document.querySelectorAll('video[data-src]')).forEach(function (el) {
    loadObserver.observe(el);
  });

  // ---- ramp switcher (agents demo): show one variant, mount on first view ----
  [].slice.call(document.querySelectorAll('.duo-ramps')).forEach(function (bar) {
    bar.addEventListener('click', function (e) {
      var btn = e.target;
      if (btn.tagName !== 'BUTTON') return;
      [].slice.call(bar.querySelectorAll('button')).forEach(function (b) {
        b.classList.toggle('on', b === btn);
      });
      var panel = bar.closest('.duo-panel');
      [].slice.call(panel.querySelectorAll('.glc-ascii')).forEach(function (el) {
        var show = el.dataset.embed === btn.dataset.embed;
        el.hidden = !show;
        if (show) mount(el);
      });
    });
  });

  // ---- one-time 1.0 release note ----
  var form = document.getElementById('wl-form');
  var done = document.getElementById('wl-done');
  var error = document.getElementById('wl-error');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    error.textContent = '';
    var btn = form.querySelector('button');
    btn.disabled = true;
    fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: form.email.value,
        company: form.company.value,
        consent: 'v1-launch-note',
      }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.ok) {
          form.style.display = 'none';
          done.style.display = 'inline-block';
        } else {
          error.textContent = (res.d && res.d.error) || 'something went wrong, try again';
          btn.disabled = false;
        }
      })
      .catch(function () {
        error.textContent = 'network error, try again';
        btn.disabled = false;
      });
  });
})();
