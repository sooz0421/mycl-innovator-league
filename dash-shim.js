/* Minimal stand-in for the Claude dashboard runtime, so the same page code runs on a plain website. */
(function () {
  const datasets = {};
  const failed = {};
  const calcs = {};
  const cache = {};
  const draws = {};

  const rowsOf = (id) => {
    if (calcs[id]) return computeCalc(id);
    if (failed[id]) return null;
    return id in datasets ? datasets[id] : null;
  };
  function computeCalc(id) {
    if (id in cache) return cache[id];
    const c = calcs[id];
    const args = c.inputs.map((i) => rowsOf(i));
    if (args.some((a) => a === null)) return null;
    try { cache[id] = c.fn(...args.map((a) => (Array.isArray(a) ? a.slice() : a))); }
    catch (e) { console.error('calc ' + id, e); cache[id] = null; }
    return cache[id];
  }
  const anyFailed = (id) => (calcs[id] ? calcs[id].inputs.some(anyFailed) : !!failed[id]);

  function runDraw(name) {
    const fn = draws[name];
    if (!fn) return;
    document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
      try { fn(el); } catch (e) { console.error('draw ' + name, e); }
    });
  }
  const runAll = () => Object.keys(draws).forEach(runDraw);

  window.dash = {
    calc(id, o) { calcs[id] = o; },
    data(id) {
      if (anyFailed(id)) return { status: 'error', data: [], message: '' };
      const v = rowsOf(id);
      return v === null ? { status: 'loading', data: [] } : { status: 'ok', data: v };
    },
    draw(name, fn) { if (fn) draws[name] = fn; else runDraw(name); },
    onData(fn) { try { fn(); } catch (e) { console.error(e); } },
    loader() {},
    colors: ['#3BA4FF', '#F5A623', '#5BE37D', '#FF6B6B', '#7B4FD6', '#FFD15C', '#2FAE6B', '#E5483B'],
    params() { return {}; }, setParams() {}, resetParams() {}, setLink() {}, refresh() {}
  };

  const bust = '?v=' + Math.floor(Date.now() / 60000);
  async function load(id, url, kind) {
    try {
      const res = await fetch(url + bust, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      datasets[id] = kind === 'csv' ? d3.csvParse(text) : JSON.parse(text);
    } catch (e) { console.error('load ' + id, e); failed[id] = true; }
  }

  window.ixDashStart = async function () {
    datasets.fonts = [];
    datasets.brand = [
      { name: 'logo', src: 'assets/logo.png', w: 300, h: 137 },
      { name: 'mascot', src: 'assets/mascot.webp', w: 340, h: 469 }
    ];
    runAll();
    await Promise.all([load('trainings', 'data/trainings.csv', 'csv'), load('korea_map', 'data/korea_map.json', 'json')]);
    Object.keys(cache).forEach((k) => delete cache[k]);
    runAll();
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('700 18px "IX Nexon"'), document.fonts.load('400 14px "IX Barun"')])
        .then(() => runDraw('title-art')).catch(() => {});
    }
    const widths = new WeakMap();
    let t = null;
    const ro = new ResizeObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        if (widths.get(e.target) !== w) { widths.set(e.target, w); changed = true; }
      }
      if (!changed) return;
      clearTimeout(t);
      t = setTimeout(() => { runDraw('title-art'); runDraw('months'); }, 150);
    });
    document.querySelectorAll('[data-draw="title-art"],[data-draw="months"]').forEach((el) => ro.observe(el));
  };
})();
