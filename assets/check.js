/* ===========================================================
   PayRight — Bill checker (website)
   Money helpers, the PDF reader and the audit engine live in
   billcore.js. All money is in PAISE (integers).
   =========================================================== */

const RECEIPTS = [
  {
    id: "coastal", category: "restaurant", merchant: "The Coastal Table", place: "Bandra West, Mumbai",
    date: "14-10-2026 · 21:42", gstin: "27ABCDE1234F1Z5", story: "Clean maths, one optional fee", dineIn: true,
    items: [["Prawn Koliwada", 1, 42000], ["Fish Curry Rice", 1, 38000], ["Neer Dosa", 2, 9000], ["Sol Kadhi", 2, 8000], ["Bebinca", 2, 25000]],
    printed: { subtotal: 164000, discount: null, taxes: [{ name: "CGST", bp: 250, amt: 4100 }, { name: "SGST", bp: 250, amt: 4100 }],
      fees: [{ name: "Service Charge 10%", amt: 16400, kind: "service" }], round: 0, total: 188600 },
    extra: [],
  },
  {
    id: "brew", category: "restaurant", merchant: "Brew & Bloom Cafe", place: "Koramangala, Bengaluru",
    date: "09-10-2026 · 16:05", gstin: "29PQRSX5678K1Z2", story: "A subtotal that doesn't add up", dineIn: true,
    items: [["Cold Coffee 350ml", 2, 22000], ["Avocado Toast", 1, 28000], ["Masala Fries", 1, 14000]],
    printed: { subtotal: 90000, discount: null, taxes: [{ name: "CGST", bp: 250, amt: 2250 }, { name: "SGST", bp: 250, amt: 2250 }],
      fees: [], round: 0, total: 94500 },
    extra: [],
  },
  {
    id: "sunrise", category: "hospital", merchant: "Sunrise Multispeciality Hospital", place: "Andheri East, Mumbai",
    date: "06-10-2026 · 12:40", gstin: "", story: "A 3-night stay with hidden extras", dineIn: false,
    stayDays: 3, admitted: "03-10-2026", discharged: "06-10-2026",
    items: [["Room Rent Twin Sharing", 4, 350000], ["Nursing Charges", 3, 60000], ["Doctor Visit", 3, 80000], ["CBC Test", 1, 45000],
      ["CBC Test", 1, 45000], ["Chest X-Ray", 1, 90000], ["Paracetamol 500", 15, 250, 200], ["Pantoprazole 40", 10, 1450, 1450], ["IV Set", 2, 18000]],
    printed: { subtotal: 2054250, discount: null, taxes: [],
      fees: [{ name: "Admin Charges", amt: 150000, kind: "other" }, { name: "Miscellaneous Charges", amt: 75000, kind: "other" }], round: 50, total: 2279300 },
    extra: [],
  },
];

const STAGES = ["Uploading", "Reading PDF text", "Extracting fields", "Reconstructing amounts", "Checking rules", "Preparing report"];
const CAT_LABEL = { restaurant: "Restaurant", hospital: "Hospital · beta", grocery: "Grocery", delivery: "Delivery" };

let current = RECEIPTS[0];
let result = null;
let editing = false;

const $ = id => document.getElementById(id);

function renderPicker() {
  $("picker").innerHTML = RECEIPTS.map((r, i) => `
    <button class="pick ${r === current ? "on" : ""}" data-i="${i}">
      <span class="tag ${r.category === "hospital" ? "unx" : "plain"}">${r.source === "pdf" ? "Your PDF · " : ""}${CAT_LABEL[r.category] || r.category}</span>
      <h4>${r.merchant}</h4>
      <span class="muted">${r.story}</span>
      <div class="amt">${rs(r.printed.total)}</div>
    </button>`).join("") + `
    <button class="pick upload-pick" id="uploadPick">
      <span class="tag acc">No OCR needed</span>
      <h4>Upload a bill PDF</h4>
      <span class="muted">Any text-based bill PDF — restaurant, hospital, clinic or grocery.</span>
      <div class="amt" style="color:var(--accent)">Choose PDF ↑</div>
    </button>`;
  $("picker").querySelectorAll(".pick[data-i]").forEach(b => b.onclick = () => select(RECEIPTS[+b.dataset.i]));
  $("uploadPick").onclick = () => $("pdfInput").click();
}

function select(r, autorun) {
  current = r; result = null; editing = false;
  renderPicker(); renderReceipt(); renderStages(-1);
  $("results").innerHTML = `<div class="empty-state"><div class="display h-m">${current.merchant} is ready.</div><p>Press <b>Run audit</b> to check it.</p></div>`;
  if (autorun) run();
}

async function handlePdf(file) {
  if (!file) return;
  $("results").innerHTML = `<div class="empty-state"><div class="display h-m">Reading ${file.name}…</div><p>Extracting the text inside the PDF.</p></div>`;
  try {
    const bill = await readBillPdf(file);
    bill.story = file.name;
    const old = RECEIPTS.findIndex(x => x.source === "pdf");
    if (old >= 0) RECEIPTS.splice(old, 1);
    RECEIPTS.push(bill);
    select(bill, true);
    toast("PDF read — " + bill.items.length + " items found");
  } catch (e) {
    $("results").innerHTML = `<div class="empty-state"><div class="display h-m">Couldn't read that PDF.</div><p style="max-width:52ch;margin:10px auto 0">${e.message}</p></div>`;
  }
  $("pdfInput").value = "";
}

function renderReceipt(scanning) {
  const r = current, p = r.printed;
  const f2 = v => (v / 100).toFixed(2);
  $("receiptView").innerHTML = `
    <div class="receipt" style="position:relative">
      <div class="scanline" style="${scanning ? "opacity:1;animation:scan 1.2s ease-in-out infinite alternate" : ""}"></div>
      <div class="r-title">${r.merchant.toUpperCase()}</div>
      <div class="r-sub">${r.place}<br>${r.date}${r.admitted ? `<br>Admitted ${r.admitted} · Discharged ${r.discharged}` : ""}</div>
      ${r.items.map(([n, q, u, mrp, line]) => `<div class="r-row"><span>${n}${q > 1 ? " ×" + q : ""}${mrp ? ` <small style="opacity:.6">MRP ${f2(mrp)}</small>` : ""}</span><span>${f2(line ?? q * u)}</span></div>`).join("")}
      <div class="r-hr"></div>
      ${p.subtotal !== null ? `<div class="r-row"><span>Subtotal</span><span>${f2(p.subtotal)}</span></div>` : ""}
      ${p.discount ? `<div class="r-row"><span>Disc ${p.discount.name}</span><span>-${f2(p.discount.amt)}</span></div>` : ""}
      ${p.fees.map(f => `<div class="r-row"><span>${f.name}</span><span>${f2(f.amt)}</span></div>`).join("")}
      ${p.taxes.map(t => `<div class="r-row"><span>${t.name} ${pct(t.bp)}</span><span>${f2(t.amt)}</span></div>`).join("")}
      ${p.round ? `<div class="r-row"><span>Round off</span><span>${f2(p.round)}</span></div>` : ""}
      <div class="r-hr"></div>
      <div class="r-row r-total"><span>TOTAL</span><span>₹${f2(p.total)}</span></div>
      ${r.gstin ? `<div class="r-sub" style="margin-top:10px">GSTIN ${r.gstin}</div>` : ""}
    </div>`;
}

function renderStages(active) {
  $("stages").innerHTML = STAGES.map((s, i) => `
    <li class="${i < active ? "done" : i === active ? "run" : ""}"><span class="st">${i < active ? "✓" : ""}</span>${s}</li>`).join("");
}

function run() {
  const btn = $("runBtn");
  btn.disabled = true; btn.style.opacity = .6;
  renderReceipt(true);
  $("results").innerHTML = `<div class="empty-state"><div class="display h-m">Checking ${current.merchant}…</div><p>Each step below is a real stage of the pipeline.</p></div>`;
  let i = 0;
  const tick = () => {
    renderStages(i);
    if (i === STAGES.length) {
      btn.disabled = false; btn.style.opacity = 1; btn.innerHTML = 'Run again <span class="arr">↻</span>';
      renderReceipt(false);
      result = audit(current);
      renderResults(true);
      return;
    }
    i++;
    setTimeout(tick, 320 + Math.random() * 220);
  };
  tick();
}

function renderResults(scrollTo) {
  const r = current, a = result, c = a.counts;
  const hasMrp = a.lines.some(l => l.mrp !== null);
  const hosp = r.category === "hospital";

  $("results").innerHTML = `
    ${r.source === "pdf" ? `<div class="note-banner">Read directly from your PDF: ${r.fileName}</div>` : ""}

    <div class="result-card" data-reveal>
      <div class="summary-top">
        <div>
          <span class="muted">${r.merchant} · ${r.date}</span>
          <div class="big-amt">${rs(r.printed.total)}</div>
          <span class="muted">Total printed on the bill</span>
        </div>
        <div style="text-align:right">
          <span class="muted">Our recalculated total</span>
          <div class="display" style="font-size:36px">${rs(a.ourTotal)}</div>
        </div>
      </div>
      <h3 style="margin:26px 0 0">${headline(a)}</h3>
      <div class="chips">
        <span class="tag ${hosp ? "unx" : "plain"}">${CAT_LABEL[r.category] || r.category}</span>
        ${["rev", "unx", "opt", "need", "ok"].filter(s => c[s]).map(s => `<span class="tag ${s}">${c[s]} ${STATUS[s].label}</span>`).join("")}
      </div>
      <div class="money-split">
        <div><b>${rs(a.money.over)}</b><small>Confirmed arithmetic overcharge</small></div>
        <div><b>${rs(a.money.contest)}</b><small>Potentially contestable</small></div>
        <div><b>${rs(a.money.optional)}</b><small>Optional — your choice</small></div>
        <div><b>${rs(a.money.unexplained)}</b><small>Unexplained</small></div>
        <div><b>${rs(a.money.refund)}</b><small>Documented refund so far</small></div>
      </div>
      <p class="muted" style="font-size:13.5px;margin-top:14px">These amounts are never added together as "money owed to you".</p>
    </div>

    <div class="result-card" data-reveal>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
        <h3 style="margin:0">Itemised bill</h3>
        <button class="btn btn-ghost btn-sm" id="editBtn">${editing ? "Done editing" : "Edit extracted details"}</button>
      </div>
      <div class="table-wrap"><table class="items-table">
        <tr><th>Item</th><th class="n">Qty</th><th class="n">Unit</th>${hasMrp ? '<th class="n">MRP</th>' : ""}<th class="n">Line total</th></tr>
        ${a.lines.map((l, i) => {
          const dup = a.lines.findIndex(x => x.name.toLowerCase() === l.name.toLowerCase() && x.qty === l.qty && x.unit === l.unit) !== i;
          const over = l.mrp !== null && l.unit > l.mrp;
          const days = hosp && r.stayDays && /room|bed|ward|icu|nursing|stay/i.test(l.name) && l.qty > r.stayDays;
          const flag = dup ? "repeat" : over ? "above MRP" : days ? "extra day" : "";
          const inp = (attr, val, w) => `<input ${attr}="${i}" type="number" min="0" ${attr === "data-u" ? 'step="0.01"' : ""} value="${val}" style="width:${w}px;padding:6px;border-radius:8px;border:1.5px solid var(--line);background:var(--bg);text-align:right">`;
          return `<tr class="${flag ? "flag" : ""}"><td>${l.name}${flag ? ` <span class="tag rev">${flag}</span>` : ""}</td>
            <td class="n">${editing ? inp("data-q", l.qty, 60) : l.qty}</td>
            <td class="n">${editing ? inp("data-u", (l.unit / 100).toFixed(2), 96) : rs(l.unit)}</td>
            ${hasMrp ? `<td class="n">${l.mrp !== null ? rs(l.mrp) : "—"}</td>` : ""}
            <td class="n">${rs(l.total)}</td></tr>`;
        }).join("")}
      </table></div>
      ${editing ? '<p class="muted" style="font-size:14px;margin-top:12px">Change a quantity or price — the audit recalculates instantly. Your corrections are kept separate from what we read.</p>' : ""}
    </div>

    <div class="result-card" data-reveal>
      <h3>Rebuilt from scratch</h3>
      <div class="recon">
        <div class="rr"><span>Items</span><span>${rs(a.ourSub)}</span></div>
        ${a.ourDisc ? `<div class="rr"><span>Discount</span><span>−${rs(a.ourDisc)}</span></div>` : ""}
        ${r.printed.taxes.length ? `<div class="rr"><span>Tax (${r.printed.taxes.map(t => t.name).join(" + ")})</span><span>${rs(a.ourTax)}</span></div>` : ""}
        ${r.printed.fees.map(f => `<div class="rr"><span>${f.name}</span><span>${rs(f.amt)}</span></div>`).join("")}
        ${r.printed.round ? `<div class="rr"><span>Round off</span><span>${rs(r.printed.round)}</span></div>` : ""}
        <div class="rr t"><span>Our total</span><span>${rs(a.ourTotal)}</span></div>
        <div class="rr"><span>Printed total</span><span>${rs(r.printed.total)}</span></div>
        <div class="rr t" style="color:${r.printed.total === a.ourTotal ? "var(--ok)" : "var(--bad)"}"><span style="color:inherit">Difference</span><span>${rs(r.printed.total - a.ourTotal)}</span></div>
      </div>
    </div>

    <div class="result-card" data-reveal>
      <h3>Findings</h3>
      <p class="muted" style="margin:-6px 0 18px;font-size:15px">Tap any finding to see the calculation, the rule and what to do.</p>
      ${a.findings.map((f, i) => `
        <div class="finding ${i === 0 && f.status !== "ok" ? "open" : ""}">
          <button class="finding-h">${STATUS[f.status].mark}
            <span class="ft">${f.title}<small>${f.sub}</small></span>
            <span class="tag ${f.status}">${STATUS[f.status].label}</span><span class="chev">⌄</span>
          </button>
          <div class="finding-b"><div><div class="in2">
            <p>${f.explain}</p>
            <dl>
              <dt>Calculation</dt><dd class="mono" style="font-size:13.5px">${f.calc}</dd>
              <dt>Rule / basis</dt><dd>${f.rule}</dd>
              <dt>Confidence</dt><dd>${f.conf}</dd>
              ${f.missing ? `<dt>Missing info</dt><dd>${f.missing}</dd>` : ""}
              <dt>What to do</dt><dd><b>${f.action}</b></dd>
            </dl>
          </div></div></div>
        </div>`).join("")}
    </div>

    <div class="result-card" data-reveal>
      <h3>Next steps</h3>
      <div class="actions-grid">
        <button class="act" data-act="msg">Generate clarification message<small>Polite, factual, editable</small></button>
        <a class="act" href="${appLink("#split")}">Split this bill<small>Opens in the PayRight app</small></a>
        <a class="act" href="${appLink("#ask")}">Ask PayRight<small>Questions about a charge</small></a>
        <a class="act" href="${appLink("#complaints")}">Start a complaint<small>Evidence is attached for you</small></a>
        <button class="act" data-act="print">Export report<small>Save as PDF</small></button>
        <a class="act" href="login.html?mode=signup">Save this audit<small>Create a free account</small></a>
      </div>
    </div>`;

  $("results").querySelectorAll(".finding-h").forEach(h => h.onclick = () => h.parentElement.classList.toggle("open"));
  $("editBtn").onclick = () => { editing = !editing; renderResults(false); };
  $("results").querySelectorAll("input[data-q],input[data-u]").forEach(inp => inp.onchange = () => {
    const i = +(inp.dataset.q ?? inp.dataset.u);
    if (inp.dataset.q !== undefined) current.items[i][1] = Math.max(0, parseInt(inp.value) || 0);
    else current.items[i][2] = Math.max(0, toPaise(inp.value || "0"));
    result = audit(current); renderReceipt(false); renderResults(false);
  });
  $("results").querySelector('[data-act="msg"]').onclick = openMessage;
  $("results").querySelector('[data-act="print"]').onclick = () => window.print();

  requestAnimationFrame(() => $("results").querySelectorAll("[data-reveal]").forEach((el, i) => {
    el.style.setProperty("--d", (scrollTo ? i * .08 : 0) + "s"); el.classList.add("in");
  }));
  if (scrollTo && innerWidth <= 1020) $("results").scrollIntoView({ behavior: "smooth" });
}

function openMessage() {
  const text = clarificationMessage(current, result);
  $("msgText").value = text;
  $("waMsg").href = "https://wa.me/?text=" + encodeURIComponent(text);
  $("msgModal").classList.add("open");
}

document.addEventListener("DOMContentLoaded", () => {
  renderPicker(); renderReceipt(false); renderStages(-1);
  $("runBtn").onclick = run;
  $("pdfInput").onchange = e => handlePdf(e.target.files[0]);
  $("copyMsg").onclick = () => {
    const t = $("msgText"); t.select();
    (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast("Message copied")).catch(() => { document.execCommand("copy"); toast("Message copied"); });
  };
  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => b.closest(".modal").classList.remove("open"));
  $("msgModal").onclick = e => { if (e.target.id === "msgModal") e.target.classList.remove("open"); };
  // drag-and-drop a PDF anywhere on the page
  addEventListener("dragover", e => e.preventDefault());
  addEventListener("drop", e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handlePdf(f); });
  const q = new URLSearchParams(location.search).get("r");
  const found = RECEIPTS.findIndex(r => r.id === q);
  if (found > 0) select(RECEIPTS[found]);
});
