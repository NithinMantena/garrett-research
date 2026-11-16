/* Garrett Motion research site.
 * Top-level tabs are in TABS; state permit pages are sub-tabs in STATES (sections nested inside #tab-states).
 * To add a tab: add a <section id="tab-KEY"> in index.html, a data file in data/, and an entry in TABS or STATES.
 */
(function () {
  "use strict";
  const D = window.GARRETT_DATA || {};
  /* The state pages' turbo lens was built before the data-sheet evidence: relabel the 3516E / C175 band with what the filings show. */
  const EVIDENCE_NOTE = "Engine data sheets in permit filings show the C175 and the 3516E at 2,750 ekW use Garrett turbos, and the 3516E at 3,000 ekW uses Accelleron (see the Garrett turbo share tab).";
  ["virginia", "georgia", "ohio", "texas", "arizona"].forEach((k) => ((D[k] && D[k].lens) || []).forEach((l) => {
    if (l.key === "cat_unconfirmed") { l.label = "Cat 3516E / C175"; l.note = "Newest Cat platforms. C175 and 3516E 2,750 ekW: Garrett turbos; 3516E 3,000 ekW: Accelleron."; }
  }));

  const TABS = [
    { key: "turbo", label: "Garrett turbo share", render: renderTurbo },
    { key: "states", label: "State permits", render: renderStatesNav },
    { key: "share", label: "Share model & prime power", render: renderShare },
  ];
  /* State permit sub-tabs. "full" = complete permit set used for MW weights; the rest are filings collected for turbo evidence. */
  const STATES = [
    { key: "virginia", label: "Virginia", full: true, render: renderVirginia },
    { key: "georgia", label: "Georgia", full: true, render: () => renderState("georgia") },
    { key: "ohio", label: "Ohio", full: true, render: () => renderState("ohio") },
    { key: "texas", label: "Texas", full: true, render: () => renderState("texas") },
    { key: "arizona", label: "Arizona", full: true, render: () => renderState("arizona") },
    { key: "maryland", label: "Maryland", render: () => renderLightState("maryland") },
    { key: "missouri", label: "Missouri", render: () => renderLightState("missouri") },
    { key: "indiana", label: "Indiana", render: () => renderLightState("indiana") },
    { key: "california", label: "California", render: () => renderLightState("california") },
    { key: "northdakota", label: "North Dakota", render: () => renderLightState("northdakota") },
    { key: "wisconsin", label: "Wisconsin", render: () => renderLightState("wisconsin") },
  ];

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
  const num = (x, d = 0) => Number(x).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const lensColor = (k) => `var(--lens-${k})`;

  function isLight(color) {
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return false;
    const [r, g, b] = [+m[1], +m[2], +m[3]].map((v) => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35;
  }

  /* tooltip */
  const tip = $("#tooltip");
  function bindTip(el, html) {
    el.addEventListener("mouseenter", () => { tip.innerHTML = html; tip.hidden = false; });
    el.addEventListener("mousemove", (e) => {
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let x = e.clientX + 14, y = e.clientY + 14;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
      if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
      tip.style.left = x + "px"; tip.style.top = y + "px";
    });
    el.addEventListener("mouseleave", () => { tip.hidden = true; });
  }

  /* sortable table */
  function sortableTable(table, cols, rows, opts = {}) {
    let sortKey = opts.sortKey || null, dir = opts.dir || -1;
    function draw() {
      const data = rows().slice();
      if (sortKey) {
        const c = cols.find((c) => c.key === sortKey);
        const v = c.sort || ((r) => r[sortKey]);
        data.sort((a, b) => {
          const x = v(a), y = v(b);
          if (x == null) return 1; if (y == null) return -1;
          return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
        });
      }
      table.innerHTML =
        "<thead><tr>" + cols.map((c) =>
          `<th data-key="${c.key}" class="${c.num ? "num" : ""}" ${c.key === sortKey ? `aria-sort="${dir > 0 ? "ascending" : "descending"}"` : ""} scope="col">${esc(c.label)}</th>`).join("") +
        "</tr></thead><tbody>" +
        (data.length ? data.map((r) => "<tr>" + cols.map((c) =>
          `<td class="${c.num ? "num" : ""}">${c.html ? c.html(r) : esc(r[c.key])}</td>`).join("") + "</tr>").join("")
          : `<tr><td colspan="${cols.length}" class="muted">No rows match.</td></tr>`) +
        "</tbody>" + (opts.foot ? `<tfoot>${opts.foot(data)}</tfoot>` : "");
      table.querySelectorAll("th[data-key]").forEach((th) => th.addEventListener("click", () => {
        const k = th.dataset.key;
        dir = sortKey === k ? -dir : (cols.find((c) => c.key === k).num ? -1 : 1);
        sortKey = k; draw();
      }));
      if (opts.after) opts.after(table, data);
    }
    draw();
    return draw;
  }

  /* stacked 100% bar row */
  function stackRow(parent, label, sub, parts, fmtTip) {
    const row = document.createElement("div");
    row.className = "stackrow";
    parent.appendChild(row);
    row.innerHTML = `<div class="stackrow-label"><strong>${esc(label)}</strong>${esc(sub || "")}</div><div class="stack"></div>`;
    const stack = row.querySelector(".stack");
    const total = parts.reduce((a, p) => a + p.value, 0) || 1;
    parts.filter((p) => p.value > 0).forEach((p) => {
      const seg = document.createElement("div");
      seg.className = "seg";
      seg.style.flex = `${p.value / total} 1 0`;
      seg.style.background = p.color;
      const share = p.value / total;
      stack.appendChild(seg);
      if (share >= 0.06) seg.innerHTML = `<span class="seg-label ${isLight(getComputedStyle(seg).backgroundColor) ? "dark" : ""}">${pct(share, 0)}</span>`;
      bindTip(seg, fmtTip(p, share));
    });
    return row;
  }

  /* ---------- tabs ---------- */
  const rendered = {}, stRendered = {};
  let curState = "virginia";
  try { const s0 = localStorage.getItem("gtx-state"); if (s0 && STATES.some((s) => s.key === s0)) curState = s0; } catch (e) {}
  function showTab(key) {
    if (STATES.some((s) => s.key === key)) { curState = key; key = "states"; }
    if (!TABS.some((t) => t.key === key)) key = TABS[0].key;
    tip.hidden = true;
    TABS.forEach((t) => {
      const on = t.key === key;
      $("#tab-" + t.key).hidden = !on;
      const b = $("#tabbtn-" + t.key);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    if (!rendered[key]) { TABS.find((t) => t.key === key).render(); rendered[key] = true; }
    if (key === "states") showState(curState);
    try { localStorage.setItem("gtx-tab", key); } catch (e) {}
  }
  function showState(k) {
    STATES.forEach((s) => {
      const on = s.key === k;
      $("#tab-" + s.key).hidden = !on;
      const b = $("#stbtn-" + s.key);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    if (!stRendered[k]) { STATES.find((s) => s.key === k).render(); stRendered[k] = true; }
    try { localStorage.setItem("gtx-state", k); } catch (e) {}
  }
  function renderStatesNav() {
    const btn = (s) => `<button type="button" class="subtab" role="tab" id="stbtn-${s.key}" aria-controls="tab-${s.key}">${esc(s.label)}</button>`;
    $("#state-tabs").innerHTML =
      `<div class="subtab-group"><span class="subtab-label">Full permit sets</span>${STATES.filter((s) => s.full).map(btn).join("")}</div>` +
      `<div class="subtab-group"><span class="subtab-label">Filings collected</span>${STATES.filter((s) => !s.full).map(btn).join("")}</div>`;
    STATES.forEach((s) => $("#stbtn-" + s.key).addEventListener("click", () => {
      if (location.hash !== "#" + s.key) location.hash = s.key; else showState(s.key);
    }));
  }
  function initTabs() {
    const nav = $("#tabs");
    nav.innerHTML = TABS.map((t) =>
      `<button type="button" class="tab" role="tab" id="tabbtn-${t.key}" aria-controls="tab-${t.key}">${esc(t.label)}</button>`).join("");
    TABS.forEach((t) => $("#tabbtn-" + t.key).addEventListener("click", () => {
      if (location.hash !== "#" + t.key) location.hash = t.key; else showTab(t.key);
    }));
    nav.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const i = TABS.findIndex((t) => $("#tabbtn-" + t.key).getAttribute("aria-selected") === "true");
      const n = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
      location.hash = n.key; $("#tabbtn-" + n.key).focus();
    });
    window.addEventListener("hashchange", () => showTab(location.hash.slice(1)));
    let start = location.hash.slice(1);
    if (!start) { try { start = localStorage.getItem("gtx-tab") || ""; } catch (e) {} }
    showTab(start);
  }

  /* ---------- Virginia tab ---------- */
  function renderVirginia() {
    const V = D.virginia;
    if (!V) { $("#tab-virginia").insertAdjacentHTML("beforeend", "<p>Virginia data file missing. Run scripts/build_virginia.py.</p>"); return; }
    const S = V.summary;
    const lensByKey = Object.fromEntries(V.lens.map((l) => [l.key, l]));
    const catShare = V.makers.find((m) => m.maker === "Caterpillar").share;
    const cat26 = (V.makers_new26.find((m) => m.maker === "Caterpillar") || {}).share || 0;

    $("#va-kpis").innerHTML = [
      ["Generators counted", num(S.gens_counted), `${num(S.gens_held)} more held for review`],
      ["Permitted capacity", num(S.mw_counted / 1000, 1) + " GW", `${S.sites_with_ok} sites`],
      ["Permits extracted", `${S.permits_read} / ${S.permits_listed}`, "Virginia DEQ list"],
      ["Caterpillar share of MW", pct(catShare, 0), `${pct(cat26, 0)} of new units in 2026 permits`, true],
      ["Cat 3516E / C175 in 2026", pct(lensByKey.cat_unconfirmed.share_new26, 0), "of new MW; turbo supplier unconfirmed", true],
    ].map(([l, v, n, a]) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value ${a ? "accent" : ""}">${v}</div><div class="kpi-note">${n}</div></div>`).join("");

    /* lens chart */
    const chart = $("#va-lens-chart");
    const tipFor = (p, share) => `<b>${esc(p.label)}</b><br>${num(p.value)} MW · ${pct(share)}`;
    stackRow(chart, "All counted units", `${num(S.mw_counted)} MW`,
      V.lens.map((l) => ({ label: l.label, value: l.mw, color: lensColor(l.key) })), tipFor);
    stackRow(chart, "New units, 2026 permits", `${num(S.new26_mw)} MW`,
      V.lens.map((l) => ({ label: l.label, value: l.mw_new26, color: lensColor(l.key) })), tipFor);

    $("#va-lens-legend").innerHTML = V.lens.map((l) => `
      <div class="legend-item">
        <span class="swatch" style="background:${lensColor(l.key)}"></span>
        <div><div class="lname">${esc(l.label)}</div><div class="lnote">${esc(l.note)}</div></div>
        <div class="lval">${pct(l.share, 0)}<br><span class="muted">${pct(l.share_new26, 0)} '26</span></div>
      </div>`).join("");

    const g = lensByKey.garrett, u = lensByKey.cat_unconfirmed;
    $("#va-lens-callout").innerHTML =
      `<b>What changes in 2026:</b> Cat engines where Garrett is confirmed (3512/3516B/C) are ${pct(g.share, 0)} of all permitted MW but only ${pct(g.share_new26, 0)} of new 2026 units. ` +
      `The newer 3516E and C175 take ${pct(u.share_new26, 0)} of new MW. ${EVIDENCE_NOTE}`;

    /* maker chart */
    const makers = V.makers;
    const m26 = Object.fromEntries(V.makers_new26.map((m) => [m.maker, m.share]));
    const max = Math.max(...makers.map((m) => Math.max(m.share, m26[m.maker] || 0)));
    const mc = $("#va-maker-chart");
    mc.innerHTML = `<div class="hbar-key"><span><i class="swatch" style="background:var(--red-700)"></i>All counted units</span><span><i class="swatch" style="background:var(--red-300)"></i>New units, 2026 permits</span></div><div class="hbars"></div>`;
    const hb = mc.querySelector(".hbars");
    makers.forEach((m) => {
      const r = document.createElement("div");
      r.className = "hbar-row";
      const s26 = m26[m.maker] || 0;
      r.innerHTML = `<div class="hbar-name">${esc(m.maker)}</div><div class="hbar-tracks">
        <div class="hbar-track"><div class="hbar" style="width:${(m.share / max) * 100}%;background:var(--red-700)"></div><div class="hbar-val">${pct(m.share, 0)}</div></div>
        <div class="hbar-track"><div class="hbar" style="width:${(s26 / max) * 100}%;background:var(--red-300)"></div><div class="hbar-val">${pct(s26, 0)}</div></div></div>`;
      bindTip(r, `<b>${esc(m.maker)}</b><br>All: ${num(m.mw)} MW (${pct(m.share)}), ${num(m.count)} units<br>2026 new: ${pct(s26)}`);
      hb.appendChild(r);
    });

    /* families */
    const lensLabel = Object.fromEntries(V.lens_defs.map((l) => [l.key, l.label]));
    sortableTable($("#va-family-table"), [
      { key: "family", label: "Engine", html: (r) => `<span class="tag"><span class="swatch" style="background:${lensColor(r.lens)}"></span>${esc(r.maker)} ${esc(r.family)}</span>` },
      { key: "count", label: "Units", num: true, html: (r) => num(r.count) },
      { key: "mw", label: "MW", num: true, html: (r) => num(r.mw) },
      { key: "share", label: "Share", num: true, html: (r) => pct(r.share) },
    ], () => V.families.filter((f) => f.mw >= 5), {
      sortKey: "mw",
      after: (t, data) => t.querySelectorAll("tbody tr").forEach((tr, i) => {
        const f = data[i]; if (!f) return;
        bindTip(tr, `<b>${esc(f.maker)} ${esc(f.family)}</b><br>${esc(lensLabel[f.lens])}<br>${num(f.kw_min)}${f.kw_max !== f.kw_min ? "–" + num(f.kw_max) : ""} kW per unit · ${f.sites} site${f.sites > 1 ? "s" : ""}`);
      }),
    });

    /* sites */
    const filterSel = $("#va-site-filter"), search = $("#va-site-search");
    const siteRows = () => {
      const f = filterSel.value, q = search.value.trim().toLowerCase();
      return V.sites.filter((s) => {
        if (f === "2026" && !(s.issued || "").startsWith("2026")) return false;
        if (f === "cat" && !s.makers.Caterpillar) return false;
        if (f === "ne" && !s.non_emergency) return false;
        if (q && !`${s.name} ${s.operator || ""} ${s.locality || ""}`.toLowerCase().includes(q)) return false;
        return true;
      });
    };
    const lensOrder = V.lens_defs.map((l) => l.key);
    const drawSites = sortableTable($("#va-site-table"), [
      { key: "name", label: "Site", html: (r) => `<a href="${esc(r.doc_url)}" target="_blank" rel="noopener">${esc(r.name)}</a>${r.operator && !r.name.toLowerCase().includes(r.operator.split(" ")[0].toLowerCase()) ? `<div class="small muted">${esc(r.operator)}</div>` : ""}` },
      { key: "locality", label: "Locality" },
      { key: "issued", label: "Issued", html: (r) => `<span class="mono">${esc(r.issued)}</span>` },
      { key: "count", label: "Units", num: true, html: (r) => num(r.count) },
      { key: "mw", label: "MW", num: true, html: (r) => num(r.mw) },
      { key: "max_kw", label: "Max kW/unit", num: true, html: (r) => num(r.max_kw) },
      { key: "cat", label: "Turbo lens", sort: (r) => (r.makers.Caterpillar || 0) / r.mw,
        html: (r) => `<div class="mini" data-site="${esc(r.id)}">${lensOrder.filter((k) => r.lens[k]).map((k) => `<span style="flex:${r.lens[k]} 1 0;background:${lensColor(k)}"></span>`).join("")}</div>` },
      { key: "non_emergency", label: "Non-emerg.", num: true, html: (r) => r.non_emergency ? num(r.non_emergency) : `<span class="muted">–</span>` },
    ], siteRows, {
      sortKey: "mw",
      foot: (data) => `<tr><td colspan="3">${data.length} sites</td><td class="num">${num(data.reduce((a, r) => a + r.count, 0))}</td><td class="num">${num(data.reduce((a, r) => a + r.mw, 0))}</td><td colspan="3"></td></tr>`,
      after: (t, data) => t.querySelectorAll(".mini").forEach((el) => {
        const s = data.find((d) => d.id === el.dataset.site);
        bindTip(el, `<b>${esc(s.name)}</b><br>` + lensOrder.filter((k) => s.lens[k]).map((k) => `${esc(lensLabel[k])}: ${num(s.lens[k])} MW`).join("<br>"));
      }),
    });
    filterSel.addEventListener("change", drawSites);
    search.addEventListener("input", drawSites);

    /* units */
    const lensSel = $("#va-unit-lens");
    V.lens_defs.forEach((l) => lensSel.insertAdjacentHTML("beforeend", `<option value="${l.key}">${esc(l.label)}</option>`));
    const drawUnits = sortableTable($("#va-unit-table"), [
      { key: "site_name", label: "Site" },
      { key: "maker", label: "Maker", html: (r) => `<span class="tag"><span class="swatch" style="background:${lensColor(r.lens)}"></span>${esc(r.maker)}</span>` },
      { key: "model", label: "Model as permitted", html: (r) => r.model ? `<span class="mono">${esc(r.model)}</span>` : `<span class="muted">not stated</span>` },
      { key: "count", label: "Units", num: true, html: (r) => num(r.count) },
      { key: "kw", label: "kW each", num: true, html: (r) => num(r.kw) },
      { key: "mw", label: "MW", num: true, html: (r) => num(r.mw, 1) },
      { key: "duty", label: "Duty", html: (r) => r.duty === "non_emergency" ? `<span class="pill yes">non-emergency</span>` : `<span class="pill">${esc(r.duty || "n/a")}</span>` },
      { key: "permit_doc_year", label: "Permit yr", html: (r) => `<span class="mono">${esc(r.permit_doc_year)}</span>` },
      { key: "page", label: "Page", num: true, html: (r) => `<a href="${esc(r.doc_url)}#page=${r.page}" target="_blank" rel="noopener">p.${r.page}</a>` },
    ], () => V.units.filter((u) => lensSel.value === "all" || u.lens === lensSel.value), {
      sortKey: "mw",
      foot: (data) => `<tr><td colspan="3">${data.length} rows</td><td class="num">${num(data.reduce((a, r) => a + r.count, 0))}</td><td></td><td class="num">${num(data.reduce((a, r) => a + r.mw, 0))}</td><td colspan="3"></td></tr>`,
    });
    lensSel.addEventListener("change", drawUnits);

    $("#va-source").innerHTML =
      `Source: Virginia DEQ air permits, extracted by A. Ibrampur, <a href="${esc(V.built_from.repo)}" target="_blank" rel="noopener">permit-pipeline</a> (commit <code>${esc(V.built_from.commit)}</code>, dataset built ${esc((V.built_from.dataset_built_at || "").slice(0, 10))}). ` +
      `Only rows that pass every check against the permit's own counts are included. "New units, 2026 permits" = rows in the new-equipment section of permits issued in 2026. ` +
      `Turbo-supplier tags are our own, from the research note. Rebuild with <code>python scripts/build_virginia.py</code>.`;
  }

  /* ---------- State permit tabs (Georgia, Ohio, ...) ----------
   * One renderer for every state built by scripts/build_state.py. The section in
   * index.html is an empty shell; markup comes from stateMarkup() and wording from
   * the data file's `meta` block.
   */
  function stateMarkup(k, M) {
    return `
    <div class="intro">
      <p class="eyebrow">${esc(M.eyebrow)}</p>
      <h1>${esc(M.title)}</h1>
      <p class="lede">${esc(M.lede)}</p>
    </div>
    <div class="kpis" id="${k}-kpis"></div>
    <article class="panel">
      <header class="panel-head"><div>
        <h2>Turbo-supplier lens: ${esc(M.state)} vs Virginia</h2>
        <p class="panel-sub">Share of generator MW by likely turbo source. "Recent" = units first permitted in ${esc(M.recent_label)}. The palest segment is capacity whose permit does not name the maker.</p>
      </div></header>
      <div id="${k}-lens-chart" class="stackchart"></div>
      <div id="${k}-lens-legend" class="legend-list"></div>
      <p class="callout" id="${k}-lens-callout"></p>
    </article>
    <div class="grid-2">
      <article class="panel">
        <header class="panel-head"><div>
          <h2>Engine maker share of MW</h2>
          <p class="panel-sub">Capacity where the permit names the maker. ${esc(M.state)} vs Virginia, all counted units.</p>
        </div></header>
        <div id="${k}-maker-chart"></div>
      </article>
      <article class="panel">
        <header class="panel-head"><div>
          <h2>Engine families</h2>
          <p class="panel-sub">Grouped from the model strings in each permit. Hover a row for its kW range.</p>
        </div></header>
        <div class="table-scroll"><table class="data" id="${k}-family-table"></table></div>
      </article>
    </div>
    <div class="grid-2">
      <article class="panel">
        <header class="panel-head"><div>
          <h2>Prime power</h2>
          <p class="panel-sub">On-site plants permitted to run all year to power a data centre, not as backup.</p>
        </div></header>
        <div id="${k}-prime"></div>
      </article>
      <article class="panel">
        <header class="panel-head"><div>
          <h2>What the permits don't say</h2>
          <p class="panel-sub">Facilities where the engine maker, size or count is missing or confidential.</p>
        </div></header>
        <ul class="gaps" id="${k}-gaps"></ul>
      </article>
    </div>
    <article class="panel">
      <header class="panel-head">
        <div>
          <h2>Sites</h2>
          <p class="panel-sub">One row per facility. Click a column to sort; the site name opens its latest permit document.</p>
        </div>
        <div class="controls">
          <label class="field" for="${k}-site-filter"><span>Show</span>
            <select id="${k}-site-filter">
              <option value="all">All sites</option>
              <option value="recent">Latest permit ${esc(M.recent_label)}</option>
              <option value="cat">Caterpillar on site</option>
              <option value="gap">Maker or count missing</option>
            </select>
          </label>
          <label class="field" for="${k}-site-search"><span>Search</span>
            <input id="${k}-site-search" type="search" placeholder="${esc(M.search_hint || "Amazon, county…")}">
          </label>
        </div>
      </header>
      <div class="table-scroll"><table class="data sortable" id="${k}-site-table"></table></div>
    </article>
    <article class="panel">
      <header class="panel-head">
        <div>
          <h2>Generator rows</h2>
          <p class="panel-sub">One row per engine group, with the document and page it came from.</p>
        </div>
        <div class="controls">
          <label class="field" for="${k}-unit-lens"><span>Turbo lens</span>
            <select id="${k}-unit-lens"><option value="all">All</option></select>
          </label>
        </div>
      </header>
      <div class="table-scroll tall"><table class="data sortable" id="${k}-unit-table"></table></div>
    </article>
    <footer class="source" id="${k}-source"></footer>`;
  }

  function renderState(key) {
    const G = D[key], V = D.virginia, sec = $("#tab-" + key);
    if (!G) { sec.innerHTML = `<p>${esc(key)} data file missing. Run scripts/build_state.py.</p>`; return; }
    const M = G.meta, k = key, S = G.summary;
    sec.innerHTML = stateMarkup(k, M);
    const L = Object.fromEntries(G.lens.map((l) => [l.key, l]));
    const yrs = M.recent_label;
    const share = (list, name) => (list.find((m) => m.maker === name) || {}).share || 0;
    const catNamed = share(G.makers_named, "Caterpillar"), eitherNamed = share(G.makers_named, "Cat or alternate");
    const namedShare = S.mw ? S.mw_named / S.mw : 0;
    const sitesUnits = G.sites.filter((s) => !s.prime_power);
    // When most recent capacity has no named maker, quote shares of the named MW instead.
    const useNamed = (L.unknown ? L.unknown.share_recent : 0) > 0.3;
    const rShare = (key) => useNamed ? (S.recent_named_mw ? L[key].mw_recent / S.recent_named_mw : 0) : L[key].share_recent;
    const aShare = (key) => useNamed ? (L[key].share_named || 0) : L[key].share;
    const basis = useNamed ? " where the maker is named" : "";
    const recentNamed = S.recent_mw ? S.recent_named_mw / S.recent_mw : 0;
    const thin = useNamed && recentNamed < 0.1;  // too little recent capacity names a maker to quote shares

    $(`#${k}-kpis`).innerHTML = [
      ["Backup generators", num(S.gens), S.gens_unsized ? `${num(S.gens_unsized)} with no size in the permit` : "all with a stated size"],
      ["Sized capacity", num(S.mw / 1000, 1) + " GW", `${S.sites_with_units} of ${S.sites} facilities have unit data`],
      ["Maker named", pct(namedShare, 0), "of sized MW; the rest is maker not stated", namedShare < 0.5],
      ["Caterpillar, where named", pct(catNamed, 0), eitherNamed ? `+${pct(eitherNamed, 0)} where Cat is one of two allowed makers` : `of ${num(S.mw_named)} MW with a named maker`, true],
      thin ? ["Cat 3516E / C175, recent", "n/a", `maker named for only ${pct(recentNamed, 0)} of MW first permitted ${yrs}`, true]
           : ["Cat 3516E / C175, recent", pct(rShare("cat_unconfirmed"), 0), `of MW first permitted ${yrs}${basis}; ${pct(rShare("garrett"), 0)} is 3516B/C`, true],
      S.prime_plant_mw ? ["Gas prime power", num(S.prime_plant_mw) + " MW", M.prime_kpi_note || "on-site plants that run all year"] : null,
    ].filter(Boolean).map(([l, v, n, a]) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value ${a ? "accent" : ""}">${v}</div><div class="kpi-note">${n}</div></div>`).join("");

    /* lens chart, with Virginia for comparison */
    const chart = $(`#${k}-lens-chart`);
    const tipFor = (p, s) => `<b>${esc(p.label)}</b><br>${num(p.value)} MW · ${pct(s)}`;
    stackRow(chart, `${M.state}, all units`, `${num(S.mw)} MW`,
      G.lens.map((l) => ({ label: l.label, value: l.mw, color: lensColor(l.key) })), tipFor);
    stackRow(chart, `${M.state}, permitted ${yrs}`, `${num(S.recent_mw)} MW`,
      G.lens.map((l) => ({ label: l.label, value: l.mw_recent, color: lensColor(l.key) })), tipFor);
    if (V) {
      stackRow(chart, "Virginia, all units", `${num(V.summary.mw_counted)} MW`,
        V.lens.map((l) => ({ label: l.label, value: l.mw, color: lensColor(l.key) })), tipFor);
      stackRow(chart, "Virginia, new in 2026", `${num(V.summary.new26_mw)} MW`,
        V.lens.map((l) => ({ label: l.label, value: l.mw_new26, color: lensColor(l.key) })), tipFor);
    }
    $(`#${k}-lens-legend`).innerHTML = G.lens.map((l) => `
      <div class="legend-item">
        <span class="swatch" style="background:${lensColor(l.key)};${l.key === "unknown" ? "outline:1px solid var(--line)" : ""}"></span>
        <div><div class="lname">${esc(l.label)}</div><div class="lnote">${esc(l.note)}</div></div>
        <div class="lval">${pct(l.share, 0)}<br><span class="muted">${pct(l.share_recent, 0)} recent</span></div>
      </div>`).join("");

    const vaG = V ? V.lens.find((l) => l.key === "garrett") : null;
    $(`#${k}-lens-callout`).innerHTML =
      `<b>${esc(M.callout_lead)}</b> ${useNamed ? `Counting only MW${basis} (${pct(S.mw_named / S.mw, 0)} of all, ${pct(S.recent_named_mw / (S.recent_mw || 1), 0)} of recent): ` : ""}Cat engines where Garrett is confirmed (3512/3516B/C) are ${pct(aShare("garrett"), 0)} of ${esc(M.state)} MW` +
      (thin ? ` (Virginia: ${vaG ? pct(vaG.share, 0) : "–"}); too little capacity permitted ${yrs} names its maker to compare recent shares.`
            : ` and ${pct(rShare("garrett"), 0)} of units permitted ${yrs}` +
              (vaG ? ` (Virginia: ${pct(vaG.share, 0)} overall, ${pct(vaG.share_new26, 0)} of 2026 units)` : "") +
              `; Cat 3516E and C175 take ${pct(rShare("cat_unconfirmed"), 0)} of recent MW${basis}.`) + ` ${EVIDENCE_NOTE}` +
      ` ${esc(M.callout_more || "")}`;

    /* maker chart vs Virginia */
    const vaShare = V ? Object.fromEntries(V.makers.map((m) => [m.maker, m.share])) : {};
    const names = G.makers_named.map((m) => m.maker);
    if (V) V.makers.forEach((m) => { if (!names.includes(m.maker) && m.share >= 0.005) names.push(m.maker); });
    const own = Object.fromEntries(G.makers_named.map((m) => [m.maker, m]));
    const rowsM = names.map((n) => ({ maker: n, s: own[n] ? own[n].share : 0, va: vaShare[n] || 0, g: own[n] }))
      .filter((r) => r.s >= 0.005 || r.va >= 0.005);
    const max = Math.max(...rowsM.map((r) => Math.max(r.s, r.va)), 0.01);
    const mc = $(`#${k}-maker-chart`);
    mc.innerHTML = `<div class="hbar-key"><span><i class="swatch" style="background:var(--red-700)"></i>${esc(M.state)} (maker named, ${num(S.mw_named)} MW)</span><span><i class="swatch" style="background:var(--grey-500)"></i>Virginia</span></div><div class="hbars"></div>`;
    const hb = mc.querySelector(".hbars");
    rowsM.forEach((r) => {
      const el = document.createElement("div");
      el.className = "hbar-row";
      el.innerHTML = `<div class="hbar-name">${esc(r.maker)}</div><div class="hbar-tracks">
        <div class="hbar-track"><div class="hbar" style="width:${(r.s / max) * 100}%;background:var(--red-700)"></div><div class="hbar-val">${pct(r.s, 0)}</div></div>
        <div class="hbar-track"><div class="hbar" style="width:${(r.va / max) * 100}%;background:var(--grey-500)"></div><div class="hbar-val">${V && r.maker !== "Cat or alternate" ? pct(r.va, 0) : "–"}</div></div></div>`;
      bindTip(el, `<b>${esc(r.maker)}</b><br>${esc(M.state)}: ${r.g ? `${num(r.g.mw)} MW, ${num(r.g.count)} units` : "none"}<br>` + (r.maker === "Cat or alternate" ? "Permit lets the site choose Cat or another maker.<br>Virginia counts its 'either' units inside Caterpillar." : `Virginia: ${pct(r.va)}`));
      hb.appendChild(el);
    });

    /* families */
    const lensLabel = Object.fromEntries(G.lens_defs.map((l) => [l.key, l.label]));
    sortableTable($(`#${k}-family-table`), [
      { key: "family", label: "Engine", html: (r) => `<span class="tag"><span class="swatch" style="background:${lensColor(r.lens)};${r.lens === "unknown" ? "outline:1px solid var(--line)" : ""}"></span>${["Not stated", "Cat or alternate"].includes(r.maker) ? "" : esc(r.maker) + " "}${esc(r.family)}</span>` },
      { key: "count", label: "Units", num: true, html: (r) => num(r.count) },
      { key: "mw", label: "MW", num: true, html: (r) => num(r.mw) },
      { key: "share", label: "Share", num: true, html: (r) => pct(r.share) },
    ], () => G.families.filter((f) => f.mw >= 5), {
      sortKey: "mw",
      after: (t, data) => t.querySelectorAll("tbody tr").forEach((tr, i) => {
        const f = data[i]; if (!f) return;
        bindTip(tr, `<b>${esc(f.maker)} ${esc(f.family)}</b><br>${esc(lensLabel[f.lens])}<br>${num(f.kw_min)}${f.kw_max !== f.kw_min ? "–" + num(f.kw_max) : ""} kW per unit · ${f.sites} site${f.sites > 1 ? "s" : ""}`);
      }),
    });

    /* prime power: one card per plant */
    const primeSites = G.sites.filter((s) => s.prime_power);
    $(`#${k}-prime`).innerHTML = primeSites.length ? primeSites.map((s) => {
      const rows = G.prime.filter((p) => p.site === s.id);
      return `<div class="prime">
        <h3 class="prime-name"><a href="${esc(s.doc_url)}" target="_blank" rel="noopener">${esc(s.name)}</a>${s.operator ? ` <span class="small muted">${esc(s.operator)}</span>` : ""}</h3>
        <div class="prime-stats">
          ${s.plant_mw ? `<div><div class="kpi-label">Plant output</div><div class="kpi-value">${num(s.plant_mw)} MW</div><div class="kpi-note">${esc(s.status || "permitted")}</div></div>` : ""}
          ${rows.filter((r) => r.duty === "prime").map((r) => `<div><div class="kpi-label">${esc(r.maker)}</div><div class="kpi-value">${num(r.count)}</div><div class="kpi-note">${esc(r.model || "")}${r.kw ? ` · ≈ ${num(r.kw / 1000, 1)} MW each` : ""}</div></div>`).join("")}
        </div>
        ${(s.prime_note || []).map((p) => `<p>${esc(p)}</p>`).join("")}
      </div>`;
    }).join("") + `<p class="small muted">Why it matters for Garrett: these engines run all year, so turbo wear and replacement scale with running hours, not with units installed. Gas reciprocating engines are turbocharged; gas turbines and fuel cells are not.</p>`
      : `<p class="muted">No prime-power permits in the sample.</p>`;

    /* gaps */
    $(`#${k}-gaps`).innerHTML = G.sites.filter((s) => s.gap).map((s) => `<li>
      <a class="gname" href="${esc(s.doc_url)}" target="_blank" rel="noopener">${esc(s.name)}</a>
      <span class="gcount">${s.no_units ? "not counted" : `${num(s.count)} units${s.unsized ? ", unsized" : ""}`}</span>
      <span class="gnote">${s.operator ? esc(s.operator) + ". " : ""}${esc(s.gap)}</span></li>`).join("");

    /* sites */
    const filterSel = $(`#${k}-site-filter`), search = $(`#${k}-site-search`);
    const recentRe = new RegExp("^(" + G.built.recent_years.join("|") + ")");
    const siteRows = () => {
      const f = filterSel.value, q = search.value.trim().toLowerCase();
      return sitesUnits.filter((s) => {
        if (f === "recent" && !recentRe.test(s.issued)) return false;
        if (f === "cat" && !s.makers.Caterpillar) return false;
        if (f === "gap" && !s.gap) return false;
        if (q && !`${s.name} ${s.operator || ""} ${s.county}`.toLowerCase().includes(q)) return false;
        return true;
      });
    };
    const lensOrder = G.lens_defs.map((l) => l.key);
    const drawSites = sortableTable($(`#${k}-site-table`), [
      { key: "name", label: "Site", html: (r) => `<a href="${esc(r.doc_url)}" target="_blank" rel="noopener">${esc(r.name)}</a>${r.operator && !r.name.toLowerCase().includes(r.operator.split(" ")[0].toLowerCase()) ? `<div class="small muted">${esc(r.operator)}</div>` : ""}` },
      { key: "county", label: "County" },
      { key: "issued", label: "Latest permit", html: (r) => `<span class="mono">${esc(r.issued)}</span>` },
      { key: "count", label: "Units", num: true, html: (r) => r.no_units ? `<span class="muted">n/a</span>` : num(r.count) },
      { key: "mw", label: "MW", num: true, html: (r) => r.mw ? num(r.mw) : `<span class="muted">–</span>` },
      { key: "max_kw", label: "Max kW/unit", num: true, html: (r) => r.max_kw ? num(r.max_kw) : `<span class="muted">–</span>` },
      { key: "cat", label: "Turbo lens", sort: (r) => r.mw ? (r.makers.Caterpillar || 0) / r.mw : -1,
        html: (r) => r.mw ? `<div class="mini" data-site="${esc(r.id)}">${lensOrder.filter((l) => r.lens[l]).map((l) => `<span style="flex:${r.lens[l]} 1 0;background:${lensColor(l)}"></span>`).join("")}</div>` : `<span class="small muted">${r.no_units ? "confidential / not listed" : "size not stated"}</span>` },
      { key: "permits", label: "Permits", num: true, html: (r) => num(r.permits) },
    ], siteRows, {
      sortKey: "mw",
      foot: (data) => `<tr><td colspan="3">${data.length} sites</td><td class="num">${num(data.reduce((a, r) => a + r.count, 0))}</td><td class="num">${num(data.reduce((a, r) => a + r.mw, 0))}</td><td colspan="3"></td></tr>`,
      after: (t, data) => t.querySelectorAll(".mini").forEach((el) => {
        const s = data.find((d) => d.id === el.dataset.site);
        bindTip(el, `<b>${esc(s.name)}</b><br>` + lensOrder.filter((l) => s.lens[l]).map((l) => `${esc(lensLabel[l])}: ${num(s.lens[l])} MW`).join("<br>"));
      }),
    });
    filterSel.addEventListener("change", drawSites);
    search.addEventListener("input", drawSites);

    /* units */
    const lensSel = $(`#${k}-unit-lens`);
    G.lens_defs.forEach((l) => lensSel.insertAdjacentHTML("beforeend", `<option value="${l.key}">${esc(l.label)}</option>`));
    const drawUnits = sortableTable($(`#${k}-unit-table`), [
      { key: "site_name", label: "Site" },
      { key: "maker", label: "Maker", html: (r) => `<span class="tag"><span class="swatch" style="background:${lensColor(r.lens)};${r.lens === "unknown" ? "outline:1px solid var(--line)" : ""}"></span>${esc(r.maker)}</span>` },
      { key: "model", label: "Model as permitted", html: (r) => (r.model ? `<span class="mono">${esc(r.model)}</span>` : `<span class="muted">not stated</span>`) + (r.note ? `<div class="small muted">${esc(r.note)}</div>` : "") },
      { key: "count", label: "Units", num: true, html: (r) => num(r.count) },
      { key: "kw", label: "kW each", num: true, html: (r) => r.kw ? num(r.kw) + (r.kw_basis.startsWith("est") ? `<div class="small muted">${esc(r.kw_basis)}</div>` : "") : `<span class="muted">–</span>` },
      { key: "mw", label: "MW", num: true, html: (r) => r.mw != null ? num(r.mw, 1) : `<span class="muted">–</span>` },
      { key: "year", label: "Permitted", html: (r) => `<span class="mono">${esc(r.year)}</span>` },
      { key: "page", label: "Source", html: (r) => `<a href="${esc(r.doc_url)}${r.page ? "#page=" + r.page : ""}" target="_blank" rel="noopener" class="mono">${esc(r.doc)}${r.page ? " p." + r.page : ""}</a>` },
    ], () => G.units.filter((u) => lensSel.value === "all" || u.lens === lensSel.value), {
      sortKey: "mw",
      foot: (data) => `<tr><td colspan="3">${data.length} rows</td><td class="num">${num(data.reduce((a, r) => a + r.count, 0))}</td><td></td><td class="num">${num(data.reduce((a, r) => a + (r.mw || 0), 0))}</td><td colspan="2"></td></tr>`,
    });
    lensSel.addEventListener("change", drawUnits);

    $(`#${k}-source`).innerHTML =
      `Source: <a href="${esc(G.built.source)}" target="_blank" rel="noopener">${esc(M.source_name)}</a>. ${esc(M.method)} ` +
      (S.mw_estimated ? `${num(S.mw_estimated)} MW of the total uses an estimated unit size (flagged on each row). ` : "") +
      `Rows where the permit allows two engines are shown at the larger size. In Virginia's maker shares, "either" units count as Caterpillar. ${esc(M.caveats || "")} ` +
      `Rebuild with <code>${esc(M.rebuild)}</code>.`;
  }

  /* ---------- shared turbo-share model (used by the Garrett turbo share tab and the share-model tab) ---------- */
  const MAKER_NOTE = () => (D.shareModel ? D.shareModel.rows : []);
  /* Map a permit maker mix onto the research note's maker rows. "Cat or alternate" units (the permit allows Cat or a
     named alternate) go half to Cat and a quarter each to Cummins and MTU, the alternates those permits name. */
  function permitMixMap(m) {
    const e = m["Cat or alternate"] || 0;
    return { "Caterpillar": (m["Caterpillar"] || 0) + e / 2, "Weichai / Baudouin": m["Baudouin (Weichai)"] || 0,
      "Rehlko (Liebherr-built)": m["Kohler / Rehlko"] || 0, "Others (Volvo Penta, Perkins, Doosan, Yuchai)": m["Other"] || 0,
      "Cummins": (m["Cummins"] || 0) + e / 4, "MTU (Rolls-Royce)": (m["MTU"] || 0) + e / 4, "Mitsubishi": 0 };
  }
  function makerMix(kind) {
    const C = D.consolidated;
    if (kind === "global" || !C) return Object.fromEntries(MAKER_NOTE().map((r) => [r.maker, r.mkt]));
    return permitMixMap(kind === "us_all" ? C.total.makers : C.total.makers_recent);
  }
  /* Garrett share of Cat genset turbos: MW-weighted over Cat engine groups. Groups with no evidence (and no override)
     are left out, i.e. assumed to follow the mix of the known groups. */
  function catGarrett(which, overrides = {}) {
    const T = D.turbo; let g = 0, k = 0;
    T.buckets.forEach((b) => {
      const mw = which === "all" ? b.mw_all : b.mw_recent;
      const ev = which === "all" ? b.garrett_all : b.garrett_recent;
      const v = overrides[b.bucket] != null ? overrides[b.bucket] : ev;
      if (v == null) return;
      g += mw * v; k += mw;
    });
    return k ? g / k : 0;
  }
  function totalGarrett(mixKind, catShare, makerOverrides = {}, mixOverrides = null) {
    const mix = mixOverrides || makerMix(mixKind);
    return MAKER_NOTE().reduce((a, r) => {
      const gs = r.maker === "Caterpillar" ? catShare : (makerOverrides[r.maker] != null ? makerOverrides[r.maker] : (r.captive ? 0 : r.gtx));
      return a + (mix[r.maker] || 0) * gs;
    }, 0);
  }
  const MAKER_COLOR = { "Garrett": "var(--red-800)", "Accelleron": "var(--grey-500)", "BorgWarner": "var(--grey-300)", "No data sheet": "var(--lens-unknown)" };
  const makerPill = (m) => m.split(" + ").map((x) => `<span class="pill ${x === "Garrett" ? "yes" : ""}">${esc(x)}</span>`).join(" ");

  /* ---------- Garrett turbo share tab ---------- */
  function renderTurbo() {
    const T = D.turbo, C = D.consolidated;
    if (!T || !C || !D.shareModel) { $("#tab-turbo").insertAdjacentHTML("beforeend", "<p>Data files missing. Run scripts/build_turbo_tab.py.</p>"); return; }
    const B = Object.fromEntries(T.buckets.map((b) => [b.bucket, b]));
    const catRec = catGarrett("recent"), catAll = catGarrett("all");
    const totRec = totalGarrett("us_recent", catRec), totAll = totalGarrett("us_all", catAll);
    const catRecMW = T.buckets.reduce((a, b) => a + b.mw_recent, 0), catAllMW = T.buckets.reduce((a, b) => a + b.mw_all, 0);
    const knownRec = T.buckets.filter((b) => b.garrett_recent != null).reduce((a, b) => a + b.mw_recent, 0);
    const e30 = B["3516E 3,000 ekW"] || { mw_recent: 0, mw_all: 0 }, e275 = B["3516E 2,750 ekW"] || { mw_recent: 0, mw_all: 0 };
    const R = Object.fromEntries(T.ratings.map((r) => [r.perf_no, r]));
    const sheetsOf = (pred) => T.sheets.filter(pred);
    const sitesOf = (rows) => [...new Set(rows.map((s) => s.site))];
    const ePerf = (maker) => T.ratings.filter((r) => r.engine === "3516E" && r.maker === maker);
    const eG = ePerf("Garrett"), eA = ePerf("Accelleron");
    const eGs = sheetsOf((s) => s.engine === "3516E" && s.maker === "Garrett"), eAs = sheetsOf((s) => s.engine === "3516E" && s.maker === "Accelleron");
    const others = sheetsOf((s) => ["C175-16", "C175-20", "3516C", "3512C"].includes(s.engine));
    const othersG = others.filter((s) => s.maker === "Garrett");
    const dual = T.ratings.filter((r) => r.dual);
    const mixRec = makerMix("us_recent");
    const N = MAKER_NOTE();
    const noteCat = (N.find((r) => r.maker === "Caterpillar") || {}).gtx || 0;
    const head = D.shareModel.headline || {};

    /* KPIs */
    $("#tb-kpis").innerHTML = [
      ["Garrett share of Cat genset turbos", pct(catRec, 0), `Cat MW first permitted 2025–26, where the rating is known. All permitted units: ${pct(catAll, 0)}`, true],
      ["Garrett share of all US data-centre genset turbos", pct(totRec, 0), `2025–26 engine maker mix. All units: ${pct(totAll, 0)}. Research note (global): ${pct(head.point || 0, 0)}`, true],
      ["2025–26 Cat MW on the Accelleron-turbo 3516E rating", pct(e30.mw_recent / (catRecMW || 1), 0), `3516E at 3,000 ekW; ${pct(e30.mw_all / (catAllMW || 1), 0)} of all permitted Cat MW`],
      ["Data sheets that name the turbo", num(T.corpus.sheets), `${num(T.corpus.documents)} documents · ${num(T.corpus.sites)} sites · ${T.corpus.states.join(", ")}`],
    ].map(([l, v, n, a]) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value ${a ? "accent" : ""}">${v}</div><div class="kpi-note">${n}</div></div>`).join("");

    /* findings (data only) */
    const list = (a) => a.length <= 3 ? a.join(", ") : `${a.slice(0, 3).join(", ")} and ${a.length - 3} more`;
    $("#tb-findings").innerHTML = [
      `<b>Every data sheet found for the Cat C175-16, C175-20, 3516C and 3512C names a Garrett turbocharger</b>: ${num(othersG.length)} of ${num(others.length)} sheets, from ${num(sitesOf(othersG).length)} sites.`,
      `<b>For the Cat 3516E, the turbo depends on the rating.</b> The 2,750 ekW rating (${eG.map((r) => r.perf_no).join(", ")}) names a Garrett GTB6051 on ${num(eGs.length)} sheets at ${num(sitesOf(eGs).length)} sites (${esc(list(sitesOf(eGs)))}). The 3,000 ekW ratings (${eA.map((r) => r.perf_no).join(", ")}) name an Accelleron TPX44 on ${num(eAs.length)} sheets at ${num(sitesOf(eAs).length)} sites (${esc(list(sitesOf(eAs)))}).`,
      dual.length ? `<b>${dual.length} rating(s) show more than one turbo maker</b>: ${dual.map((r) => r.perf_no).join(", ")}.` : `<b>No rating shows two turbo makers.</b> Across ${num(T.corpus.sheets)} sheets, every Cat performance number maps to a single turbocharger maker.`,
      `<b>In the five complete state permit sets, the 3,000 ekW 3516E is ${pct(e30.mw_recent / (catRecMW || 1), 0)} of Cat generator MW first permitted in 2025–26</b> (${pct(e30.mw_all / (catAllMW || 1), 0)} of all permitted Cat MW). The 2,750 ekW 3516E is ${pct(e275.mw_recent / (catRecMW || 1), 0)} (${pct(e275.mw_all / (catAllMW || 1), 0)} of all).`,
      `<b>Garrett's share of Cat genset turbos is ${pct(catRec, 0)} on 2025–26 units and ${pct(catAll, 0)} on all permitted units</b>, weighting each rating by its permitted MW. The research note assumed ${pct(noteCat, 1)}.`,
      `<b>Across all engine makers, Garrett's share of US data-centre genset turbos is ${pct(totRec, 0)} on the 2025–26 maker mix</b> and ${pct(totAll, 0)} on all units. Cummins and MTU, ${pct((mixRec["Cummins"] || 0) + (mixRec["MTU (Rolls-Royce)"] || 0), 0)} of 2025–26 MW, build their own turbos; the remaining non-Cat makers use the research note's estimates.`,
      `<b>Every Amazon filing in this set specifies the 3516E at 2,750 kW</b>: Missouri (476 units), Maryland (92 + 92), Indiana (permit emission basis for 234 to 640 units per source) and Texas (EFD100, LBB120).`,
    ].map((x) => `<li>${x}</li>`).join("");

    /* method */
    const C5 = C.total;
    $("#tb-method").innerHTML = [
      ["Count the generators", `Every data-centre backup generator needs an air permit that lists its engine maker, model and size. For Virginia, Georgia, Ohio, Texas and Arizona, every data-centre permit we could find was turned into a generator table: <b>${num(C5.units)} generators, ${num(C5.mw / 1000, 1)} GW</b>. These five full sets give the MW weights.`, "State permits tab"],
      ["Engine maker share", `Share of generator MW by engine maker, where the permit names the maker. For units first permitted in 2025–26: Caterpillar ${pct(C5.makers_recent["Caterpillar"] || 0, 0)}, Cat or a named alternate ${pct(C5.makers_recent["Cat or alternate"] || 0, 0)}, Cummins ${pct(C5.makers_recent["Cummins"] || 0, 0)}, MTU ${pct(C5.makers_recent["MTU"] || 0, 0)}, Rehlko ${pct(C5.makers_recent["Kohler / Rehlko"] || 0, 0)}, others ${pct(C5.makers_recent["Other"] || 0, 0)}.`, "Step 6 table"],
      ["Which Cat engine and rating", `Permits give the Cat model and rated kW, e.g. "3516E, 2,750 kW". Cat publishes a data sheet for each exact rating, identified by a <b>performance number</b> (e.g. EM5402 = 3516E at 2,750 ekW).`, "Step 5 table"],
      ["Which turbocharger each rating uses", `Many permit applications attach the Cat data sheet, which has a <b>"TURBOCHARGER MODEL"</b> line. We read every page of ${num(T.docs.reduce((a, d) => a + d.docs, 0))} documents (scanned pages by OCR) and found <b>${num(T.corpus.sheets)} sheets that name the turbo</b>. The part prefix gives the maker: GT / GTA / GTB = Garrett, TPX = Accelleron, S300-series = BorgWarner.`, "Step 4 table and audit trail"],
      ["Garrett share of Cat turbos", `Each Cat engine group in the permits gets the turbo maker found on its rating's data sheet. A rating never seen on a sheet takes the maker(s) found for the same engine, split evenly when there are two. Cat MW whose permit gives no model is left out, i.e. assumed to follow the same mix.`, "Step 5 table"],
      ["Garrett share of the whole market", `Each engine maker's share of MW × Garrett's share of that maker's turbos, summed. Cummins and MTU make their own turbochargers, so they count as 0%. Weichai/Baudouin, Rehlko and other makers do not file data sheets here, so they use the research note's estimates.`, "Step 6 table and calculator"],
    ].map(([h, t, w], i) => `<li><div class="method-n">${i + 1}</div><div><h3>${h}</h3><p>${t}</p><p class="small muted">Shown in: ${w}</p></div></li>`).join("");

    const contrib = T.buckets.filter((b) => b.garrett_recent != null && b.mw_recent > 0);
    const gMW = contrib.reduce((a, b) => a + b.mw_recent * b.garrett_recent, 0);
    const catMix = mixRec["Caterpillar"] || 0;
    $("#tb-formula").innerHTML = `
      <div class="formula-row"><span class="formula-k">Garrett share of Cat turbos</span><span>= Σ (Cat MW on each rating × Garrett share of that rating's turbos) ÷ Cat MW with a known rating</span></div>
      <div class="formula-row ex"><span class="formula-k">2025–26 worked example</span><span>${contrib.map((b) => `${esc(b.bucket)} ${num(b.mw_recent)} MW × ${pct(b.garrett_recent, 0)}`).join(" + ")} = ${num(gMW)} MW ÷ ${num(knownRec)} MW = <b>${pct(catRec, 1)}</b></span></div>
      <div class="formula-row"><span class="formula-k">Garrett share of all genset turbos</span><span>= Σ over engine makers (maker's share of MW × Garrett share of that maker's turbos)</span></div>
      <div class="formula-row ex"><span class="formula-k">2025–26 worked example</span><span>${N.filter((r) => (mixRec[r.maker] || 0) > 0.0005).map((r) => `${esc(r.maker.split(" (")[0])} ${pct(mixRec[r.maker] || 0, 1)} × ${pct(r.maker === "Caterpillar" ? catRec : (r.captive ? 0 : r.gtx), 0)}`).join(" + ")} = <b>${pct(totRec, 1)}</b></span></div>`;

    /* ratings table */
    sortableTable($("#tb-ratings"), [
      { key: "engine", label: "Cat engine", html: (r) => `<strong>${esc(r.engine)}</strong>` },
      { key: "perf_no", label: "Rating (perf. no.)", html: (r) => `<span class="mono">${esc(r.perf_no)}</span>` },
      { key: "ekw", label: "ekW", num: true, sort: (r) => (r.ekw || [])[0] || 0, html: (r) => r.ekw && r.ekw.length ? r.ekw.map((x) => num(x)).join(" / ") : `<span class="muted">–</span>` },
      { key: "turbos", label: "Turbo part on sheet", html: (r) => `<span class="mono small">${r.turbos.map(esc).join("<br>")}</span>` },
      { key: "maker", label: "Turbo maker", html: (r) => makerPill(r.maker) },
      { key: "sheets", label: "Sheets", num: true, html: (r) => num(r.sheets) },
      { key: "sites", label: "Sites with a sheet", sort: (r) => r.sites.length, html: (r) => `<span class="small">${esc(r.sites.join("; "))}</span>` },
    ], () => T.ratings.filter((r) => r.engine !== "Cat (model not on sheet)"), { sortKey: "engine", dir: 1 });
    const older = T.ratings.filter((r) => r.engine === "Cat (model not on sheet)");
    $("#tb-ratings-note").innerHTML = `<b>How to read the part numbers:</b> GTB6051, GTB6251, GTB6772, GT6041, GTA5518 and GT5733 are Garrett frames. TPX44 is Accelleron's TPX high-speed turbocharger (sources: ${T.tpx_sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label.split(":")[0])}</a>`).join(", ")}). S310 is BorgWarner's S300 series.` +
      (older.length ? ` ${older.length} older sheets (${older.map((r) => r.perf_no).join(", ")}) name Garrett TV-series turbos (BTV7510, BTV8501) without the engine model and are left out of this table.` : "");

    /* MW by turbo maker */
    const makerMW = (which) => {
      const out = { "Garrett": 0, "Accelleron": 0, "BorgWarner": 0, "No data sheet": 0 };
      T.groups.forEach((g) => {
        const mw = which === "all" ? g.mw_all : g.mw_recent;
        if (!g.makers.length) { out["No data sheet"] += mw; return; }
        g.makers.forEach((m) => { out[m] = (out[m] || 0) + mw / g.makers.length; });
      });
      return out;
    };
    const bars = $("#tb-mw-bars"); bars.innerHTML = "";
    [["2025–26", "recent", catRecMW], ["All permitted", "all", catAllMW]].forEach(([lab, w, tot]) => {
      const m = makerMW(w);
      stackRow(bars, `${lab} Cat MW`, ` ${num(tot)} MW`, Object.entries(m).map(([k, v]) => ({ label: k, value: v, color: MAKER_COLOR[k] || "var(--grey-300)" })),
        (p, sh) => `<b>${esc(p.label)}</b><br>${num(p.value)} MW · ${pct(sh)}`);
    });
    $("#tb-mw-legend").innerHTML = Object.entries(MAKER_COLOR).map(([k, c]) => `<div class="legend-item"><span class="swatch" style="background:${c}"></span><div><div class="lname">${esc(k)}</div><div class="lnote">${k === "No data sheet" ? "Cat MW whose permit gives no engine model, or a model with no sheet" : k === "Garrett" ? "Ratings whose data sheets name a Garrett turbo" : `Ratings whose data sheets name a ${k} turbo`}</div></div><span class="lval"></span></div>`).join("");
    const drawGroups = () => {
      const mode = $("#tb-groups-toggle").value;
      if (mode === "buckets") {
        sortableTable($("#tb-buckets"), [
          { key: "bucket", label: "Cat engine group", html: (r) => `<strong>${esc(r.bucket)}</strong>` },
          { key: "mw_recent", label: "2025–26 MW", num: true, html: (r) => num(r.mw_recent) },
          { key: "sh_r", label: "Share of 2025–26 Cat MW", num: true, sort: (r) => r.mw_recent, html: (r) => pct(r.mw_recent / (catRecMW || 1), 0) },
          { key: "mw_all", label: "All MW", num: true, html: (r) => num(r.mw_all) },
          { key: "makers", label: "Turbo maker(s)", html: (r) => r.makers.length ? makerPill(r.makers.join(" + ")) : `<span class="muted">no data sheet</span>` },
          { key: "garrett_recent", label: "Garrett share used (2025–26 / all)", num: true, sort: (r) => r.garrett_recent == null ? -1 : r.garrett_recent,
            html: (r) => r.garrett_recent == null && r.garrett_all == null ? `<span class="muted">left out</span>` : `${r.garrett_recent == null ? "–" : pct(r.garrett_recent, 0)} / ${r.garrett_all == null ? "–" : pct(r.garrett_all, 0)}` },
        ], () => T.buckets, { sortKey: "mw_recent" });
      } else {
        sortableTable($("#tb-buckets"), [
          { key: "engine", label: "Engine", html: (r) => `<strong>${esc(r.engine)}</strong>` },
          { key: "ekw", label: "kW in permit", num: true, html: (r) => r.ekw ? num(r.ekw) : `<span class="muted">–</span>` },
          { key: "units", label: "Units", num: true, html: (r) => num(r.units) },
          { key: "mw_recent", label: "2025–26 MW", num: true, html: (r) => num(r.mw_recent) },
          { key: "mw_all", label: "All MW", num: true, html: (r) => num(r.mw_all) },
          { key: "perf_nos", label: "Matched ratings", html: (r) => `<span class="mono small">${esc(r.perf_nos.join(", ")) || "–"}</span>` },
          { key: "makers", label: "Turbo maker(s)", html: (r) => r.makers.length ? makerPill(r.makers.join(" + ")) : `<span class="muted">–</span>` },
          { key: "match", label: "Matched on", html: (r) => `<span class="small">${esc(r.match)}</span>` },
        ], () => T.groups.filter((g) => g.mw_all >= 1), { sortKey: "mw_recent" });
      }
    };
    $("#tb-groups-toggle").addEventListener("change", drawGroups);
    drawGroups();

    /* step 6 build-up */
    const drawBuild = () => {
      const kind = $("#tb-mix").value, which = kind === "us_all" ? "all" : "recent";
      const mix = makerMix(kind), cg = catGarrett(which);
      const rows = N.map((r) => {
        const gs = r.maker === "Caterpillar" ? cg : (r.captive ? 0 : r.gtx);
        const src = r.maker === "Caterpillar" ? `Data sheets in filings (Step 5, ${which === "all" ? "all units" : "2025–26 units"})` : r.captive ? "Builds its own turbochargers" : "Research note estimate";
        return { maker: r.maker, mkt: mix[r.maker] || 0, gs, src, c: (mix[r.maker] || 0) * gs };
      });
      const tot = rows.reduce((a, r) => a + r.c, 0), totM = rows.reduce((a, r) => a + r.mkt, 0);
      $("#tb-build").innerHTML = `<thead><tr><th scope="col">Engine maker</th><th scope="col" class="num">Share of genset MW</th><th scope="col" class="num">× Garrett share of its turbos</th><th scope="col" class="num">= Garrett share of market</th><th scope="col">Where the Garrett share comes from</th></tr></thead><tbody>` +
        rows.map((r) => `<tr><td><strong>${esc(r.maker)}</strong></td><td class="num">${pct(r.mkt, 1)}</td><td class="num">${pct(r.gs, 0)}</td><td class="num mono">${pct(r.c, 1)}</td><td class="small">${esc(r.src)}</td></tr>`).join("") +
        `</tbody><tfoot><tr><td>Total</td><td class="num">${pct(totM, 0)}</td><td></td><td class="num mono">${pct(tot, 1)}</td><td></td></tr></tfoot>`;
      $("#tb-build-note").innerHTML = kind === "global"
        ? `The research note's global maker mix (Cat ${pct(mix["Caterpillar"] || 0, 1)}, Weichai/Baudouin ${pct(mix["Weichai / Baudouin"] || 0, 1)}) with the filings-based Cat share gives ${pct(tot, 0)}, against the note's own ${pct(head.point || 0, 0)}.`
        : `US maker mix from the five complete state permit sets, maker-named MW only. Permits that allow "Cat or alternate" are split half to Cat and a quarter each to Cummins and MTU.`;
    };
    $("#tb-mix").addEventListener("change", drawBuild);
    drawBuild();

    /* calculator */
    let custom = false, catOv = {}, mkOv = {}, mixOv = null;
    const evid = (b, which) => which === "all" ? b.garrett_all : b.garrett_recent;
    const drawCalc = () => {
      const kind = $("#tb-calc-mix").value, which = kind === "us_all" ? "all" : "recent";
      const mix = mixOv || makerMix(kind);
      const dis = custom ? "" : "disabled";
      $("#tb-calc-cat").innerHTML = `<thead><tr><th scope="col">Cat engine group</th><th scope="col" class="num">${which === "all" ? "All" : "2025–26"} MW</th><th scope="col" class="num">Garrett share</th></tr></thead><tbody>` +
        T.buckets.map((b, i) => {
          const ev = evid(b, which), v = catOv[b.bucket] != null ? catOv[b.bucket] : ev;
          return `<tr><td>${esc(b.bucket)}</td><td class="num">${num(which === "all" ? b.mw_all : b.mw_recent)}</td><td class="num"><input type="number" min="0" max="100" step="5" data-cat="${esc(b.bucket)}" aria-label="Garrett share, ${esc(b.bucket)}" ${dis} value="${v == null ? "" : +(v * 100).toFixed(1)}" placeholder="excl."> %</td></tr>`;
        }).join("") + `</tbody>`;
      const cg = catGarrett(which, catOv);
      $("#tb-calc-makers").innerHTML = `<thead><tr><th scope="col">Engine maker</th><th scope="col" class="num">Share of MW</th><th scope="col" class="num">Garrett share</th></tr></thead><tbody>` +
        N.map((r) => {
          const gs = r.maker === "Caterpillar" ? null : (mkOv[r.maker] != null ? mkOv[r.maker] : (r.captive ? 0 : r.gtx));
          return `<tr><td>${esc(r.maker)}</td><td class="num"><input type="number" min="0" max="100" step="0.5" data-mix="${esc(r.maker)}" aria-label="${esc(r.maker)} share of MW" ${dis} value="${+((mix[r.maker] || 0) * 100).toFixed(1)}"> %</td>` +
            `<td class="num">${r.maker === "Caterpillar" ? `<span class="mono">${pct(cg, 0)}</span> <span class="small muted">from left</span>` : `<input type="number" min="0" max="100" step="2.5" data-mk="${esc(r.maker)}" aria-label="Garrett share of ${esc(r.maker)} turbos" ${dis} value="${+(gs * 100).toFixed(1)}"> %`}</td></tr>`;
        }).join("") + `</tbody>`;
      const totMix = Object.values(mix).reduce((a, v) => a + v, 0);
      const tot = totalGarrett(kind, cg, mkOv, mix);
      $("#tb-calc-out").innerHTML = [
        ["Garrett share of Cat genset turbos", pct(cg, 0), custom ? "your inputs" : "evidence", true],
        ["Garrett share of all data-centre genset turbos", pct(tot, 0), Math.abs(totMix - 1) > 0.005 ? `maker shares add to ${pct(totMix, 0)}, not 100%` : (custom ? "your inputs" : "evidence + research-note estimates for non-Cat makers"), true],
        ["Research note, for comparison", pct(head.point || 0, 0), `global; range ${pct(head.low || 0, 0)}–${pct(head.high || 0, 0)}`],
      ].map(([l, v, n, a]) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value ${a ? "accent" : ""}">${v}</div><div class="kpi-note">${esc(n)}</div></div>`).join("");
      $("#tb-calc-panel").querySelectorAll("input").forEach((inp) => inp.addEventListener("change", () => {
        const raw = inp.value.trim(), v = raw === "" ? null : Math.max(0, Math.min(100, parseFloat(raw))) / 100;
        if (inp.dataset.cat) catOv[inp.dataset.cat] = v;
        if (inp.dataset.mk) mkOv[inp.dataset.mk] = v == null ? 0 : v;
        if (inp.dataset.mix) { mixOv = mixOv || { ...makerMix($("#tb-calc-mix").value) }; mixOv[inp.dataset.mix] = v || 0; }
        drawCalc();
      }));
    };
    const setMode = (c) => {
      custom = c;
      if (!c) { catOv = {}; mkOv = {}; mixOv = null; }
      $("#tb-mode-evidence").setAttribute("aria-pressed", String(!c)); $("#tb-mode-custom").setAttribute("aria-pressed", String(c));
      $("#tb-mode-evidence").className = c ? "btn ghost" : "btn"; $("#tb-mode-custom").className = c ? "btn" : "btn ghost";
      drawCalc();
    };
    $("#tb-mode-evidence").addEventListener("click", () => setMode(false));
    $("#tb-mode-custom").addEventListener("click", () => setMode(true));
    $("#tb-calc-mix").addEventListener("change", () => { mixOv = null; drawCalc(); });
    drawCalc();

    /* audit table */
    const fill = (id, vals) => { $(id).insertAdjacentHTML("beforeend", vals.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("")); };
    fill("#tb-f-state", [...new Set(T.sheets.map((s) => s.state))].sort());
    fill("#tb-f-maker", [...new Set(T.sheets.map((s) => s.maker))].sort());
    fill("#tb-f-engine", [...new Set(T.sheets.map((s) => s.engine))].sort());
    const filt = () => {
      const st = $("#tb-f-state").value, mk = $("#tb-f-maker").value, en = $("#tb-f-engine").value, q = $("#tb-f-search").value.trim().toLowerCase();
      return T.sheets.filter((s) => (st === "all" || s.state === st) && (mk === "all" || s.maker === mk) && (en === "all" || s.engine === en) &&
        (!q || [s.site, s.operator, s.perf_no, s.turbo, s.doc, s.engine].join(" ").toLowerCase().includes(q)));
    };
    const draw = sortableTable($("#tb-sheets"), sheetCols(), filt, { sortKey: "engine", dir: 1, after: (t, d) => { $("#tb-sheets-count").textContent = `${num(d.length)} of ${num(T.sheets.length)} sheets`; } });
    ["#tb-f-state", "#tb-f-maker", "#tb-f-engine"].forEach((id) => $(id).addEventListener("change", draw));
    $("#tb-f-search").addEventListener("input", draw);

    /* coverage + caveats */
    $("#tb-docs").innerHTML = `<thead><tr><th scope="col">Source</th><th scope="col" class="num">Documents</th><th scope="col" class="num">Sheets</th></tr></thead><tbody>` +
      T.docs.map((d) => `<tr><td><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.source)}</a></td><td class="num">${num(d.docs)}</td><td class="num">${num(d.sheets)}</td></tr>`).join("") +
      `</tbody><tfoot><tr><td>Total</td><td class="num">${num(T.docs.reduce((a, d) => a + d.docs, 0))}</td><td class="num">${num(T.docs.reduce((a, d) => a + d.sheets, 0))}</td></tr></tfoot>`;
    const unk = B["Cat, model not stated"] || { mw_recent: 0 };
    const dates = T.sheets.map((s) => s.sheet_date).filter(Boolean).map((d) => +d.slice(-4)).sort();
    $("#tb-caveats").innerHTML = [
      `A data sheet shows the turbo fitted to that rating when the sheet was issued (sheet dates in this set run ${dates[0]}–${dates[dates.length - 1]}). Later production could change supplier.`,
      `Only Cat filings name turbochargers here. Cummins and MTU build their own turbochargers, so they count as 0% for Garrett.`,
      `MW weights come from the five complete state permit sets. ${pct(unk.mw_recent / (catRecMW || 1), 0)} of 2025–26 Cat MW has no engine model in its permit and is assumed to follow the same mix.`,
      `Ratings never seen on a sheet (for example 3516E at 3,100 kW) take the maker found for the same engine; for the 3516E, which has two makers, the split is 50/50.`,
      `Garrett's share of Weichai/Baudouin, Rehlko and other non-Cat makers' turbos is the research note's estimate, not from filings.`,
      `Virginia, Georgia and Ohio post permits rather than full applications, so they contribute MW weights but no data sheets.`,
      `OCR can misread characters: one sheet reads "TAS0" for "TA80" in the TPX44 part number.`,
    ].map((x) => `<li>${x}</li>`).join("");
    $("#tb-source").innerHTML = `Sources: air-permit filings listed in the audit table and on the State permits tab; Accelleron TPX product information (${T.tpx_sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join("; ")}); non-Cat Garrett shares from the research note <code>garrett_dc_genset_turbo_share.md</code>. ` +
      `Rebuild: <code>scripts/turbo_scan.py</code> → <code>scripts/turbo_share.py</code> → <code>scripts/build_turbo_tab.py</code> (build timing: <code>scripts/build_timing.py</code>). Data as of ${esc(T.asOf)}.`;
    renderTiming();
  }

  /* ---------- Build timing panel (landing tab) ---------- */
  function renderTiming() {
    const M = D.timing;
    if (!M) { $("#tm-panel").hidden = true; return; }
    const ym = (s) => { const [y, m] = s.split("-").map(Number); return y + (m - 1) / 12; };
    const mon = (s) => s ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" }) : "";
    const W = M.cohort.with_swing, WO = M.cohort.without_swing, SW = M.cohort.swing;
    const yr = Object.fromEntries(M.by_year.map((r) => [r.year, r]));
    const y26 = yr["2026"], prior = ["2023", "2024"].map((y) => yr[y]).filter(Boolean);
    const priorAvg = prior.reduce((a, r) => a + r.mw, 0) / (prior.length || 1);
    const rows = M.schedules;
    const endOf = (r) => r.tail_to || r.end || r.start;
    const byEnd = rows.filter((r) => r.end).map((r) => r.end).sort();
    const within29 = rows.filter((r) => r.end && r.end <= "2029-12").length;
    const longest = rows.filter((r) => endOf(r) > "2029-12");

    $("#tm-kpis").innerHTML = [
      ["MW first permitted in 2026", `${num(y26.mw / 1000, 1)} GW`, `vs ${num(priorAvg / 1000, 1)} GW a year in 2023–24 (five states)`],
      ["Stated schedules reach", `${byEnd[0].slice(0, 4)}–${byEnd.filter((e) => e <= "2029-12").pop().slice(0, 4)}`, `${within29} of ${rows.filter((r) => r.end).length} dated filings end by 2029; ${longest.map((r) => `${r.site.split(" (")[0]} runs to ${endOf(r).slice(0, 4)}`).join("; ")}`],
      ["Garrett share of 2026-cohort Cat turbos", pct(W.garrett_of_cat_known, 0), `${pct(WO.garrett_of_cat_known, 0)} without ${SW ? esc(SW.site.split(" (")[0]) : "the largest project"}`, true],
      ["Garrett share of 2026-cohort genset MW", `${pct(W.garrett_of_named_low, 0)}–${pct(W.garrett_of_named_mid, 0)}`, `maker-named MW, five states; ${pct(WO.garrett_of_named_low, 0)}–${pct(WO.garrett_of_named_mid, 0)} without ${SW ? esc(SW.site.split(" (")[0]) : "it"}`, true],
    ].map(([l, v, n, a]) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value ${a ? "accent" : ""}">${v}</div><div class="kpi-note">${n}</div></div>`).join("");

    /* MW by year first permitted */
    const SEG = [
      ["Garrett", "Cat, Garrett turbo on data sheet", MAKER_COLOR["Garrett"]],
      ["Mixed match", "Cat, engine matches two turbo makers (split 50/50)", "var(--red-300)"],
      ["Accelleron", "Cat, Accelleron turbo on data sheet", MAKER_COLOR["Accelleron"]],
      ["No data sheet", "Cat, no data sheet for the rating", MAKER_COLOR["No data sheet"]],
      ["_other", "Other engine makers (Cummins, MTU, Kohler…)", "var(--grey-300)"],
      ["_unnamed", "Permit does not name the maker", null],
    ];
    const parts = (r) => {
      const c = r.cat || {}, p = {};
      SEG.forEach(([k]) => { p[k] = c[k] || 0; });
      p["_other"] = Math.max(0, r.named_mw - r.cat_mw);
      p["_unnamed"] = Math.max(0, r.mw - r.named_mw);
      return p;
    };
    const maxMW = Math.max(...M.by_year.map((r) => r.mw));
    $("#tm-years").innerHTML = "";
    M.by_year.forEach((r) => {
      const p = parts(r), row = document.createElement("div");
      row.className = "yearbar";
      row.innerHTML = `<div class="yearbar-y ${r.year === "2026" ? "now" : ""}">${esc(r.year)}</div><div class="yearbar-track"><div class="yearbar-fill" style="width:${(r.mw / maxMW) * 100}%"></div></div><div class="yearbar-v">${num(r.mw)} MW${r.garrett_of_cat_known != null ? `<br><span class="muted">Garrett ${pct(r.garrett_of_cat_known, 0)} of Cat</span>` : ""}</div>`;
      const fill = row.querySelector(".yearbar-fill");
      SEG.forEach(([k, lab, col]) => {
        if (p[k] < 1) return;
        const s = document.createElement("span");
        s.style.flex = `${p[k]} 1 0`;
        if (col) s.style.background = col; else s.className = "seg-unnamed";
        bindTip(s, `<b>${esc(r.year)}: ${esc(lab)}</b><br>${num(p[k])} MW · ${pct(p[k] / r.mw)} of the year`);
        fill.appendChild(s);
      });
      bindTip(row.querySelector(".yearbar-y"), `<b>First permitted ${esc(r.year)}</b><br>` + Object.entries(r.by_state).map(([s, v]) => `${s} ${num(v)} MW`).join(" · "));
      $("#tm-years").appendChild(row);
    });
    $("#tm-years-legend").innerHTML = SEG.map(([k, lab, col]) => `<span><i class="swatch ${col ? "" : "seg-unnamed"}" ${col ? `style="background:${col}"` : ""}></i>${esc(lab)}</span>`).join("");

    /* Gantt of stated schedules */
    const A0 = 2024, A1 = 2031, span = A1 - A0;
    const x = (v) => Math.max(0, Math.min(100, ((v - A0) / span) * 100));
    const now = new Date(), nowV = now.getFullYear() + now.getMonth() / 12;
    const colOf = (t) => t === "Garrett" ? MAKER_COLOR["Garrett"] : t === "Accelleron" ? MAKER_COLOR["Accelleron"] : /^(Unknown|None)/.test(t || "Unknown") ? "var(--lens-unknown)" : "var(--grey-300)";
    const barBg = (r) => {
      const tm = r.turbo_mw && Object.keys(r.turbo_mw).length ? r.turbo_mw : { [r.turbo || "Unknown"]: 1 };
      const tot = Object.values(tm).reduce((a, v) => a + v, 0) || 1;
      let acc = 0;
      const stops = Object.entries(tm).map(([k, v]) => { const a = (acc / tot) * 100; acc += v; return `${colOf(k)} ${a}% ${(acc / tot) * 100}%`; });
      const only = Object.keys(tm)[0];
      if (stops.length === 1 && /^(Unknown|None)/.test(only)) return "repeating-linear-gradient(135deg, var(--ink-3) 0 2px, transparent 2px 6px)";
      return stops.length === 1 ? colOf(only) : `linear-gradient(90deg, ${stops.join(", ")})`;
    };
    const mainTurbo = (r) => r.turbo_mw && Object.keys(r.turbo_mw).length ? Object.entries(r.turbo_mw).map(([k, v]) => `${k} ${num(v)}`).join(" · ") : (r.turbo || "–");
    const sorted = rows.slice().sort((a, b) => (a.end || "9999").localeCompare(b.end || "9999") || a.start.localeCompare(b.start));
    const ticks = Array.from({ length: span + 1 }, (_, i) => A0 + i);
    let html = `<div class="g-row g-axis"><div></div><div class="g-track">${ticks.map((t) => `<span class="g-year ${t === now.getFullYear() ? "now" : ""}" style="left:${x(t)}%">${t}</span>`).join("")}</div><div class="g-end muted">Ends</div></div>`;
    sorted.forEach((r, i) => {
      const s = ym(r.start), e = r.end ? ym(r.end) + 1 / 12 : s + 1, beyond = endOf(r) > `${A1 - 1}-12`;
      html += `<div class="g-row"><div class="g-label"><strong>${esc(r.site)}</strong><span class="small muted">${esc(r.state)} · ${r.kind === "prime" ? "on-site power" : "backup gensets"}${r.mw ? ` · ${num(r.mw)} MW` : ""}</span></div>` +
        `<div class="g-track">${ticks.map((t) => `<span class="g-tick" style="left:${x(t)}%"></span>`).join("")}<span class="g-now" style="left:${x(nowV)}%"></span>` +
        `<span class="g-bar ${r.end ? "" : "open"}" data-i="${i}" style="left:${x(s)}%;width:${Math.max(1, x(Math.min(e, A1)) - x(s))}%;background:${barBg(r)}"></span>` +
        (beyond ? `<span class="g-more">→ ${esc(endOf(r).slice(0, 4))}</span>` : "") + `</div>` +
        `<div class="g-end">${esc(r.end ? mon(r.end) : "not stated")}</div></div>`;
    });
    $("#tm-gantt-legend").innerHTML = `${[["Garrett turbo", MAKER_COLOR["Garrett"]], ["Accelleron turbo", MAKER_COLOR["Accelleron"]], ["Other engine makers (own or other turbos)", "var(--grey-300)"], ["Turbo unknown, or turbines (no turbo)", null]].map(([l, c]) => `<span><i class="swatch" style="background:${c || "repeating-linear-gradient(135deg, var(--ink-3) 0 2px, transparent 2px 5px)"}"></i>${l}</span>`).join("")}<span><i class="swatch" style="background:var(--accent);width:2px"></i>Today</span><span>Faded end = end date not stated</span>`;
    $("#tm-gantt").innerHTML = html;
    $("#tm-gantt").querySelectorAll(".g-bar").forEach((b) => {
      const r = sorted[+b.dataset.i];
      bindTip(b, `<b>${esc(r.site)}</b><br>${esc(r.end_label)}<br><i>“${esc(r.quote)}”</i><br>${esc(r.engines || "")}<br>Turbo: ${esc(mainTurbo(r))}${r.turbo_mw ? " MW" : ""}`);
    });

    /* cohort table */
    const cb = (c, k) => num((c.cat_buckets || {})[k] || 0);
    const swName = SW ? SW.site.split(" (")[0] : "largest project";
    const crow = (lab, f, cls = "") => `<tr><td>${lab}</td><td class="num ${cls}">${f(W)}</td><td class="num ${cls}">${f(WO)}</td></tr>`;
    $("#tm-cohort").innerHTML = `<thead><tr><th scope="col">Units first permitted in 2026</th><th scope="col" class="num">All</th><th scope="col" class="num">Excl. ${esc(swName.replace(/^Project /, ""))}</th></tr></thead><tbody>` +
      crow("Generator MW where the permit names the engine maker", (c) => num(c.named_mw)) +
      crow("Cat MW (incl. \"Cat or alternate\")", (c) => `${num(c.cat_mw)} <span class="muted">(${pct(c.cat_share_of_named, 0)})</span>`) +
      crow("· Garrett turbo on the rating's data sheet", (c) => cb(c, "Garrett")) +
      crow("· Accelleron turbo on the rating's data sheet", (c) => cb(c, "Accelleron")) +
      crow("· engine matches two turbo makers (split 50/50)", (c) => cb(c, "Mixed match")) +
      crow("· no data sheet for the rating (left out)", (c) => cb(c, "No data sheet")) +
      crow("<b>Garrett share of Cat genset turbos</b>", (c) => `<b>${pct(c.garrett_of_cat_known, 0)}</b>`, "mono") +
      crow("<b>Garrett share of all maker-named genset MW</b>", (c) => `<b>${pct(c.garrett_of_named_low, 0)}–${pct(c.garrett_of_named_mid, 0)}</b>`, "mono") +
      `</tbody>`;
    $("#tm-note").innerHTML =
      `<b>Reading this:</b> the 2026 cohort covers most generators installed in 2027 and part of 2028; capacity for late 2028 and beyond is still being permitted. ` +
      (SW ? `${esc(SW.site)} alone is ${num(SW.mw)} MW of Cat 3516E at ${num(SW.kw)} ekW (${esc(SW.turbo)} turbos), ${pct(SW.mw / (W.cat_mw || 1), 0)} of 2026 Cat MW, and its application is still pending. Built as filed, Garrett's share of Cat turbos is ${pct(W.garrett_of_cat_known, 0)}; if it slips or changes engines, ${pct(WO.garrett_of_cat_known, 0)}. ` : "") +
      `The lower all-maker figure counts only Cat MW with a Garrett data sheet; the upper one assumes Cat MW without a sheet splits like the rest. Garrett ships its turbo when Cat builds the engine, a few months before the generator reaches site, so revenue on these units runs slightly ahead of the install dates. The five states lean to Cat; on the research note's global maker mix the share stays near ${pct((D.shareModel.headline || {}).point || 0, 0)}.`;

    /* sources */
    sortableTable($("#tm-sources"), [
      { key: "site", label: "Site", html: (r) => `<strong>${esc(r.site)}</strong>${r.operator ? `<div class="small muted">${esc(r.operator)}</div>` : ""}` },
      { key: "state", label: "State" },
      { key: "end", label: "Schedule", sort: (r) => r.end || "9999", html: (r) => `<span class="small">${esc(r.end_label)}</span>` },
      { key: "mw", label: "MW", num: true, html: (r) => r.mw ? num(r.mw) : `<span class="muted">–</span>` },
      { key: "engines", label: "Engines / turbo", html: (r) => `<span class="small">${esc(r.engines || "–")}</span><div>${makerPill(Object.keys(r.turbo_mw || { [r.turbo || "Unknown"]: 1 }).join(" + "))}</div>` },
      { key: "quote", label: "What the filing says", html: (r) => `<span class="small"><i>“${esc(r.quote)}”</i></span>` },
      { key: "doc", label: "Source", html: (r) => `<a href="${esc(r.url)}${r.page ? "#page=" + r.page : ""}" target="_blank" rel="noopener" class="mono">${esc(r.doc)}${r.page ? " p." + r.page : ""}</a>` },
    ], () => rows, { sortKey: "end", dir: 1 });
  }

  function sheetCols() {
    return [
      { key: "state", label: "State" },
      { key: "site", label: "Site / operator", html: (r) => `<strong>${esc(r.site || "–")}</strong>${r.operator && !(r.site || "").toLowerCase().includes(r.operator.toLowerCase().split(" ")[0]) ? `<div class="small muted">${esc(r.operator)}</div>` : ""}` },
      { key: "filed", label: "Filed", html: (r) => `<span class="mono small">${esc(r.filed || "–")}</span>` },
      { key: "engine", label: "Engine", html: (r) => esc(r.engine) },
      { key: "perf_no", label: "Rating", html: (r) => `<span class="mono">${esc(r.perf_no || "–")}</span>${r.ekw ? `<div class="small muted">${num(r.ekw)} ekW</div>` : ""}` },
      { key: "turbo", label: "Turbo part", html: (r) => `<span class="mono small">${esc(r.turbo)}</span>` },
      { key: "maker", label: "Maker", html: (r) => makerPill(r.maker) },
      { key: "page", label: "Source", sort: (r) => r.doc, html: (r) => r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="small">${esc(r.doc || r.source)}</a><div class="small mono">p.${r.page}${r.ocr ? " · OCR" : ""}</div>` : esc(r.doc) },
    ];
  }

  /* ---------- extra states (filings only) ---------- */
  function renderLightState(key) {
    const T = D.turbo, sec = $("#tab-" + key);
    const S = T && T.states.find((s) => s.key === key);
    if (!S) { sec.innerHTML = "<p>Data missing. Run scripts/build_turbo_tab.py.</p>"; return; }
    const sh = T.sheets.filter((s) => s.state === S.name);
    sec.innerHTML = `
      <div class="intro">
        <p class="eyebrow">${esc(S.agency)}</p>
        <h1>${esc(S.name)}: filings collected for the turbo evidence</h1>
        <p class="lede">${esc(S.coverage)} This is not a complete inventory of ${esc(S.name)} data centres, so it adds turbo evidence but no MW weights.</p>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="kpi-label">Sites</div><div class="kpi-value">${num(S.sites.length)}</div><div class="kpi-note">in the filings collected</div></div>
        <div class="kpi"><div class="kpi-label">Data sheets naming a turbo</div><div class="kpi-value accent">${num(sh.length)}</div><div class="kpi-note">${[...new Set(sh.map((s) => s.maker))].join(", ") || "none: permits only, or non-Cat sheets"}</div></div>
      </div>
      <article class="panel">
        <header class="panel-head"><div><h2>Sites and generators</h2><p class="panel-sub">As stated in each filing. Click the source to open the document.</p></div></header>
        <div class="table-scroll"><table class="data sortable" id="${key}-lt-sites"></table></div>
      </article>
      <article class="panel">
        <header class="panel-head"><div><h2>Data sheets that name the turbocharger</h2><p class="panel-sub">The same rows as in the audit table on the Garrett turbo share tab.</p></div></header>
        <div class="table-scroll tall"><table class="data sortable" id="${key}-lt-sheets"></table></div>
      </article>
      <footer class="source">${esc(T.states_note)}</footer>`;
    sortableTable($(`#${key}-lt-sites`), [
      { key: "site", label: "Site", html: (r) => `<strong>${esc(r.site)}</strong>${r.operator ? `<div class="small muted">${esc(r.operator)}</div>` : ""}` },
      { key: "units", label: "Generators", html: (r) => `<span class="small">${esc(r.units)}</span>` },
      { key: "engines", label: "Engines named", html: (r) => `<span class="small">${esc(r.engines)}</span>` },
      { key: "date", label: "Filed", html: (r) => `<span class="mono small">${esc(r.date || "–")}</span>` },
      { key: "doc", label: "Source", html: (r) => r.url ? `<a href="${esc(r.url)}${r.page ? "#page=" + r.page : ""}" target="_blank" rel="noopener" class="small">${esc(r.doc || "document")}</a>${r.page ? `<div class="small mono">p.${r.page}</div>` : ""}` : "–" },
    ], () => S.sites, {});
    if (sh.length) sortableTable($(`#${key}-lt-sheets`), sheetCols(), () => sh, { sortKey: "engine", dir: 1 });
    else $(`#${key}-lt-sheets`).innerHTML = `<tbody><tr><td class="muted">No data sheets naming a turbocharger in these filings. ${key === "wisconsin" ? "The attached sheets are Cummins, which builds its own turbochargers." : "The filings are permits, which state the engine but attach no data sheet."}</td></tr></tbody>`;
  }

  /* ---------- Share model tab ---------- */
  function renderShare() {
    const M = D.shareModel, C = D.consolidated;
    const base = M.rows.map((r) => ({ ...r }));
    let rows = base.map((r) => ({ ...r }));
    let mixKind = "global";

    /* Map a permit maker mix onto the build-up rows. "Cat or alternate" units are split half to Cat,
       a quarter each to Cummins and MTU (the alternates those permits name). */
    const permitMix = (m) => {
      const e = m["Cat or alternate"] || 0;
      return { "Caterpillar": (m["Caterpillar"] || 0) + e / 2, "Weichai / Baudouin": m["Baudouin (Weichai)"] || 0,
        "Rehlko (Liebherr-built)": m["Kohler / Rehlko"] || 0, "Others (Volvo Penta, Perkins, Doosan, Yuchai)": m["Other"] || 0,
        "Cummins": (m["Cummins"] || 0) + e / 4, "MTU (Rolls-Royce)": (m["MTU"] || 0) + e / 4, "Mitsubishi": 0 };
    };
    const mixFor = (kind) => !C ? null : kind === "us_all" ? permitMix(C.total.makers) : kind === "us_recent" ? permitMix(C.total.makers_recent) : null;
    function setMix(kind) {
      mixKind = kind;
      const m = mixFor(kind);
      rows.forEach((r, i) => { r.mkt = m ? (m[r.maker] || 0) : base[i].mkt; });
      drawTable();
    }
    /* Garrett share of Cat genset turbos = platform mix in the permits x Garrett share per platform. */
    const catSplit = (which) => which === "all" ? C.total.cat_split_all : C.total.cat_split_recent;
    const catGtx = (which, pE, pBC, pOther = 0.2) => { const sp = catSplit(which); return sp.garrett * pBC + sp.cat_unconfirmed * pE + sp.cat_other * pOther; };
    const shareWith = (mixRows, cg) => mixRows.reduce((a, r) => a + r.mkt * (r.maker === "Caterpillar" ? cg : r.gtx), 0);

    const calc = () => {
      const tot = rows.reduce((a, r) => a + r.mkt, 0);
      const gtx = rows.reduce((a, r) => a + r.mkt * r.gtx, 0);
      const open = rows.filter((r) => !r.captive).reduce((a, r) => a + r.mkt, 0);
      return { tot, gtx, open, openShare: open ? gtx / open : 0 };
    };

    const table = $("#sh-table");
    function drawTable() {
      table.innerHTML = `<thead><tr><th scope="col">Engine maker</th><th scope="col" class="num">Market share (MW)</th><th scope="col" class="num">× Garrett share of its turbos</th><th scope="col" class="num">= Garrett share of total</th><th scope="col">Turbo source</th></tr></thead><tbody>` +
        rows.map((r, i) => `<tr>
          <td><strong>${esc(r.maker)}</strong></td>
          <td class="num"><input type="number" id="sh-mkt-${i}" data-i="${i}" data-f="mkt" min="0" max="100" step="0.5" value="${+(r.mkt * 100).toFixed(1)}" aria-label="${esc(r.maker)} market share %"> %</td>
          <td class="num">${r.captive ? `<span class="muted">0% (captive)</span>` : `<input type="number" id="sh-gtx-${i}" data-i="${i}" data-f="gtx" min="0" max="100" step="2.5" value="${+(r.gtx * 100).toFixed(1)}" aria-label="Garrett share of ${esc(r.maker)} turbos %"> %`}</td>
          <td class="num mono" data-out="${i}"></td>
          <td class="small">${esc(r.source)}</td></tr>`).join("") +
        `</tbody><tfoot><tr><td>Total</td><td class="num mono" id="sh-tot"></td><td></td><td class="num mono" id="sh-gtx"></td><td></td></tr></tfoot>`;
      table.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) { rows[+inp.dataset.i][inp.dataset.f] = Math.max(0, Math.min(100, v)) / 100; update(); }
      }));
      update();
    }

    function update() {
      const c = calc();
      rows.forEach((r, i) => { table.querySelector(`[data-out="${i}"]`).textContent = pct(r.mkt * r.gtx); });
      $("#sh-tot").textContent = pct(c.tot);
      $("#sh-gtx").textContent = pct(c.gtx);
      $("#sh-kpis").innerHTML = [
        [mixKind === "global" ? "Garrett share, global DC genset turbos" : "Garrett share, US DC genset turbos", pct(c.gtx, 0), `Note: ${pct(M.headline.point, 0)} (range ${pct(M.headline.low, 0)}–${pct(M.headline.high, 0)})`, true],
        ["Share of the open (non-captive) market", pct(c.openShare, 0), `Open market = ${pct(c.open, 0)} of MW`],
        ["From Caterpillar", pct(rows[0].mkt * rows[0].gtx, 1), `${pct((rows[0].mkt * rows[0].gtx) / (c.gtx || 1), 0)} of Garrett's DC turbo share`],
        ["Captive (Cummins, MTU, Mitsubishi)", pct(c.tot - c.open, 0), "Closed to Garrett"],
      ].map(([l, v, n, a]) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value ${a ? "accent" : ""}">${v}</div><div class="kpi-note">${n}</div></div>`).join("");

      const reds = ["var(--red-800)", "var(--red-600)", "var(--red-400)", "var(--red-200)"];
      const bar = $("#sh-bar"); bar.innerHTML = "";
      const parts = rows.filter((r) => !r.captive).map((r, i) => ({ label: r.maker, value: r.mkt * r.gtx, color: reds[i % reds.length] }));
      parts.push({ label: "Other suppliers in open market", value: Math.max(0, c.open - c.gtx), color: "var(--grey-300)" });
      parts.push({ label: "Captive (makers' own turbos)", value: c.tot - c.open, color: "var(--grey-500)" });
      stackRow(bar, mixKind === "global" ? "Global DC genset turbo market" : "US DC genset turbos (permit mix)", "red = Garrett", parts,
        (p, s) => `<b>${esc(p.label)}</b><br>${pct(p.value)} of market`);

      const chk = $("#sh-check");
      if (Math.abs(c.tot - 1) > 0.005) { chk.className = "callout warn"; chk.textContent = `Market shares add to ${pct(c.tot)}, not 100%. Adjust a row so the total is 100%.`; }
      else { chk.className = "callout"; chk.innerHTML = `<b>Caterpillar drives the answer.</b> Each 10 points of Garrett's share of Cat turbos moves the total by ${pct(rows[0].mkt * 0.1, 1)}. ` + (!C ? "" : mixKind === "global"
          ? `Five states of US permits put Cat at ${pct(C.total.makers["Caterpillar"], 0)} of maker-named MW, plus ${pct(C.total.makers["Cat or alternate"], 0)} where Cat is one of two allowed makers, well above the ${pct(base[0].mkt, 1)} global estimate. The US hyperscale build skews to Cat.`
          : `This mix uses the five-state permit evidence (${mixKind === "us_recent" ? "units first permitted 2025–26" : "all units"}); "Cat or alternate" units are split half to Cat and a quarter each to Cummins and MTU.`); }
      drawContent(c.gtx);
    }

    function setCase(which) {
      const m = mixFor(mixKind);
      rows = base.map((r) => ({ ...r, mkt: m ? (m[r.maker] || 0) : r.mkt, gtx: which === "low" ? r.gtxLow : which === "high" ? r.gtxHigh : r.gtx }));
      drawTable();
    }
    $("#sh-mix").addEventListener("change", (e) => setMix(e.target.value));
    $("#sh-reset").addEventListener("click", () => setCase("base"));
    $("#sh-low").addEventListener("click", () => setCase("low"));
    $("#sh-high").addEventListener("click", () => setCase("high"));

    function drawContent(share) {
      const C = M.contentPerMW;
      const lo = (C.revenue * 1e6) / (C.gwHigh * 1000 * share), hi = (C.revenue * 1e6) / (C.gwLow * 1000 * share);
      $("#sh-content").innerHTML = `<div class="calc">
        <div class="calc-row"><span>Garrett DC-related revenue, 2026</span><span class="mono">$${C.revenue}M</span></div>
        <div class="calc-row"><span>Global DC engine-genset capacity</span><span class="mono">${C.gwLow}–${C.gwHigh} GW</span></div>
        <div class="calc-row"><span>Garrett share (from the build-up)</span><span class="mono">${pct(share, 0)}</span></div>
        <div class="calc-row total"><span>Implied turbo content per MW</span><span class="mono">$${num(lo / 1000, 0)}–${num(hi / 1000, 0)}k</span></div>
        <p class="small muted" style="margin:0">${esc(C.note)}</p></div>`;
    }

    if (C) renderPermitEvidence();

    function renderPermitEvidence() {
      const T = C.total, rec = permitMix(T.makers_recent), recRows = base.map((r) => ({ ...r, mkt: rec[r.maker] || 0 }));
      const lo = shareWith(recRows, catGtx("recent", 0, 0.85)), mid = shareWith(recRows, catGtx("recent", 0.5, 0.85)), hi = shareWith(recRows, catGtx("recent", 1, 0.85));
      const capRec = (T.makers_recent["Cummins"] || 0) + (T.makers_recent["MTU"] || 0);
      const bcGW = T.lens_all.garrett * T.named_mw / 1000;
      const P = C.prime, techMW = Object.fromEntries(P.by_tech.map((t) => [t.tech, t]));
      const recip = techMW["Gas reciprocating engine"] || { mw: 0, units: 0 }, turb = techMW["Gas turbine"] || { mw: 0, units: 0, plants: 0 };
      const gm = Object.fromEntries(P.gas_makers.map((g) => [g.maker, g]));
      const st = Object.fromEntries(C.states.map((x) => [x.key, x]));
      const plantList = (g) => g ? g.plants.map((x) => x.replace(/ \((Texas|Georgia|Ohio|Arizona|Virginia)\)$/, "")).join(", ") : "";
      const CM = M.contentPerMW, perMW = (CM.revenue * 1e6) / (((CM.gwLow + CM.gwHigh) / 2) * 1000 * M.headline.point);

      $("#sh-pkpis").innerHTML = [
        ["Generators in the permits", num(T.units), `${num(T.mw / 1000, 1)} GW across 5 states`],
        ["Cat share, 2025–26 permits", pct(T.makers_recent["Caterpillar"], 0), `+${pct(T.makers_recent["Cat or alternate"] || 0, 0)} where Cat is one of two options; Cummins + MTU ${pct(capRec, 0)}`],
        ["3516B/C share of new Cat MW", pct(T.cat_split_recent.garrett, 0), `vs ${pct(T.cat_split_all.garrett, 0)} of all Cat MW; 3516E/C175 now ${pct(T.cat_split_recent.cat_unconfirmed, 0)}`, true],
        ["Garrett share of Cat turbos (filings)", pct(D.turbo ? catGarrett("recent") : 0, 0), `2025–26 units; see the Garrett turbo share tab`, true],
        ["Turbocharged prime power", `${num(recip.mw / 1000, 1)} GW`, `${num(recip.units)} gas engines; turbines ≥${num(turb.mw / 1000, 1)} GW`],
      ].map(([l, v, n, a]) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value ${a ? "accent" : ""}">${v}</div><div class="kpi-note">${n}</div></div>`).join("");

      const g = [
        `<b>Caterpillar dominates US new builds.</b> Of units first permitted 2025–26, Cat is ${pct(T.makers_recent["Caterpillar"], 0)} of maker-named MW and another ${pct(T.makers_recent["Cat or alternate"] || 0, 0)} allows Cat or an alternate. Cummins and MTU, whose turbos are captive, are only ${pct(capRec, 0)}, against the ~35% the note assumes globally. The open market Garrett can sell into is larger in the US than the note assumes.`,
        `<b>Cat's newer engines are replacing the 3516B/C in new permits.</b> Cat 3512/3516B/C is ${pct(T.cat_split_all.garrett, 0)} of all permitted Cat MW but ${pct(T.cat_split_recent.garrett, 0)} of Cat MW permitted 2025–26; the 3516E and C175 take ${pct(T.cat_split_recent.cat_unconfirmed, 0)}. The same shift shows in each state with enough recent data: ${C.states.filter((x) => x.recent_reliable).map((x) => `${x.state} ${pct(x.lens_all.garrett, 0)} → ${pct(x.lens_recent.garrett, 0)}`).join(", ")} (3516B/C share of named MW, all → recent).`,
        `<b>Engine data sheets settle which turbo each Cat rating uses.</b> The 3516E at 2,750 ekW and every C175, 3516C and 3512C sheet name Garrett; the 3516E at 3,000 ekW names Accelleron. That puts Garrett at ${pct(D.turbo ? catGarrett("recent") : 0, 0)} of 2025–26 Cat genset turbos (Garrett turbo share tab).`,
        `<b>The installed base still pays.</b> About ${num(bcGW, 1)} GW of permitted 3516B/C capacity sits in these five states alone, mostly from 2010–2024 builds. That fleet needs replacement turbos for years whatever happens on new platforms.`,
        `<b>Unit sizes are rising.</b> New permits favour 3–4 MW sets (C175-20 at ~3.9 MW, 3516E at ~3 MW) over the 2–2.5 MW 3516B/C. Fewer, larger engines per MW means fewer, larger turbos.`,
        `<b>Hyperscaler choices set the mix.</b> Amazon specifies Cat 3516E at its new Texas sites after naming 3516C-HD in its 2019 Ohio permits. Microsoft runs Cat C175 in San Antonio but Cummins QSK95 in Phoenix, which is why Arizona is the one captive-heavy state (Cummins + MTU ${pct(st.arizona.lens_all.captive, 0)}). One customer decision can move a state.`,
        `<b>Weichai/Baudouin barely shows up in US permits</b> (${pct(T.makers["Baudouin (Weichai)"] || 0, 1)} of named MW). Garrett's Weichai lever is mainly outside the US.`,
        `<b>Visibility is thinning.</b> The maker is named for only ${pct(st.ohio.named_share, 0)} of Ohio MW and ${pct(st.arizona.named_share, 0)} of Arizona MW: Amazon's later Ohio permits and the newest Phoenix campuses leave it out. Texas (${pct(st.texas.named_share, 0)}), Virginia (${pct(st.virginia.named_share, 0)}) and Georgia (${pct(st.georgia.named_share, 0)}) remain the best windows.`,
      ];
      const pr = [
        `<b>On-site prime power is now a real market.</b> Permits and applications in Georgia, Ohio and Texas cover ${num(recip.mw / 1000, 1)} GW of gas engines and at least ${num(turb.mw / 1000, 1)} GW of gas turbines built to run data centres directly, not as backup. Virginia and Maricopa have none yet.`,
        `<b>About ${pct(recip.mw / ((recip.mw + turb.mw) || 1), 0)} of the sized capacity is turbocharged.</b> Reciprocating gas engines carry turbos; the gas turbines that win the biggest plants (Fermi Matador, Crusoe Longhorn and Goodnight, Bluegrass in Ohio) do not.`,
        `<b>Jenbacher leads the engine side</b> with ${num(gm.Jenbacher ? gm.Jenbacher.units : 0)} engines (${num((gm.Jenbacher ? gm.Jenbacher.mw : 0) / 1000, 1)} GW) at ${esc(plantList(gm.Jenbacher))}. <b>Caterpillar's G3520</b> follows with ${num(gm.Caterpillar ? gm.Caterpillar.units : 0)} engines (${num((gm.Caterpillar ? gm.Caterpillar.mw : 0) / 1000, 1)} GW) at ${esc(plantList(gm.Caterpillar))}, which shares its location with a Google project.`,
        `<b>Garrett's position here is unproven.</b> Cat buys turbos externally and Garrett is its main diesel genset turbo supplier, so the G3520 is the natural adjacency, but its supplier is not confirmed. Jenbacher and Wärtsilä suppliers are not yet researched. Everllence (ex-MAN) builds its own.`,
        `<b>Running hours make it an aftermarket story.</b> Prime engines are permitted for up to 8,760 hours a year against roughly 50–200 for backup sets, so turbo overhaul and replacement demand per MW is of a different order once these plants run.`,
        `<b>Prime power does not remove backup.</b> The same campuses still permit diesel backup: 218 Cat 3516 sets (~3 MW each) at Crusoe Goodnight and 80 at Crusoe Longhorn.`,
      ];
      $("#sh-ins-genset").innerHTML = g.map((x) => `<li>${x}</li>`).join("");
      $("#sh-ins-prime").innerHTML = pr.map((x) => `<li>${x}</li>`).join("");

      const total = { state: "Five states", units: T.units, mw: T.mw, named_share: T.named_mw / T.mw, makers: T.makers,
        lens_all: T.lens_all, lens_recent: T.lens_recent, recent_reliable: true, total: true };
      sortableTable($("#sh-state-table"), [
        { key: "state", label: "State", html: (r) => `<strong>${esc(r.state)}</strong>` },
        { key: "units", label: "Units", num: true, html: (r) => num(r.units) },
        { key: "mw", label: "MW", num: true, html: (r) => num(r.mw) },
        { key: "named_share", label: "Maker named", num: true, html: (r) => pct(r.named_share, 0) },
        { key: "cat", label: "Cat (+ either)", num: true, sort: (r) => r.makers["Caterpillar"] || 0, html: (r) => `${pct(r.makers["Caterpillar"] || 0, 0)} <span class="muted">+${pct(r.makers["Cat or alternate"] || 0, 0)}</span>` },
        { key: "cap", label: "Cummins + MTU", num: true, sort: (r) => r.lens_all.captive, html: (r) => pct(r.lens_all.captive, 0) },
        { key: "bc", label: "3516B/C all → recent", num: true, sort: (r) => r.lens_all.garrett, html: (r) => `${pct(r.lens_all.garrett, 0)} → ${r.recent_reliable ? pct(r.lens_recent.garrett, 0) : `<span class="muted">n/a</span>`}` },
        { key: "e", label: "3516E/C175 all → recent", num: true, sort: (r) => r.lens_all.cat_unconfirmed, html: (r) => `${pct(r.lens_all.cat_unconfirmed, 0)} → ${r.recent_reliable ? pct(r.lens_recent.cat_unconfirmed, 0) : `<span class="muted">n/a</span>`}` },
      ], () => C.states, { foot: () => `<tr>${[`Five states`, num(total.units), num(total.mw), pct(total.named_share, 0),
        `${pct(T.makers["Caterpillar"], 0)} +${pct(T.makers["Cat or alternate"] || 0, 0)}`, pct(T.lens_all.captive, 0),
        `${pct(T.lens_all.garrett, 0)} → ${pct(T.lens_recent.garrett, 0)}`, `${pct(T.lens_all.cat_unconfirmed, 0)} → ${pct(T.lens_recent.cat_unconfirmed, 0)}`]
        .map((v, i) => `<td class="${i ? "num" : ""}">${v}</td>`).join("")}</tr>` });
      $("#sh-state-table").insertAdjacentHTML("afterend", `<p class="small muted" style="margin:8px 0 0">Shares are of maker-named MW. "Recent" = units first permitted 2025–26 (Virginia: new units in 2026 permits); n/a where fewer than 500 named MW are recent. "Either" = permit allows Cat or another maker.</p>`);

      /* prime power */
      const bars = $("#sh-prime-bars"); bars.innerHTML = "";
      const reds = ["var(--red-800)", "var(--red-600)", "var(--red-400)", "var(--red-200)"];
      stackRow(bars, "Data-centre prime power", `${num(recip.mw + turb.mw)} MW sized · red = turbocharged`, [
        ...P.gas_makers.map((x, i) => ({ label: `${x.maker} gas engines`, value: x.mw, color: reds[i % 4] })),
        { label: "Gas turbines (no turbocharger)", value: turb.mw, color: "var(--grey-500)" },
      ], (q, sh) => `<b>${esc(q.label)}</b><br>${num(q.value)} MW · ${pct(sh)}`);
      const ptRows = P.gas_makers.map((x) => ({ tech: "Gas reciprocating engine", maker: x.maker, units: x.units, mw: x.mw, plants: plantList(x), turbo: x.turbo_supplier, yes: true }))
        .concat([{ tech: "Gas turbine", maker: "Gas turbines (GE, Siemens, Solar and others)", units: turb.units, mw: turb.mw, plants: `${turb.plants} plants; unsized: ${P.unsized_turbine_plants.join(", ")}`, turbo: "no turbocharger", yes: false }]);
      sortableTable($("#sh-prime-table"), [
        { key: "maker", label: "Prime mover", html: (r) => `<strong>${esc(r.maker)}</strong><div class="small muted">${esc(r.tech)}</div>` },
        { key: "units", label: "Units", num: true, html: (r) => num(r.units) },
        { key: "mw", label: "MW", num: true, html: (r) => num(r.mw) },
        { key: "turbo", label: "Turbocharged? Supplier", html: (r) => `<span class="pill ${r.yes ? "yes" : ""}">${r.yes ? "Yes" : "No"}</span> <span class="small">${esc(r.turbo)}</span>` },
        { key: "plants", label: "Plants", html: (r) => `<span class="small">${esc(r.plants)}</span>` },
      ], () => ptRows, { sortKey: "mw" });
      const cat = gm.Caterpillar;
      $("#sh-prime-callout").innerHTML = `<b>Sizing it (illustrative):</b> the note's numbers imply ~$${num(perMW / 1000, 0)}k of Garrett turbo content per diesel MW. At that rate the ${num(recip.mw / 1000, 1)} GW of turbocharged gas engines in these permits is ~$${num(recip.mw * perMW / 1e6, 0)}M of first-fit turbos${cat ? `, of which Roman's ${num(cat.units)} Cat G3520s are ~$${num(cat.mw * perMW / 1e6, 0)}M` : ""}. Replacement cycles then scale with running hours. None of it is Garrett's until the G3520 and Jenbacher turbo suppliers are confirmed.`;
    }

    sortableTable($("#sh-turbo-table"), [
      { key: "source", label: "Power source" },
      { key: "turbo", label: "Turbos?", html: (r) => `<span class="pill ${/yes/i.test(r.turbo) ? "yes" : ""}">${esc(r.turbo)}</span>` },
      { key: "notes", label: "Notes", html: (r) => `<span class="small">${esc(r.notes)}</span>` },
    ], () => M.whichUseTurbos);

    sortableTable($("#sh-evidence"), [
      { key: "maker", label: "Engine maker", html: (r) => `<strong>${esc(r.maker)}</strong>` },
      { key: "source", label: "Turbo source" },
      { key: "gtxRange", label: "Garrett share range", sort: (r) => r.gtx, html: (r) => r.captive ? `<span class="muted">~0%</span>` : `<span class="mono">${pct(r.gtxLow, 0)}–${pct(r.gtxHigh, 0)}</span>` },
      { key: "evidence", label: "Evidence", html: (r) => `<span class="small">${esc(r.evidence)}</span>` },
    ], () => M.rows);

    $("#sh-next").innerHTML = M.nextSteps.map((s) => `<li>${esc(s)}</li>`).join("");
    drawTable();
  }

  initTabs();
})();
