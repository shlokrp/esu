/* ===========================================================
   PayRight — Mobile app
   A single-page web app: screens are plain functions that
   return HTML. The bill engine (PDF reading + audit) is in
   billcore.js. All money is in PAISE (integers).
   =========================================================== */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sum = (arr, f = x => x) => arr.reduce((s, x) => s + f(x), 0);
const clone = o => JSON.parse(JSON.stringify(o));
const initials = n => String(n).trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
const CAT = { restaurant: "Restaurant", hospital: "Hospital", grocery: "Grocery", delivery: "Delivery" };
const CAT_THUMB = { restaurant: "t1", hospital: "t5", grocery: "t3", delivery: "t2" };

/* ===========================================================
   STARTING DATA — bills, merchants, groups and complaints
   =========================================================== */
const GST5 = [["CGST", 250], ["SGST", 250]];
function feeKind(name) {
  return /service/i.test(name) ? "service" : /packag|packing/i.test(name) ? "packaging" : /platform|convenience/i.test(name) ? "platform" : /delivery/i.test(name) ? "delivery" : "other";
}
function mk(o) {
  const sub = sum(o.items, i => i[1] * i[2]);
  const ps = o.subtotal ?? sub;
  const disc = o.disc ? ofBp(sub, o.disc[1]) : 0;
  const base = ps - disc + (o.taxExtra || 0);
  const taxes = (o.taxes || []).map(([name, bp]) => ({ name, bp, amt: ofBp(base, bp) }));
  const fees = (o.fees || []).map(([name, amt]) => ({ name, amt, kind: feeKind(name) }));
  const pre = ps - disc + sum(taxes, t => t.amt) + sum(fees, f => f.amt);
  const round = o.roundRupee === false ? 0 : Math.round(pre / 100) * 100 - pre;
  return {
    id: o.id, mId: o.mId, merchant: o.merchant, place: o.place, category: o.category || "restaurant",
    date: o.date, iso: o.iso, dineIn: o.dineIn ?? true, stayDays: o.stayDays || null, admitted: o.admitted, discharged: o.discharged,
    items: o.items, extra: [], source: "history",
    printed: { subtotal: ps, discount: o.disc ? { name: `${o.disc[0]} (${o.disc[1] / 100}%)`, bp: o.disc[1], amt: disc } : null, taxes, fees, round, total: o.total ?? pre + round },
  };
}

const SEED_BILLS = [
  mk({ id: "b1", mId: "coastal", merchant: "The Coastal Table", place: "Bandra West, Mumbai", date: "14-10-2026 · 21:42", iso: "2026-10-14",
    items: [["Prawn Koliwada", 1, 42000], ["Fish Curry Rice", 1, 38000], ["Neer Dosa", 2, 9000], ["Sol Kadhi", 2, 8000], ["Bebinca", 2, 25000]],
    fees: [["Service Charge 10%", 16400]], taxes: GST5 }),
  mk({ id: "b2", mId: "citycare", merchant: "CityCare Clinic & Diagnostics", place: "Jayanagar, Bengaluru", date: "11-10-2026 · 09:20", iso: "2026-10-11", category: "hospital", dineIn: false,
    items: [["Consultation", 1, 70000], ["Lipid Profile", 1, 90000], ["Thyroid Panel", 1, 65000], ["Vitamin D Test", 1, 120000]],
    fees: [["Registration Fee", 10000], ["Convenience Charge", 5000]], taxes: [["CGST", 900], ["SGST", 900]] }),
  mk({ id: "b3", mId: "brew", merchant: "Brew & Bloom Cafe", place: "Koramangala, Bengaluru", date: "09-10-2026 · 16:05", iso: "2026-10-09",
    items: [["Cold Coffee 350ml", 2, 22000], ["Avocado Toast", 1, 28000], ["Masala Fries", 1, 14000]], subtotal: 90000, taxes: GST5 }),
  mk({ id: "b4", mId: "sunrise", merchant: "Sunrise Multispeciality Hospital", place: "Andheri East, Mumbai", date: "06-10-2026 · 12:40", iso: "2026-10-06", category: "hospital", dineIn: false,
    stayDays: 3, admitted: "03-10-2026", discharged: "06-10-2026",
    items: [["Room Rent Twin Sharing", 4, 350000], ["Nursing Charges", 3, 60000], ["Doctor Visit", 3, 80000], ["CBC Test", 1, 45000], ["CBC Test", 1, 45000],
      ["Chest X-Ray", 1, 90000], ["Paracetamol 500", 15, 250, 200], ["Pantoprazole 40", 10, 1450, 1450], ["IV Set", 2, 18000]],
    fees: [["Admin Charges", 150000], ["Miscellaneous Charges", 75000]] }),
  mk({ id: "b5", mId: "tandoor", merchant: "Tandoor Lane", place: "Connaught Place, New Delhi", date: "02-10-2026 · 20:18", iso: "2026-10-02",
    items: [["Paneer Tikka", 1, 32000], ["Dal Makhani", 1, 29000], ["Butter Naan", 3, 9000], ["Butter Naan", 3, 9000], ["Jeera Rice", 1, 20000]],
    disc: ["FLAT10", 1000], fees: [["Packaging Charge", 4000]], taxes: GST5 }),
  mk({ id: "b6", mId: "greenbasket", merchant: "Green Basket Grocers", place: "Sector 18, Noida", date: "28-09-2026 · 19:05", iso: "2026-09-28", category: "grocery", dineIn: false,
    items: [["Basmati 5kg", 1, 56000, 54000], ["Refined Oil 1L", 2, 16500, 17500], ["Toor Dal 1kg", 1, 15800, 16000], ["Table Butter", 1, 28500, 28500]],
    fees: [["Carry Bag Charge", 1000]], roundRupee: false }),
  mk({ id: "b7", mId: "seabreeze", merchant: "Seabreeze Grill", place: "Calangute, Goa", date: "21-09-2026 · 13:30", iso: "2026-09-21",
    items: [["Grilled Fish", 1, 65000], ["Caesar Salad", 1, 34000], ["Fresh Lime Soda", 2, 12000]], fees: [["Service Charge 10%", 12300]], taxExtra: 12300, taxes: GST5 }),
  mk({ id: "b8", mId: "chaitapri", merchant: "Chai Tapri Co.", place: "FC Road, Pune", date: "20-09-2026 · 17:45", iso: "2026-09-20",
    items: [["Cutting Chai", 2, 2000], ["Bun Maska", 1, 6000]], taxes: GST5 }),
  mk({ id: "b9", mId: "urbanbites", merchant: "Urban Bites Kitchen", place: "Powai, Mumbai", date: "30-08-2026 · 22:10", iso: "2026-08-30", category: "delivery", dineIn: false,
    items: [["Veg Dum Biryani", 1, 24900], ["Boondi Raita", 1, 4900]], fees: [["Delivery Fee", 3500], ["Platform Fee", 1000], ["Packaging Charge", 1500]], taxes: GST5 }),
];

const MERCHANTS = [
  { id: "coastal", name: "The Coastal Table", cat: "restaurant", area: "Bandra West, Mumbai", receipts: 64, users: 51,
    scores: { billing: 84, response: 72, pricing: 90 }, rating: 4.4, trend: [9, 8, 7, 6, 5, 4],
    patterns: ["Service charge appears on most receipts. It is calculated correctly and GST is not charged on it."],
    response: "“Service charge is optional — please ask our staff to remove it.” — Merchant response, Sep 2026" },
  { id: "sunrise", name: "Sunrise Multispeciality Hospital", cat: "hospital", area: "Andheri East, Mumbai", receipts: 37, users: 34,
    scores: { billing: 58, response: 64, pricing: 49 }, rating: 3.9, trend: [22, 25, 21, 24, 19, 18],
    patterns: ["Several independently submitted bills show room rent billed for more days than the admission dates suggest. The hospital's day-counting policy is under review.",
      "Lump-sum “Admin” and “Miscellaneous” charges appear without an itemised breakdown on most submitted bills."],
    response: "No response from the merchant yet." },
  { id: "tandoor", name: "Tandoor Lane", cat: "restaurant", area: "Connaught Place, New Delhi", receipts: 41, users: 36,
    scores: { billing: 68, response: 81, pricing: 77 }, rating: 4.1, trend: [15, 14, 16, 12, 11, 10],
    patterns: ["A packaging charge appears on several dine-in receipts. The applicable treatment remains under review."],
    response: "“Packaging charge applies to takeaway only. We've corrected our billing system.” — Merchant response, Oct 2026" },
  { id: "brew", name: "Brew & Bloom Cafe", cat: "restaurant", area: "Koramangala, Bengaluru", receipts: 23, users: 20,
    scores: { billing: 61, response: 88, pricing: 70 }, rating: 4.2, trend: [12, 15, 18, 14, 16, 9],
    patterns: ["4 independently submitted receipts show a subtotal higher than the sum of items."],
    response: "“A POS issue added a ₹40 line in error. Fixed on 12 Oct; affected customers refunded.” — Merchant response" },
  { id: "citycare", name: "CityCare Clinic & Diagnostics", cat: "hospital", area: "Jayanagar, Bengaluru", receipts: 14, users: 12,
    scores: null, rating: 4.0, trend: [], patterns: [], response: "" },
  { id: "greenbasket", name: "Green Basket Grocers", cat: "grocery", area: "Sector 18, Noida", receipts: 29, users: 22,
    scores: { billing: 74, response: 55, pricing: 66 }, rating: 3.8, trend: [10, 12, 9, 11, 10, 8],
    patterns: ["Some receipts show items billed slightly above the printed MRP."], response: "No response from the merchant yet." },
  { id: "seabreeze", name: "Seabreeze Grill", cat: "restaurant", area: "Calangute, Goa", receipts: 18, users: 17,
    scores: { billing: 63, response: 40, pricing: 72 }, rating: 4.3, trend: [14, 17, 16, 18, 15, 17],
    patterns: ["GST appears to be calculated on food plus service charge on several receipts."], response: "No response from the merchant yet." },
  { id: "chaitapri", name: "Chai Tapri Co.", cat: "restaurant", area: "FC Road, Pune", receipts: 9, users: 9, scores: null, rating: 4.6, trend: [], patterns: [], response: "" },
  { id: "urbanbites", name: "Urban Bites Kitchen", cat: "delivery", area: "Powai, Mumbai", receipts: 12, users: 11, scores: null, rating: 4.0, trend: [], patterns: [], response: "" },
];

const PRICES = [
  { item: "Cold Coffee", size: "350 ml", match: "High", rows: [["Brew & Bloom Cafe", "Your bill · 09 Oct", 22000, true], ["Kettle House", "Menu · updated 12 Oct", 18000], ["Bean Street", "Menu · updated 05 Oct", 19500]] },
  { item: "Paracetamol 500mg", size: "strip of 15", match: "High", rows: [["Sunrise Hospital pharmacy", "Your bill · 06 Oct", 3750, true], ["Printed MRP", "On your bill", 3000], ["Neighbourhood pharmacy", "Shelf price · 02 Oct", 2800]] },
  { item: "CBC Blood Test", size: "single test", match: "Medium", rows: [["Sunrise Hospital", "Your bill · 06 Oct", 45000, true], ["CityCare Diagnostics", "Rate card · 01 Oct", 35000], ["LabOne Pathology", "Rate card · 20 Sep", 30000]] },
  { item: "Butter Naan", size: "1 piece", match: "Medium", rows: [["Tandoor Lane", "Your bill · 02 Oct", 9000, true], ["Lahori Hearth", "Menu · updated 28 Sep", 7500], ["Dilli Tadka Corner", "Menu · updated 15 Sep", 8000]] },
  { item: "Prawn Koliwada", size: "serving sizes differ", match: "Low", rows: [["The Coastal Table", "Your bill · full plate", 42000, true], ["Konkan Kitchen", "Menu · half plate", 26000]] },
];

const OFFERS = [
  { m: "The Coastal Table", big: "15% off", what: "on food, weekday lunches", min: "₹1,000", exp: "30 Nov 2026", pay: "Any", src: "Listed by merchant", ver: "20 Oct" },
  { m: "CityCare Diagnostics", big: "₹300 off", what: "full-body health package", min: "None", exp: "31 Dec 2026", pay: "UPI", src: "Listed by merchant", ver: "18 Oct" },
  { m: "Brew & Bloom Cafe", big: "1 + 1", what: "on cold coffees after 4 pm", min: "None", exp: "15 Nov 2026", pay: "Any", src: "Listed by merchant", ver: "22 Oct" },
  { m: "Green Basket Grocers", big: "₹100 off", what: "first order above ₹1,500", min: "₹1,500", exp: "30 Nov 2026", pay: "Card", src: "Listed by merchant", ver: "15 Oct" },
];

const COMPLAINT_FLOW = ["Draft", "Ready to send", "Sent to merchant", "Awaiting response", "Merchant responded", "Resolved", "Escalation prepared", "Submitted to authority", "Closed"];

function seedState() {
  const ev = (s, d, n) => ({ s, d, n: n || "" });
  return {
    v: 5, name: "Aarav", onboarded: false, plan: "free", exploreTab: "merchants", splitTab: "groups",
    bills: clone(SEED_BILLS),
    groups: [
      { id: "g1", name: "Flatmates · Powai", members: ["You", "Riya", "Kabir", "Meera"], expenses: [
        { id: "e1", desc: "Monthly groceries", amt: 240000, by: "Riya", date: "2026-10-12", shares: null },
        { id: "e2", desc: "Wi-Fi bill", amt: 118000, by: "You", date: "2026-10-05", shares: null },
        { id: "e3", desc: "Dinner · The Coastal Table", amt: 188600, by: "Kabir", date: "2026-10-14", shares: null, billId: "b1" }], settlements: [] },
      { id: "g2", name: "Goa trip '26", members: ["You", "Ishaan", "Zoya", "Kabir"], expenses: [
        { id: "e4", desc: "Villa · 2 nights", amt: 1200000, by: "Ishaan", date: "2026-09-20", shares: null },
        { id: "e5", desc: "Scooter rental", amt: 240000, by: "You", date: "2026-09-20", shares: null },
        { id: "e6", desc: "Lunch · Seabreeze Grill", amt: 142100, by: "Zoya", date: "2026-09-21", shares: null, billId: "b7" }],
        settlements: [{ from: "Kabir", to: "Ishaan", amt: 300000, date: "2026-09-25", note: "UPI" }] },
      { id: "g3", name: "Office lunch", members: ["You", "Neha", "Arjun"], expenses: [
        { id: "e7", desc: "Thali Tuesday", amt: 90000, by: "Neha", date: "2026-10-08", shares: null },
        { id: "e8", desc: "Coffee · Brew & Bloom", amt: 94500, by: "You", date: "2026-10-09", shares: null, billId: "b3" }], settlements: [] },
    ],
    complaints: [
      { id: "PR-2051", billId: "b4", merchant: "Sunrise Multispeciality Hospital", title: "Extra room-rent day & unitemised charges", amt: 575000, status: "Awaiting response", refund: 0,
        events: [ev("Draft", "07 Oct"), ev("Ready to send", "07 Oct", "Bill, audit and discharge summary attached"), ev("Sent to merchant", "08 Oct", "Emailed to the billing desk by you"), ev("Awaiting response", "08 Oct")] },
      { id: "PR-2044", billId: "b3", merchant: "Brew & Bloom Cafe", title: "Subtotal ₹40 higher than items", amt: 4200, status: "Resolved", refund: 4200,
        events: [ev("Draft", "09 Oct"), ev("Sent to merchant", "09 Oct", "Shown to the manager at the counter"), ev("Merchant responded", "12 Oct", "“A POS error. Refunded to your UPI.”"), ev("Resolved", "12 Oct", "Refund of ₹42.00 recorded by you")] },
      { id: "PR-2039", billId: "b5", merchant: "Tandoor Lane", title: "Butter Naan billed twice", amt: 25516, status: "Resolved", refund: 25500,
        events: [ev("Draft", "02 Oct"), ev("Sent to merchant", "03 Oct", "Emailed by you"), ev("Merchant responded", "05 Oct", "“Duplicate entry confirmed.”"), ev("Resolved", "05 Oct", "Refund of ₹255.00 recorded by you")] },
      { id: "PR-2031", billId: "b7", merchant: "Seabreeze Grill", title: "GST charged on service charge", amt: 12916, status: "Escalation prepared", refund: 0,
        events: [ev("Draft", "21 Sep"), ev("Sent to merchant", "22 Sep", "Emailed by you"), ev("Awaiting response", "22 Sep"), ev("Escalation prepared", "06 Oct", "NCH complaint pack downloaded — not submitted by PayRight")] },
      { id: "PR-2058", billId: "b2", merchant: "CityCare Clinic & Diagnostics", title: "Which items was GST charged on?", amt: 62100, status: "Draft", refund: 0, events: [ev("Draft", "11 Oct")] },
    ],
    notifs: [
      { t: "Sunrise Hospital: day 6 with no reply", d: "Consider the escalation guidance in your complaint.", time: "2h", read: false, go: ["complaint", "PR-2051"] },
      { t: "Riya added “Monthly groceries”", d: "Your share: ₹600.00 in Flatmates · Powai", time: "1d", read: false, go: ["group", "g1"] },
      { t: "Audit ready: CityCare Clinic", d: "1 thing worth a question.", time: "2d", read: true, go: ["audit", "b2"] },
      { t: "Brew & Bloom responded", d: "Refund of ₹42.00 recorded.", time: "3w", read: true, go: ["complaint", "PR-2044"] },
    ],
    settings: { notifAudit: true, notifComplaint: true, notifSettle: true, saveHistory: true, redact: true },
    chat: [],
  };
}

/* ---------- state + persistence ---------- */
let S;
try { S = JSON.parse(localStorage.getItem("pr-app")); } catch (e) {}
if (!S || S.v !== 5) S = seedState();
try { const n = localStorage.getItem("pr-name"); if (n && !S._namedFromSite) { S.name = n; S._namedFromSite = 1; } } catch (e) {}
function save() { try { localStorage.setItem("pr-app", JSON.stringify(S)); } catch (e) {} }

let draft = null;          // a scanned bill not yet saved
const splits = {};         // split-screen state per bill
const audits = {};         // cached audit results
function getBill(id) { return (draft && draft.id === id) ? draft : S.bills.find(b => b.id === id); }
function auditOf(b) { const k = b.id + JSON.stringify(b.items); return audits[k] || (audits[k] = audit(b)); }
const merchantOf = b => MERCHANTS.find(m => m.id === b.mId) || MERCHANTS.find(m => m.name.toLowerCase() === b.merchant.toLowerCase());

/* ===========================================================
   ROUTER
   =========================================================== */
let stack = [];
const ROOT_TABS = { home: "home", groups: "groups", explore: "explore", profile: "profile" };

function render(mode) {
  const top = stack[stack.length - 1];
  const def = SCREENS[top.name](top.p || {});
  const host = $("#screens");
  const old = [...host.children];
  const el = document.createElement("div");
  el.className = "screen" + (def.tabs ? "" : " no-tabs");
  el.innerHTML = def.html;
  if (mode !== "none") el.classList.add("enter-" + mode);
  let keepScroll = 0;
  if (mode === "none" && old[0]) keepScroll = (old[old.length - 1].querySelector(".scroll") || {}).scrollTop || 0;
  host.appendChild(el);
  if (mode === "push" || mode === "up") setTimeout(() => old.forEach(o => o.remove()), 460);
  else old.forEach(o => o.remove());
  if (keepScroll) { const sc = el.querySelector(".scroll"); if (sc) sc.scrollTop = keepScroll; }

  $("#tabbar").classList.toggle("hidden", !def.tabs);
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.tab === top.name));
  $("#statusbar").classList.toggle("light", !!def.dark);
  if (def.after) def.after(el);
  save();
}
function go(name, p, mode = "push") { stack.push({ name, p }); render(mode); }
function replace(name, p) { stack[stack.length - 1] = { name, p }; render("fade"); }
function back() { if (stack.length > 1) { stack.pop(); render("pop"); } else tabGo("home"); }
function tabGo(name) {
  if (name === "scan") return go("scan", {}, "up");
  stack = [{ name }]; render("fade");
}
function refresh() { render("none"); }

/* ---------- sheet + toast ---------- */
function openSheet(html, after) {
  const sh = $("#sheet");
  sh.innerHTML = '<div class="grab"></div>' + html;
  sh.classList.add("on"); $("#scrim").classList.add("on");
  if (after) after(sh);
}
function closeSheet() { $("#sheet").classList.remove("on"); $("#scrim").classList.remove("on"); }
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2400);
}
function download(name, text, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function copy(text) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast("Copied")).catch(() => toast("Copy not available — select the text instead"));
}

/* ===========================================================
   SHARED BITS
   =========================================================== */
const topBar = (title, right = "") => `<div class="topbar"><button class="back" data-back aria-label="Back">←</button><span class="t">${title}</span>${right}</div>`;
function billRow(b) {
  const a = auditOf(b);
  return `<button class="row" data-go="audit" data-p="${b.id}">
    <span class="thumb ${CAT_THUMB[b.category] || "t1"}">${esc(b.merchant[0])}</span>
    <span class="grow"><b>${esc(b.merchant)}</b><small>${CAT[b.category] || ""} · ${esc(b.date.split(" · ")[0])}</small></span>
    <span style="text-align:right"><span class="amt">${rsShort(b.printed.total)}</span><br><span class="tag ${a.worst}">${STATUS[a.worst].label}</span></span>
  </button>`;
}
const avClass = (g, name) => "c" + (g.members.indexOf(name) % 6);

/* ---------- group balances (deterministic, in paise) ---------- */
function equalShares(amt, members) {
  const base = Math.floor(amt / members.length), rem = amt - base * members.length;
  const out = {}; members.forEach((m, i) => out[m] = base + (i < rem ? 1 : 0)); return out;
}
function groupNet(g) {
  const net = {}; g.members.forEach(m => net[m] = 0);
  g.expenses.forEach(e => {
    const sh = e.shares || equalShares(e.amt, g.members);
    net[e.by] += e.amt;
    Object.entries(sh).forEach(([m, v]) => net[m] -= v);
  });
  g.settlements.forEach(s => { net[s.from] += s.amt; net[s.to] -= s.amt; });
  return net;
}
function simplify(net) {
  const cr = [], dr = [], out = [];
  Object.entries(net).forEach(([m, v]) => { if (v > 0) cr.push([m, v]); else if (v < 0) dr.push([m, -v]); });
  cr.sort((a, b) => b[1] - a[1]); dr.sort((a, b) => b[1] - a[1]);
  let i = 0, j = 0;
  while (i < dr.length && j < cr.length) {
    const x = Math.min(dr[i][1], cr[j][1]);
    if (x > 0) out.push({ from: dr[i][0], to: cr[j][0], amt: x });
    dr[i][1] -= x; cr[j][1] -= x;
    if (!dr[i][1]) i++; if (!cr[j][1]) j++;
  }
  return out;
}
function myTotals() {
  let owe = 0, owed = 0;
  S.groups.forEach(g => { const n = groupNet(g).You || 0; if (n > 0) owed += n; else owe -= n; });
  return { owe, owed };
}

/* ---------- item-wise split allocation ---------- */
function computeSplit(b, st) {
  const a = auditOf(b);
  const n = st.people.length;
  const svc = sum(b.printed.fees.filter(f => f.kind === "service"), f => f.amt);
  const total = a.ourTotal - (st.includeService ? 0 : svc);
  const owed = Array(n).fill(0);
  if (st.method === "equal") {
    const base = Math.floor(total / n); let rem = total - base * n;
    return { per: owed.map((_, i) => base + (i < rem ? 1 : 0)), total, unassigned: [] };
  }
  const itemShare = Array(n).fill(0), unassigned = [];
  a.lines.forEach((l, i) => {
    const who = st.assign[i] || [];
    if (!who.length) { unassigned.push(l.name); return; }
    const base = Math.floor(l.total / who.length); let rem = l.total - base * who.length;
    who.forEach(p => { itemShare[p] += base + (rem-- > 0 ? 1 : 0); });
  });
  const itemsTotal = sum(itemShare);
  if (!itemsTotal) return { per: owed, total, unassigned };
  // shared extras (tax, fees, discount, round) spread in proportion to items — largest remainder keeps it exact
  const raw = itemShare.map(s => s * total / itemsTotal);
  const per = raw.map(Math.floor);
  let rest = total - sum(per);
  raw.map((v, i) => [v - Math.floor(v), i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (rest-- > 0) per[i]++; });
  return { per, total, unassigned };
}

/* ===========================================================
   SCREENS
   =========================================================== */
const SCREENS = {};

/* ---------- onboarding ---------- */
let onbIdx = 0;
const ONB = [
  { art: '<div class="big-word">₹?</div>', h: "Understand every bill.", p: "Restaurant, hospital or grocery — see exactly what each line is for." },
  { art: '<div class="big-word" style="font-size:96px">1,886<br><span style="color:var(--ok)">✓</span></div>', h: "Spot what doesn't add up.", p: "We rebuild the bill from scratch and never trust the printed total blindly." },
  { art: '<div style="display:flex;gap:-10px"><span class="av c0" style="width:76px;height:76px;font-size:26px">A</span><span class="av c1" style="width:76px;height:76px;font-size:26px;margin-left:-16px">R</span><span class="av c2" style="width:76px;height:76px;font-size:26px;margin-left:-16px">K</span></div>', h: "Split it fairly.", p: "Assign dishes to friends. Tax and fees are shared down to the paisa." },
  { art: '<div class="big-word" style="font-size:90px">Know<br>your<br>rights.</div>', h: "Act with evidence.", p: "Polite messages, complaint tracking and sources you can trust." },
];
SCREENS.onboard = () => ({
  html: `<div class="onb">
    <div class="onb-slides">${ONB.map((s, i) => `<div class="onb-slide ${i === onbIdx ? "on" : i < onbIdx ? "past" : ""}"><div class="art">${s.art}</div><h1>${s.h}</h1><p>${s.p}</p></div>`).join("")}</div>
    <div class="dots">${ONB.map((_, i) => `<i class="${i === onbIdx ? "on" : ""}"></i>`).join("")}</div>
    <div class="btn-row"><button class="btn ghost" data-act="onbSkip">Skip</button><button class="btn pri" data-act="onbNext">${onbIdx === ONB.length - 1 ? "Get started" : "Next"}</button></div>
  </div>`,
});

SCREENS.auth = () => ({
  html: `<div class="scroll stag" style="padding-top:80px">
    <div class="h1" style="font-size:46px">Scan before<br>you <span class="ital">pay.</span></div>
    <p class="sub" style="margin:12px 0 24px;font-size:16px">Create a free account to save bills and groups.</p>
    <div><label class="lbl">Your first name</label><input class="inp" id="aName" value="${esc(S.name)}"></div>
    <div><label class="lbl">Email</label><input class="inp" id="aEmail" type="email" placeholder="you@example.com"></div>
    <div><label class="lbl">Password</label><input class="inp" id="aPass" type="password" placeholder="At least 8 characters"></div>
    <div style="margin-top:20px"><button class="btn pri full" data-act="authGo">Create account</button></div>
    <div class="btn-row" style="margin-top:10px"><button class="btn ghost" data-act="authProvider">Google</button><button class="btn ghost" data-act="authProvider">Apple</button></div>
    <div style="margin-top:10px"><button class="btn ghost full" data-act="authGuest">Continue as guest</button></div>
  </div>`,
});

/* ---------- home ---------- */
SCREENS.home = () => {
  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const attention = S.bills.filter(b => ["rev", "unx"].includes(auditOf(b).worst)).slice(0, 3);
  const issues = S.bills.filter(b => ["rev", "unx"].includes(auditOf(b).worst)).length;
  const refunds = sum(S.complaints, c => c.refund || 0);
  const value = sum(S.bills, b => b.printed.total);
  const t = myTotals();
  const unread = S.notifs.some(n => !n.read);
  return {
    tabs: true,
    html: `<div class="scroll stag">
      <div class="hello">
        <div><span class="sub">${greet},</span><div class="h1">${esc(S.name)}</div></div>
        <div style="display:flex;gap:8px">
          <button class="icon-btn" data-go="notifications" aria-label="Notifications"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4"/></svg>${unread ? '<span class="dot"></span>' : ""}</button>
          <button class="avatar" data-tab="profile">${initials(S.name)}</button>
        </div>
      </div>
      <button class="scan-hero" data-tab="scan">
        <div class="ring"></div>
        <span class="tag acc">Restaurants · Hospitals · Grocery</span>
        <h2>Scan before<br>you pay.</h2>
        <p>Upload a bill PDF and see every charge explained.</p>
        <span class="go">Scan a bill →</span>
      </button>
      <div class="stats">
        <div class="stat"><b>${S.bills.length}</b><small>Bills checked</small></div>
        <div class="stat"><b style="color:var(--bad)">${issues}</b><small>Bills with questions</small></div>
        <div class="stat"><b>${rsShort(Math.round(value / 100) * 100).replace(".00", "")}</b><small>Total value analysed</small></div>
        <div class="stat"><b style="color:var(--ok)">${rsShort(refunds)}</b><small>Documented refunds</small></div>
      </div>
      <div class="sec-t"><span class="h3">Group balances</span><button data-tab="groups">See all</button></div>
      <div class="balance-strip">
        <div class="owe"><small>You owe</small><b>${rsShort(t.owe)}</b></div>
        <div class="owed"><small>You're owed</small><b>${rsShort(t.owed)}</b></div>
      </div>
      ${attention.length ? `<div class="sec-t"><span class="h3">Needs your attention</span><button data-go="bills">All bills</button></div>
      <div class="list-card">${attention.map(billRow).join("")}</div>` : ""}
      <div class="sec-t"><span class="h3">Shortcuts</span></div>
      <div class="shortcuts">
        <button class="shortcut" data-go="ask"><span class="big">Ask</span>Ask PayRight<small>Questions about a charge</small></button>
        <button class="shortcut" data-go="complaints"><span class="big">${S.complaints.filter(c => !["Resolved", "Closed"].includes(c.status)).length}</span>Open complaints<small>Track every step</small></button>
        <button class="shortcut" data-go="insights"><span class="big">↗</span>Insights<small>Your spending</small></button>
        <button class="shortcut" data-go="bills"><span class="big">${S.bills.length}</span>My bills<small>Search &amp; filter</small></button>
      </div>
      <div class="sec-t"><span class="h3">Recent bills</span><button data-go="bills">See all</button></div>
      <div class="list-card">${S.bills.slice(0, 4).map(billRow).join("")}</div>
    </div>`,
  };
};

/* ---------- scan (camera + PDF upload) ---------- */
let torch = false;
SCREENS.scan = () => ({
  dark: true,
  html: `<div class="camera">
    <div class="cam-view">
      <div class="cam-bg"></div>
      <div class="cam-top"><button data-back aria-label="Close">✕</button><button class="${torch ? "on" : ""}" data-act="torch" aria-label="Torch">ϟ</button></div>
      <div class="cam-hint" id="camHint">Point at a bill — or upload a PDF</div>
      <div class="cam-receipt">
        <b style="display:block;text-align:center;margin-bottom:6px">SUNRISE HOSPITAL</b>
        <div><span>Room Rent ×4</span><span>14000.00</span></div><div><span>Nursing ×3</span><span>1800.00</span></div>
        <div><span>Doctor Visit ×3</span><span>2400.00</span></div><div><span>CBC Test</span><span>450.00</span></div>
        <div><span>CBC Test</span><span>450.00</span></div><div><span>Admin Charges</span><span>1500.00</span></div>
        <div style="border-top:1px dashed #999;margin-top:4px;padding-top:4px"><b>TOTAL</b><b>22793.00</b></div>
      </div>
      <div class="frame" id="frame"><i></i><i></i><i></i><i></i></div>
      <button class="btn acc" data-act="pickPdf" style="position:absolute;bottom:22px;left:50%;translate:-50% 0;z-index:5;white-space:nowrap;box-shadow:0 14px 30px -10px #6D4BFF">Upload bill PDF</button>
      <div class="flash" id="flash"></div>
    </div>
    <div class="cam-bottom">
      <button class="side-b" data-act="pickPdf"><span class="box">PDF</span>Files</button>
      <button class="shutter" data-act="shutter" aria-label="Capture"><i></i></button>
      <button class="side-b" data-go="bills"><span class="box">≡</span>History</button>
    </div>
  </div>`,
  after() {
    setTimeout(() => { const h = $("#camHint"), f = $("#frame"); if (h) { h.textContent = "Bill detected · hold steady"; h.classList.add("ok"); f.classList.add("ok"); } }, 1600);
  },
});

/* ---------- processing ---------- */
SCREENS.process = p => {
  const steps = p.kind === "pdf"
    ? ["Uploading", "Reading PDF text", "Extracting fields", "Reconstructing amounts", "Checking rules", "Preparing report"]
    : ["Preparing image", "Reading bill", "Extracting fields", "Reconstructing amounts", "Checking rules", "Preparing report"];
  return {
    html: `<div class="scroll" style="padding-bottom:40px"><div class="proc">
      <span class="tag acc" style="align-self:flex-start">PDF · text read directly</span>
      <div class="h1" style="margin-top:14px">Checking<br><span class="ital">${esc(p.label || "your bill")}</span></div>
      <div class="proc-bar"><b id="pbar"></b></div>
      <ol class="proc-steps" id="psteps">${steps.map(s => `<li><span class="st"></span>${s}</li>`).join("")}</ol>
    </div></div>`,
    after(el) {
      const lis = el.querySelectorAll("#psteps li");
      let i = 0;
      const tick = () => {
        if (!el.isConnected) return;
        lis.forEach((li, k) => { li.className = k < i ? "done" : k === i ? "run" : ""; li.querySelector(".st").textContent = k < i ? "✓" : ""; });
        el.querySelector("#pbar").style.width = (i / lis.length * 100) + "%";
        if (i === lis.length) return setTimeout(() => replace("review", { id: p.id }), 300);
        i++; setTimeout(tick, 330 + Math.random() * 200);
      };
      tick();
    },
  };
};

/* ---------- review extracted fields ---------- */
SCREENS.review = p => {
  const b = getBill(p.id);
  const pdf = b.source === "pdf";
  return {
    html: `<div class="scroll stag">
      ${topBar("Check the details")}
      ${pdf ? `<div class="note" style="background:var(--ok-soft);color:var(--ok)">Read from ${esc(b.fileName)} — text taken directly from the PDF.</div>` : ""}
      <div class="card">
        <label class="lbl" style="margin-top:0">Merchant <span class="conf"><i><b style="--v:${pdf ? 100 : 96}%"></b></i>${pdf ? 100 : 96}%</span></label>
        <input class="inp" id="rvMerchant" value="${esc(b.merchant)}">
        <label class="lbl">Date</label><input class="inp" id="rvDate" value="${esc(b.date)}">
        <label class="lbl">Bill type</label>
        <div class="chips" id="rvCat">${Object.entries(CAT).map(([k, v]) => `<button class="chip ${b.category === k ? "on" : ""}" data-act="rvCat" data-k="${k}">${v}</button>`).join("")}</div>
      </div>
      <div class="sec-t"><span class="h3">${b.items.length} line items</span><span class="sub">qty · unit ₹</span></div>
      <div class="card" style="padding-top:4px;padding-bottom:4px">
        ${b.items.map((it, i) => `<div class="edit-line"><span class="nm">${esc(it[0])}${it[3] ? `<small class="sub">MRP ${rs(it[3])}</small>` : ""}</span>
          <input type="number" min="0" value="${it[1]}" data-act="rvQty" data-i="${i}"><input type="number" min="0" step="0.01" value="${(it[2] / 100).toFixed(2)}" data-act="rvUnit" data-i="${i}"></div>`).join("")}
      </div>
      <div class="card"><div class="recon-r"><span>Printed total</span><span>${rs(b.printed.total)}</span></div>
        <div class="recon-r t"><span>${b.printed.taxes.length} tax lines · ${b.printed.fees.length} fees</span><span></span></div></div>
      <p class="sub" style="margin:12px 2px">Your corrections are stored separately from what we read.</p>
      <button class="btn pri full" data-act="runAudit" data-p="${b.id}">Looks right — run audit</button>
    </div>`,
  };
};

/* ---------- audit report ---------- */
SCREENS.audit = p => {
  const b = getBill(p.id);
  if (!b) return SCREENS.home();
  const a = auditOf(b), c = a.counts;
  const saved = S.bills.some(x => x.id === b.id);
  const m = merchantOf(b);
  return {
    html: `<div class="scroll stag">
      ${topBar("Audit report", `<button class="icon-btn act-r" data-act="exportReport" aria-label="Export">↓</button>`)}
      <div class="audit-head">
        <div class="ring"></div>
        <span style="opacity:.7;font-size:13px;position:relative">${esc(b.merchant)} · ${esc(b.date.split(" · ")[0])}</span>
        <div class="big">${rs(b.printed.total)}</div>
        <span style="opacity:.7;font-size:13px;position:relative">Our total ${rs(a.ourTotal)} ${a.ourTotal === b.printed.total ? "· matches" : "· differs by " + rs(b.printed.total - a.ourTotal)}</span>
        <div class="h3">${headline(a)}</div>
        <div class="tagrow"><span class="tag plain">${CAT[b.category] || ""}${b.category === "hospital" ? " · beta" : ""}</span>${["rev", "unx", "opt", "need", "ok"].filter(s => c[s]).map(s => `<span class="tag ${s}">${c[s]} ${STATUS[s].label}</span>`).join("")}</div>
      </div>
      <div class="sec-t"><span class="h3">What's at stake</span></div>
      <div class="money-grid">
        <div><b>${rs(a.money.over)}</b><small>Confirmed arithmetic overcharge</small></div>
        <div><b>${rs(a.money.contest)}</b><small>Potentially contestable</small></div>
        <div><b>${rs(a.money.optional)}</b><small>Optional — your choice</small></div>
        <div><b>${rs(a.money.unexplained)}</b><small>Unexplained</small></div>
      </div>
      <p class="sub" style="font-size:12px;margin-top:8px">Never added together as money owed to you.</p>
      <div class="sec-t"><span class="h3">Findings</span><span class="sub">tap to expand</span></div>
      ${a.findings.map((f, i) => `<div class="fnd ${i === 0 && f.status !== "ok" ? "open" : ""}">
        <button class="fnd-h" data-act="toggleFnd">${STATUS[f.status].mark}<span class="grow"><b>${esc(f.title)}</b><small>${esc(f.sub)}</small></span><span class="chev">⌄</span></button>
        <div class="fnd-b"><div><div class="in">
          <span class="tag ${f.status}">${STATUS[f.status].label}</span>
          <p style="margin-top:8px">${f.explain}</p>
          <dl><dt>Calculation</dt><dd class="mono" style="font-size:12px">${f.calc}</dd>
          <dt>Rule / basis</dt><dd>${f.rule}</dd><dt>Confidence</dt><dd>${f.conf}</dd>
          ${f.missing ? `<dt>Missing info</dt><dd>${f.missing}</dd>` : ""}<dt>What to do</dt><dd><b>${f.action}</b></dd></dl>
          ${f.status !== "ok" ? `<div class="acts"><button class="btn sm ghost" data-act="askAbout" data-p="${b.id}" data-q="${esc(f.title)}">Ask about this</button><button class="btn sm pri" data-act="msgSheet" data-p="${b.id}">Draft a message</button></div>` : ""}
        </div></div></div>
      </div>`).join("")}
      <div class="sec-t"><span class="h3">Rebuilt from scratch</span></div>
      <div class="card">
        <div class="recon-r"><span>Items (${a.lines.length})</span><span>${rs(a.ourSub)}</span></div>
        ${a.ourDisc ? `<div class="recon-r"><span>Discount</span><span>−${rs(a.ourDisc)}</span></div>` : ""}
        ${b.printed.taxes.length ? `<div class="recon-r"><span>Tax</span><span>${rs(a.ourTax)}</span></div>` : ""}
        ${b.printed.fees.map(f => `<div class="recon-r"><span>${esc(f.name)}</span><span>${rs(f.amt)}</span></div>`).join("")}
        ${b.printed.round ? `<div class="recon-r"><span>Round off</span><span>${rs(b.printed.round)}</span></div>` : ""}
        <div class="recon-r t"><span>Our total</span><span>${rs(a.ourTotal)}</span></div>
      </div>
      <div class="sec-t"><span class="h3">Next steps</span></div>
      <div class="action-list">
        <button class="pri-a" data-go="split" data-p="${b.id}">Split this bill<small>Item-wise or equal</small></button>
        <button data-act="msgSheet" data-p="${b.id}">Clarification message<small>Polite &amp; editable</small></button>
        <button data-act="askAbout" data-p="${b.id}">Ask PayRight<small>About this bill</small></button>
        <button data-act="newComplaint" data-p="${b.id}">Start complaint<small>Evidence attached</small></button>
        <button data-act="openPrices">Compare prices<small>Like-for-like</small></button>
        ${m ? `<button data-go="merchant" data-p="${m.id}">Merchant profile<small>Transparency</small></button>` : `<button data-act="exportReport">Export report<small>Download</small></button>`}
      </div>
      <div style="margin-top:16px">${saved ? `<button class="btn ghost full" data-act="deleteBill" data-p="${b.id}">Delete from my bills</button>` : `<button class="btn pri full" data-act="saveBill" data-p="${b.id}">Save to my bills</button>`}</div>
    </div>`,
  };
};

/* ---------- split a bill ---------- */
SCREENS.split = p => {
  const b = getBill(p.id) || S.bills[0];
  const a = auditOf(b);
  const st = splits[b.id] || (splits[b.id] = {
    method: "items", people: ["You", "Riya", "Kabir"], payer: 0, includeService: true,
    assign: a.lines.map(() => [0, 1, 2]),
  });
  const r = computeSplit(b, st);
  const hasSvc = b.printed.fees.some(f => f.kind === "service");
  return {
    html: `<div class="scroll stag">
      ${topBar("Split the bill")}
      <div class="h2">${esc(b.merchant)}</div>
      <p class="sub" style="margin:4px 0 16px">Total to split <b class="amt" style="color:var(--ink)">${rs(r.total)}</b> · checked by PayRight</p>
      <div class="seg"><button class="${st.method === "items" ? "on" : ""}" data-act="splitMethod" data-k="items">Item-wise</button><button class="${st.method === "equal" ? "on" : ""}" data-act="splitMethod" data-k="equal">Equal</button></div>
      <div class="sec-t"><span class="h3">People</span><span class="sub">tap to rename</span></div>
      <div class="people">
        ${st.people.map((n, i) => `<button class="person" data-act="renamePerson" data-i="${i}"><span class="av c${i % 6}">${initials(n)}</span>${esc(n)}</button>`).join("")}
        <button class="person" data-act="addPerson"><span class="av add">+</span>Add</button>
      </div>
      ${st.method === "items" ? `<div class="sec-t"><span class="h3">Who had what?</span></div>
      <div class="card" style="padding-top:2px;padding-bottom:2px">
        ${a.lines.map((l, i) => `<div class="item-split"><div class="top"><span>${esc(l.name)}${l.qty > 1 ? " ×" + l.qty : ""}</span><span class="amt">${rs(l.total)}</span></div>
          <div class="who">${st.people.map((n, k) => `<button class="av c${k % 6} ${(st.assign[i] || []).includes(k) ? "on" : ""}" data-act="toggleAssign" data-i="${i}" data-k="${k}" title="${esc(n)}">${initials(n)}</button>`).join("")}</div></div>`).join("")}
      </div>` : ""}
      <div class="card" style="margin-top:12px;padding-top:2px;padding-bottom:2px">
        ${hasSvc ? `<div class="toggle-row"><div><b>Include service charge</b><small>It's optional — leave it out if it was removed</small></div><button class="switch ${st.includeService ? "on" : ""}" data-act="toggleSvc"></button></div>` : ""}
        <div class="toggle-row"><div><b>Paid by</b><small>Who settled the bill at the counter</small></div>
          <select class="inp" style="width:auto;padding:8px 12px" data-act="payer" id="payerSel">${st.people.map((n, i) => `<option value="${i}" ${i === st.payer ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
      </div>
      <div class="sec-t"><span class="h3">Each person pays</span></div>
      <div class="card" style="padding-top:0;padding-bottom:0">
        ${st.people.map((n, i) => `<div class="owe-row"><span class="av c${i % 6}">${initials(n)}</span><span class="grow"><b>${esc(n)}</b><small>${i === st.payer ? "Paid the bill" : "Owes " + esc(st.people[st.payer])}</small></span><span class="amt">${rs(r.per[i])}</span></div>`).join("")}
      </div>
      ${r.unassigned.length ? `<div class="note" style="margin-top:12px">Not assigned yet: ${r.unassigned.map(esc).join(", ")}</div>` : `<p class="sub" style="margin-top:8px;font-size:12px">Tax, fees and rounding shared in proportion to what each person ordered. Shares add up to exactly ${rs(sum(r.per))}.</p>`}
      <div class="btn-row" style="margin-top:16px"><button class="btn ghost" data-act="shareSplit" data-p="${b.id}">Share</button><button class="btn pri" data-act="saveSplit" data-p="${b.id}" ${r.unassigned.length ? "disabled style='opacity:.4'" : ""}>Add to a group</button></div>
    </div>`,
    after(el) { const s = el.querySelector("#payerSel"); s.onchange = () => { st.payer = +s.value; refresh(); }; },
  };
};

/* ---------- split tab: groups ---------- */
SCREENS.groups = () => {
  const t = myTotals();
  return {
    tabs: true,
    html: `<div class="scroll stag">
      <div class="h1" style="margin-bottom:16px">Split</div>
      <div class="balance-strip"><div class="owe"><small>You owe</small><b>${rsShort(t.owe)}</b></div><div class="owed"><small>You're owed</small><b>${rsShort(t.owed)}</b></div></div>
      <div class="btn-row" style="margin-top:12px"><button class="btn acc" data-act="pickSplitBill">Split a bill</button><button class="btn ghost" data-act="newGroup">New group</button></div>
      <div class="sec-t"><span class="h3">Your groups</span><span class="sub">${S.groups.length}</span></div>
      ${S.groups.map(g => {
        const n = groupNet(g).You || 0;
        return `<button class="group-card" data-go="group" data-p="${g.id}">
          <div class="gt"><b>${esc(g.name)}</b><span class="bal ${n > 0 ? "pos" : n < 0 ? "neg" : "zero"}">${n > 0 ? "you're owed " + rs(n) : n < 0 ? "you owe " + rs(-n) : "settled up"}</span></div>
          <div class="avs">${g.members.map((m, i) => `<span class="av c${i % 6}">${initials(m)}</span>`).join("")}</div>
          <p class="sub" style="margin-top:10px">${g.expenses.length} expenses · ${rsShort(sum(g.expenses, e => e.amt))} total</p>
        </button>`;
      }).join("")}
    </div>`,
  };
};

let groupTab = "balances";
SCREENS.group = p => {
  const g = S.groups.find(x => x.id === p.id);
  const net = groupNet(g), debts = simplify(net);
  const items = [...g.expenses.map(e => ({ ...e, type: "exp" })), ...g.settlements.map(s => ({ ...s, type: "set" }))].sort((a, b) => b.date.localeCompare(a.date));
  return {
    html: `<div class="scroll stag">
      ${topBar(esc(g.name))}
      <div class="avs" style="display:flex">${g.members.map((m, i) => `<span class="av c${i % 6}" style="width:44px;height:44px;margin-left:${i ? -10 : 0}px;border:3px solid var(--bg)">${initials(m)}</span>`).join("")}</div>
      <div class="stats"><div class="stat"><b>${rsShort(sum(g.expenses, e => e.amt))}</b><small>Total spent</small></div>
        <div class="stat"><b class="${(net.You || 0) >= 0 ? "" : ""}" style="color:${(net.You || 0) > 0 ? "var(--ok)" : (net.You || 0) < 0 ? "var(--bad)" : "var(--muted)"}">${rsShort(Math.abs(net.You || 0))}</b><small>${(net.You || 0) > 0 ? "You're owed" : (net.You || 0) < 0 ? "You owe" : "All settled"}</small></div></div>
      <div class="seg" style="margin-top:16px"><button class="${groupTab === "balances" ? "on" : ""}" data-act="groupTab" data-k="balances">Who owes whom</button><button class="${groupTab === "activity" ? "on" : ""}" data-act="groupTab" data-k="activity">Activity</button></div>
      ${groupTab === "balances" ? `<div class="card" style="margin-top:12px;padding-top:0;padding-bottom:0">
        ${debts.length ? debts.map(d => `<div class="owe-row"><span class="av ${avClass(g, d.from)}">${initials(d.from)}</span>
          <span class="grow"><b>${esc(d.from)} → ${esc(d.to)}</b><small>${rs(d.amt)}</small></span>
          <button class="btn sm ${d.from === "You" ? "acc" : "ghost"}" data-act="settleSheet" data-g="${g.id}" data-from="${esc(d.from)}" data-to="${esc(d.to)}" data-amt="${d.amt}">Settle</button></div>`).join("")
          : '<div class="empty"><div class="h2">All settled up.</div><p>Nobody owes anything in this group.</p></div>'}
      </div>
      <p class="sub" style="font-size:12px;margin-top:8px">Debts are simplified so the group needs the fewest payments.</p>` :
      `<div class="card" style="margin-top:12px"><div class="tl">${items.map(it => it.type === "exp"
        ? `<div class="tl-i done"><b>${esc(it.desc)} · ${rs(it.amt)}</b><small>${esc(it.by)} paid · ${it.date.slice(8)}-${it.date.slice(5, 7)} ${it.billId ? "· PayRight-checked" : ""}</small></div>`
        : `<div class="tl-i"><b>${esc(it.from)} paid ${esc(it.to)} · ${rs(it.amt)}</b><small>Recorded settlement · ${esc(it.note || "")} · ${it.date.slice(8)}-${it.date.slice(5, 7)}</small></div>`).join("")}</div></div>`}
      <div class="btn-row" style="margin-top:14px"><button class="btn pri" data-act="addExpense" data-g="${g.id}">Add expense</button><button class="btn ghost" data-act="pickSplitBill" data-g="${g.id}">From a bill</button></div>
      <p class="sub" style="font-size:12px;margin-top:12px;text-align:center">PayRight records settlements — it never moves money.</p>
    </div>`,
  };
};

/* ---------- explore ---------- */
let exploreQ = "", exploreCat = "all";
function merchantList() {
  const q = exploreQ.toLowerCase();
  const list = MERCHANTS.filter(m => (exploreCat === "all" || m.cat === exploreCat) && (!q || (m.name + m.area).toLowerCase().includes(q)));
  return list.length ? list.map(m => `<button class="row" data-go="merchant" data-p="${m.id}">
    <span class="thumb ${CAT_THUMB[m.cat]}">${m.name[0]}</span>
    <span class="grow"><b>${esc(m.name)}</b><small>${CAT[m.cat]} · ${esc(m.area)}</small></span>
    <span style="text-align:right">${m.scores ? `<span class="amt">${m.scores.billing}</span><br><small class="sub">billing</small>` : '<span class="tag need">Low data</span>'}</span></button>`).join("")
    : '<div class="empty"><div class="h2">No matches.</div><p>Try another name or area.</p></div>';
}
SCREENS.explore = () => {
  const tab = S.exploreTab;
  return {
    tabs: true,
    html: `<div class="scroll stag">
      <div class="h1" style="margin-bottom:16px">Explore</div>
      <div class="seg"><button class="${tab === "merchants" ? "on" : ""}" data-act="exploreTab" data-k="merchants">Merchants</button><button class="${tab === "prices" ? "on" : ""}" data-act="exploreTab" data-k="prices">Prices</button><button class="${tab === "offers" ? "on" : ""}" data-act="exploreTab" data-k="offers">Offers</button></div>
      ${tab === "merchants" ? `
        <div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input class="inp" id="mSearch" placeholder="Search merchants or areas" value="${esc(exploreQ)}"></div>
        <div class="chips" style="margin:12px 0">${[["all", "All"], ["restaurant", "Restaurants"], ["hospital", "Hospitals"], ["grocery", "Grocery"], ["delivery", "Delivery"]].map(([k, v]) => `<button class="chip ${exploreCat === k ? "on" : ""}" data-act="exploreCat" data-k="${k}">${v}</button>`).join("")}</div>
        <div class="list-card" id="mList">${merchantList()}</div>` : ""}
      ${tab === "prices" ? PRICES.map(c => `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="h3">${c.item}</span><span class="tag ${c.match === "High" ? "ok" : c.match === "Medium" ? "opt" : "rev"}">${c.match} match</span></div>
        <p class="sub">${c.size}</p>
        ${c.rows.map(r => `<div class="cmp-row"><span>${r[3] ? "<b>" : ""}${r[0]}${r[3] ? "</b>" : ""}<small>${r[1]}</small></span><span class="amt" style="${r[3] ? "color:var(--accent)" : ""}">${rs(r[2])}</span></div>`).join("")}
        ${c.match === "Low" ? '<p class="sub" style="font-size:12px;color:var(--bad)">Serving sizes differ — not a like-for-like comparison.</p>' : ""}
      </div>`).join("") : ""}
      ${tab === "offers" ? OFFERS.map(o => `<div class="offer"><span class="tag plain">${o.src}</span>
        <div class="big" style="margin-top:8px">${o.big}</div><b>${o.m}</b> <span class="sub">${o.what}</span>
        <dl><dt>Min. spend</dt><dd>${o.min}</dd><dt>Payment</dt><dd>${o.pay}</dd><dt>Expires</dt><dd>${o.exp}</dd><dt>Last checked</dt><dd>${o.ver}</dd></dl></div>`).join("") : ""}
    </div>`,
    after(el) {
      const s = el.querySelector("#mSearch");
      if (s) s.oninput = () => { exploreQ = s.value; el.querySelector("#mList").innerHTML = merchantList(); };
    },
  };
};

SCREENS.merchant = p => {
  const m = MERCHANTS.find(x => x.id === p.id);
  const mine = S.bills.filter(b => merchantOf(b) === m);
  const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const maxT = Math.max(...m.trend, 1);
  return {
    html: `<div class="scroll stag">
      ${topBar("Merchant")}
      <div class="m-head"><span class="tag">${CAT[m.cat]}</span><div class="h1">${esc(m.name)}</div><span style="opacity:.8">${esc(m.area)}</span>
        <p style="margin-top:12px;font-weight:700">${m.receipts} verified bills · ${m.users} different people</p></div>
      ${m.scores ? `<div class="sec-t"><span class="h3">Transparency</span><span class="sub">separate scores</span></div>
      <div class="card">${[["Billing transparency", m.scores.billing], ["Complaint responsiveness", m.scores.response], ["Pricing information", m.scores.pricing]].map(([l, v]) => `
        <div class="meter-r"><div class="lab"><span>${l}</span><span>${v}/100</span></div><div class="meter"><b class="${v < 65 ? "mid" : ""}" data-w="${v}"></b></div></div>`).join("")}
        <div class="lab" style="display:flex;justify-content:space-between;font-weight:700;font-size:13.5px"><span>Consumer experience</span><span>${m.rating} / 5</span></div>
        <p class="sub" style="font-size:12px;margin-top:10px">Scores are normalised by visit volume and based only on verified bills. Never a raw complaint count.</p></div>
      <div class="sec-t"><span class="h3">Bills with verified issues</span><span class="sub">% per month</span></div>
      <div class="card"><div class="bars">${m.trend.map((v, i) => `<div><i data-h="${v / maxT * 100}" class="${i < m.trend.length - 1 ? "soft" : ""}"></i><small>${months[i]}</small></div>`).join("")}</div></div>
      ${m.patterns.length ? `<div class="sec-t"><span class="h3">Recurring patterns</span></div>${m.patterns.map(t => `<div class="insight"><i>!</i><span>${t}</span></div>`).join("")}` : ""}
      <div class="sec-t"><span class="h3">Merchant's response</span></div><div class="card"><p style="font-size:14.5px">${m.response}</p></div>`
      : `<div class="card" style="margin-top:14px"><div class="h3">Not enough data yet</div><p class="sub" style="margin-top:6px">We show transparency scores only after at least 15 verified bills from different people. This merchant has ${m.receipts}.</p></div>`}
      ${mine.length ? `<div class="sec-t"><span class="h3">Your bills here</span></div><div class="list-card">${mine.map(billRow).join("")}</div>` : ""}
      <p class="sub" style="font-size:12px;margin-top:16px">Merchants can respond to and appeal any pattern shown here. Claims are moderated by people before publishing.</p>
    </div>`,
    after(el) { requestAnimationFrame(() => setTimeout(() => {
      el.querySelectorAll("[data-w]").forEach(b => b.style.width = b.dataset.w + "%");
      el.querySelectorAll("[data-h]").forEach(b => b.style.height = b.dataset.h + "%");
    }, 120)); },
  };
};

/* ---------- bills library ---------- */
let billQ = "", billF = "all";
function billList() {
  const q = billQ.toLowerCase();
  const list = S.bills.filter(b => {
    const a = auditOf(b);
    const f = billF === "all" || (billF === "issues" ? ["rev", "unx"].includes(a.worst) : b.category === billF);
    return f && (!q || b.merchant.toLowerCase().includes(q));
  });
  return list.length ? list.map(billRow).join("") : '<div class="empty"><div class="h2">Nothing here.</div><p>Try a different filter.</p></div>';
}
SCREENS.bills = () => ({
  html: `<div class="scroll stag">
    ${topBar("My bills", `<button class="icon-btn act-r" data-act="exportAll" aria-label="Export">↓</button>`)}
    <div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input class="inp" id="bSearch" placeholder="Search by merchant" value="${esc(billQ)}"></div>
    <div class="chips" style="margin:12px 0">${[["all", "All"], ["issues", "Has questions"], ["restaurant", "Restaurants"], ["hospital", "Hospitals"], ["grocery", "Grocery"], ["delivery", "Delivery"]].map(([k, v]) => `<button class="chip ${billF === k ? "on" : ""}" data-act="billF" data-k="${k}">${v}</button>`).join("")}</div>
    <div class="list-card" id="bList">${billList()}</div>
  </div>`,
  after(el) { const s = el.querySelector("#bSearch"); s.oninput = () => { billQ = s.value; el.querySelector("#bList").innerHTML = billList(); }; },
});

/* ---------- complaints ---------- */
const statusTag = s => ({ Draft: "need", "Ready to send": "acc", "Sent to merchant": "acc", "Awaiting response": "opt", "Merchant responded": "unx", Resolved: "ok", "Escalation prepared": "rev", "Submitted to authority": "rev", Closed: "plain" }[s] || "plain");
SCREENS.complaints = () => ({
  html: `<div class="scroll stag">
    ${topBar("Complaints")}
    <div class="stats" style="margin-top:0"><div class="stat"><b>${S.complaints.filter(c => !["Resolved", "Closed"].includes(c.status)).length}</b><small>Open cases</small></div>
      <div class="stat"><b style="color:var(--ok)">${rsShort(sum(S.complaints, c => c.refund || 0))}</b><small>Refunds you recorded</small></div></div>
    <div class="sec-t"><span class="h3">Your cases</span></div>
    <div class="list-card">${S.complaints.map(c => `<button class="row" data-go="complaint" data-p="${c.id}">
      <span class="grow"><b>${esc(c.title)}</b><small>${esc(c.merchant)} · #${c.id}</small></span><span class="tag ${statusTag(c.status)}">${c.status}</span></button>`).join("")}</div>
    <div class="card" style="margin-top:14px"><div class="h3">Start a new complaint</div><p class="sub" style="margin:4px 0 12px">Begin from an audited bill — the evidence is attached for you.</p><button class="btn pri full" data-act="pickComplaintBill">Choose a bill</button></div>
    <p class="sub" style="font-size:12px;margin-top:14px;text-align:center">PayRight helps you prepare. It never files complaints or contacts anyone for you.</p>
  </div>`,
});

const NEXT_STEP = {
  Draft: [["Mark ready to send", "Ready to send"]],
  "Ready to send": [["I've sent it to the merchant", "Sent to merchant"]],
  "Sent to merchant": [["Waiting for a reply", "Awaiting response"]],
  "Awaiting response": [["Record merchant's response", "Merchant responded"], ["Prepare escalation", "Escalation prepared"]],
  "Merchant responded": [["Mark resolved", "Resolved"], ["Prepare escalation", "Escalation prepared"]],
  "Escalation prepared": [["I submitted it to NCH", "Submitted to authority"]],
  "Submitted to authority": [["Close case", "Closed"]],
};
SCREENS.complaint = p => {
  const c = S.complaints.find(x => x.id === p.id);
  const b = S.bills.find(x => x.id === c.billId);
  return {
    html: `<div class="scroll stag">
      ${topBar("#" + c.id)}
      <span class="tag ${statusTag(c.status)}">${c.status}</span>
      <div class="h2" style="margin:10px 0 4px">${esc(c.title)}</div>
      <p class="sub">${esc(c.merchant)} · amount in question <b class="amt" style="color:var(--ink)">${rs(c.amt)}</b></p>
      ${c.refund ? `<div class="note" style="background:var(--ok-soft);color:var(--ok);margin-top:12px">Refund of ${rs(c.refund)} recorded by you.</div>` : ""}
      <div class="sec-t"><span class="h3">Timeline</span></div>
      <div class="card"><div class="tl">${c.events.map((e, i) => `<div class="tl-i ${i === c.events.length - 1 ? "now" : "done"}"><b>${e.s}</b><small>${e.d}${e.n ? " · " + esc(e.n) : ""}</small></div>`).join("")}</div></div>
      <div class="sec-t"><span class="h3">Evidence</span></div>
      <div class="card" style="display:flex;gap:12px;align-items:center">
        <div class="ev-thumb"><i></i><i style="width:70%"></i><i></i><i style="width:50%"></i><i></i></div>
        <div style="flex:1"><b style="font-size:14.5px">Bill + PayRight audit</b><p class="sub" style="font-size:12.5px">${b ? esc(b.merchant) + " · " + esc(b.date.split(" · ")[0]) : ""} · personal details redacted</p></div>
        ${b ? `<button class="btn sm ghost" data-go="audit" data-p="${b.id}">View</button>` : ""}
      </div>
      ${NEXT_STEP[c.status] ? `<div class="sec-t"><span class="h3">Next step</span></div>
        ${NEXT_STEP[c.status].map(([label, to], i) => `<button class="btn ${i ? "ghost" : "pri"} full" style="margin-bottom:8px" data-act="advance" data-p="${c.id}" data-to="${to}">${label}</button>`).join("")}` : ""}
      ${["Escalation prepared", "Submitted to authority"].includes(c.status) ? `<div class="card" style="margin-top:8px"><b>National Consumer Helpline</b><p class="sub" style="font-size:13px;margin:4px 0 10px">Call 1915 or file online. Keep your reference number and add it here.</p>
        <div class="btn-row"><a class="btn sm ghost" href="https://consumerhelpline.gov.in" target="_blank" rel="noopener">Open NCH ↗</a><button class="btn sm ghost" data-act="downloadPack" data-p="${c.id}">Complaint pack ↓</button></div></div>` : ""}
      <div class="btn-row" style="margin-top:10px"><button class="btn ghost" data-act="msgSheet" data-p="${c.billId}">Message draft</button><button class="btn ghost" data-act="downloadPack" data-p="${c.id}">Export</button></div>
    </div>`,
  };
};

SCREENS.newComplaint = p => {
  const b = getBill(p.id), a = auditOf(b);
  const issues = a.findings.filter(f => f.status !== "ok" && f.amount);
  return {
    html: `<div class="scroll stag">
      ${topBar("New complaint")}
      <div class="card" style="display:flex;gap:12px;align-items:center"><span class="thumb ${CAT_THUMB[b.category]}">${esc(b.merchant[0])}</span><div><b>${esc(b.merchant)}</b><p class="sub" style="font-size:13px">${esc(b.date)} · ${rs(b.printed.total)}</p></div></div>
      <label class="lbl">What's the issue?</label>
      <div class="list-card">${issues.length ? issues.map((f, i) => `<label class="row" style="cursor:pointer"><input type="checkbox" class="ncIssue" data-i="${i}" ${i === 0 ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--accent)">
        <span class="grow"><b>${esc(f.title)}</b><small>${STATUS[f.status].label}</small></span><span class="amt">${rs(f.amount)}</span></label>`).join("") : '<p class="sub" style="padding:14px 0">No flagged amounts on this bill — describe the issue below.</p>'}</div>
      <label class="lbl">What would you like?</label>
      <select class="inp" id="ncRemedy"><option>A corrected bill</option><option>A refund of the amount</option><option>An itemised breakdown</option><option>An explanation</option></select>
      <label class="lbl">Anything else? (optional)</label>
      <textarea class="inp" id="ncNote" rows="3" placeholder="e.g. I asked the staff at the counter, who said…"></textarea>
      <div class="note" style="margin-top:14px;background:var(--bg-2);color:var(--ink-2)">Your bill and audit are attached as evidence. Phone numbers and names on the bill are redacted.</div>
      <button class="btn pri full" data-act="createComplaint" data-p="${b.id}">Save draft</button>
    </div>`,
  };
};

/* ---------- Ask PayRight ---------- */
const KB = [
  { k: /service charge|tip|mandatory|compulsory/i, a: b => `${b && b.printed.fees.some(f => f.kind === "service") ? `On your ${esc(b.merchant)} bill the service charge is ${rs(sum(b.printed.fees.filter(f => f.kind === "service"), f => f.amt))}. ` : ""}Under the CCPA's July 2022 guidelines, restaurants shouldn't add a service charge automatically — paying it is voluntary. You can ask for it to be removed, or tip separately if you were happy.`, src: [["CCPA guideline on service charge", "04 Jul 2022"]] },
  { k: /cgst|sgst|twice|double|gst/i, a: b => `CGST and SGST are two halves of one GST for sales within the same state — e.g. 5% shows as 2.5% + 2.5%. That isn't double tax.${b && b.category === "hospital" ? " For hospital bills, healthcare services are generally exempt from GST, though some items (like non-ICU room rent above ₹5,000/day) can attract it." : ""}`, src: [["CBIC — GST basics", "Official"], ["Notification 12/2017-CT(Rate)", "as amended"]] },
  { k: /hospital|itemi[sz]ed|admin|miscellaneous|room|discharge|patient/i, a: () => "You can ask a hospital for an itemised bill. The Charter of Patients' Rights (NHRC / MoHFW) includes the right to information on rates and an itemised bill. Ask what lump sums like \"admin\" or \"miscellaneous\" cover, and how room-rent days were counted.", src: [["Charter of Patients' Rights · NHRC / MoHFW", "2019 / 2021"]], unc: "Adoption varies by state — check your state's rules." },
  { k: /mrp|medicine|above|pharmacy/i, a: () => "Packaged goods, including medicines, shouldn't be sold above the printed MRP under the Legal Metrology rules. Restaurants serving items as part of a meal are a known exception.", src: [["Legal Metrology (Packaged Commodities) Rules", "2011"]] },
  { k: /complain|nch|consumer court|e-?daakhil|escalat/i, a: () => "Start with the business — a clear, polite message often works. If not, contact the National Consumer Helpline: call 1915 or file at consumerhelpline.gov.in. Formal cases can be filed online through e-Daakhil. PayRight helps you prepare but never files for you.", src: [["National Consumer Helpline", "consumerhelpline.gov.in"], ["e-Daakhil", "edaakhil.nic.in"]] },
  { k: /evidence|proof|keep|preserve/i, a: () => "Keep: the original bill, a clear photo of it, the menu or rate card, your payment proof, the date/time/branch, and a note of who you spoke to and what they said.", src: [["PayRight guidance", "General information"]] },
  { k: /packag|carry bag|bag/i, a: () => "Packaging charges usually relate to takeaway or delivery. On a dine-in bill, it's fair to ask what it covers. Carry-bag charges have been challenged in consumer forums, especially for branded bags.", src: [["No single verified rule", "Depends on facts"]], unc: "We mark these as Unexplained, not as wrong." },
  { k: /say|manager|message|ask them|what do i/i, a: b => `Keep it short and factual: point to the line, say what you checked, and ask for a correction. I can draft it for you${b ? ` for ${esc(b.merchant)}` : ""} — tap "Draft message" below.`, src: [], draft: true },
  { k: /platform|convenience|delivery fee/i, a: () => "Platform and convenience fees are set by the app or business and should be shown before you pay. Compare the fee on the bill with your checkout screen.", src: [["No verified rule applied", "—"]], unc: "We'd need your checkout screenshot to check this." },
];
const SUGGEST = ["Is the service charge mandatory?", "Why CGST and SGST both?", "Can I ask the hospital for an itemised bill?", "What should I say to the manager?", "How do I raise a complaint?", "What evidence should I keep?"];
let askCtx = null;
SCREENS.ask = p => {
  if (p.id) askCtx = p.id;
  const b = askCtx ? getBill(askCtx) : null;
  return {
    html: `<div class="chat-wrap" id="chat">
      ${topBar("Ask PayRight", `<button class="icon-btn act-r" data-act="clearChat" aria-label="New chat">↺</button>`)}
      ${b ? `<div class="ctx-card"><span class="thumb ${CAT_THUMB[b.category]}" style="width:38px;height:38px;font-size:16px">${esc(b.merchant[0])}</span><div style="flex:1"><b>${esc(b.merchant)}</b>${rs(b.printed.total)} · ${headline(auditOf(b))}</div><button data-act="dropCtx" style="font-size:18px">✕</button></div>` : ""}
      ${S.chat.length ? "" : `<div class="h1" style="font-size:34px;margin:10px 0 8px">What's on<br>the <span class="ital">bill?</span></div><p class="sub" style="margin-bottom:16px">Answers come with sources and dates. Legal information — not legal advice.</p>`}
      ${S.chat.map(chatBubble).join("")}
    </div>
    <div class="suggest">${SUGGEST.map(s => `<button data-act="askQ" data-q="${esc(s)}">${s}</button>`).join("")}</div>
    <div class="composer"><input id="askInput" placeholder="Ask about a charge or your rights"><button data-act="askSend" aria-label="Send">↑</button></div>`,
    after(el) {
      const c = el.querySelector("#chat"); c.scrollTop = c.scrollHeight;
      el.querySelector("#askInput").onkeydown = e => { if (e.key === "Enter") ACT.askSend(); };
    },
  };
};
function chatBubble(m) {
  if (m.me) return `<div class="msg me">${esc(m.t)}</div>`;
  return `<div class="msg ai">${m.t}${m.src && m.src.length ? `<div class="srcs">${m.src.map(s => `<span class="src">◆ ${s[0]} · ${s[1]}</span>`).join("")}</div>` : ""}${m.unc ? `<div class="unc">${m.unc}</div>` : ""}${m.draft && askCtx ? `<button class="btn sm pri" style="margin-top:10px" data-act="msgSheet" data-p="${askCtx}">Draft message</button>` : ""}</div>`;
}
function answer(q) {
  const b = askCtx ? getBill(askCtx) : null;
  const hit = KB.find(k => k.k.test(q));
  if (!hit) return { t: "I don't have a verified source for that yet, so I won't guess. Try asking about service charges, GST, hospital bills, MRP, or how to complain — or contact the National Consumer Helpline (1915).", src: [], unc: "No matching source in the knowledge base." };
  return { t: hit.a(b), src: hit.src, unc: hit.unc, draft: hit.draft };
}

/* ---------- insights ---------- */
SCREENS.insights = () => {
  const months = ["2026-08", "2026-09", "2026-10"], labels = ["Aug", "Sep", "Oct"];
  const byM = months.map(m => sum(S.bills.filter(b => b.iso && b.iso.startsWith(m)), b => b.printed.total));
  const maxM = Math.max(...byM, 1);
  const cats = Object.keys(CAT).map(k => [k, sum(S.bills.filter(b => b.category === k), b => b.printed.total)]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
  const maxC = Math.max(...cats.map(c => c[1]), 1);
  const all = S.bills.map(auditOf);
  const potential = sum(all, a => a.money.over + a.money.contest + a.money.unexplained);
  const optional = sum(all, a => a.money.optional);
  const disputed = sum(S.complaints.filter(c => !["Resolved", "Closed"].includes(c.status)), c => c.amt);
  const refunds = sum(S.complaints, c => c.refund || 0);
  const discounts = sum(all, a => a.ourDisc);
  const awaiting = S.complaints.filter(c => c.status === "Awaiting response").length;
  const t = myTotals();
  const pending = S.groups.filter(g => simplify(groupNet(g)).some(d => d.from === "You")).length;
  return {
    html: `<div class="scroll stag">
      ${topBar("Insights")}
      <div class="h2">Spending from your ${S.bills.length} bills</div>
      <div class="card" style="margin-top:12px"><div class="bars" style="height:150px">${byM.map((v, i) => `<div><small class="amt" style="color:var(--ink)">${rsShort(Math.round(v / 100) * 100)}</small><i data-h="${v / maxM * 82}" class="${i < 2 ? "soft" : ""}"></i><small>${labels[i]}</small></div>`).join("")}</div></div>
      <div class="sec-t"><span class="h3">By category</span></div>
      <div class="card">${cats.map(([k, v]) => `<div class="cat-row"><span style="width:84px">${CAT[k]}</span><span class="bar"><b data-w="${v / maxC * 100}"></b></span><span class="amt" style="font-size:13px">${rsShort(Math.round(v / 100) * 100)}</span></div>`).join("")}</div>
      <div class="sec-t"><span class="h3">Savings — kept separate</span></div>
      <div class="money-grid">
        <div><b>${rs(potential)}</b><small>Potential issues identified</small></div>
        <div><b>${rs(optional)}</b><small>Optional charges seen</small></div>
        <div><b>${rs(disputed)}</b><small>Currently disputed</small></div>
        <div style="background:var(--ok-soft)"><b style="color:var(--ok)">${rs(refunds)}</b><small>Refunds you recorded</small></div>
        <div><b>${rs(discounts)}</b><small>Discounts applied</small></div>
      </div>
      <div class="sec-t"><span class="h3">Worth knowing</span></div>
      ${byM[2] > byM[1] ? `<div class="insight"><i>↗</i><span>October spending is ${rsShort(Math.round((byM[2] - byM[1]) / 100) * 100)} higher than September — mostly ${CAT[cats[0][0]].toLowerCase()} bills.</span></div>` : ""}
      ${awaiting ? `<div class="insight"><i>${awaiting}</i><span>complaint${awaiting > 1 ? "s are" : " is"} waiting for a merchant reply.</span></div>` : ""}
      ${pending ? `<div class="insight"><i>${pending}</i><span>group${pending > 1 ? "s have" : " has"} money you owe — ${rs(t.owe)} in total.</span></div>` : ""}
      ${refunds ? `<div class="insight"><i>✓</i><span>You've recorded ${rs(refunds)} in documented refunds.</span></div>` : ""}
    </div>`,
    after(el) { setTimeout(() => {
      el.querySelectorAll("[data-h]").forEach(b => b.style.height = b.dataset.h + "%");
      el.querySelectorAll("[data-w]").forEach(b => b.style.width = b.dataset.w + "%");
    }, 150); },
  };
};

/* ---------- notifications ---------- */
SCREENS.notifications = () => ({
  html: `<div class="scroll stag">
    ${topBar("Notifications", `<button class="btn sm ghost act-r" data-act="readAll">Mark read</button>`)}
    ${S.notifs.map((n, i) => `<button class="notif ${n.read ? "read" : ""}" style="width:100%;text-align:left" data-act="openNotif" data-i="${i}"><span class="dot2"></span><span style="flex:1"><b>${esc(n.t)}</b><small>${esc(n.d)}</small></span><small class="sub">${n.time}</small></button>`).join("")}
  </div>`,
});

/* ---------- profile & settings ---------- */
SCREENS.profile = () => {
  const theme = document.documentElement.getAttribute("data-theme");
  const tg = (k, label, sub) => `<div class="toggle-row"><div><b>${label}</b><small>${sub}</small></div><button class="switch ${S.settings[k] ? "on" : ""}" data-act="toggleSetting" data-k="${k}"></button></div>`;
  return {
    tabs: true,
    html: `<div class="scroll stag">
      <div class="profile-top"><div class="avatar">${initials(S.name)}</div><div class="h2">${esc(S.name)}</div><span class="tag ${S.plan === "plus" ? "acc" : "plain"}" style="margin-top:8px">${S.plan === "plus" ? "PayRight Plus" : "Free plan"}</span></div>
      <div class="list-card" style="margin-top:18px">
        <button class="row" data-go="bills"><span class="grow"><b>My bills</b><small>${S.bills.length} saved</small></span><span class="chev">›</span></button>
        <button class="row" data-go="complaints"><span class="grow"><b>Complaints</b><small>${S.complaints.length} cases</small></span><span class="chev">›</span></button>
        <button class="row" data-go="insights"><span class="grow"><b>Insights</b><small>Spending &amp; savings</small></span><span class="chev">›</span></button>
        <button class="row" data-go="subscription"><span class="grow"><b>Subscription</b><small>${S.plan === "plus" ? "Plus" : "Free"}</small></span><span class="chev">›</span></button>
        <button class="row" data-go="ask"><span class="grow"><b>Ask PayRight</b><small>Rights &amp; charges</small></span><span class="chev">›</span></button>
      </div>
      <div class="sec-t"><span class="h3">Appearance</span></div>
      <div class="seg"><button class="${theme === "light" ? "on" : ""}" data-act="setTheme" data-k="light">Light</button><button class="${theme === "dark" ? "on" : ""}" data-act="setTheme" data-k="dark">Dark</button></div>
      <div class="sec-t"><span class="h3">Notifications</span></div>
      <div class="card" style="padding-top:0;padding-bottom:0">${tg("notifAudit", "Audit ready", "When a bill has been checked")}${tg("notifComplaint", "Complaint updates", "Merchant replies and reminders")}${tg("notifSettle", "Settlement reminders", "Money owed in your groups")}</div>
      <div class="sec-t"><span class="h3">Privacy</span></div>
      <div class="card" style="padding-top:0;padding-bottom:0">${tg("saveHistory", "Keep bill history", "Store bills in your account")}${tg("redact", "Auto-redact evidence", "Hide names &amp; phone numbers when sharing")}</div>
      <div class="list-card" style="margin-top:12px">
        <button class="row" data-act="exportAll"><span class="grow"><b>Export my data</b><small>Download as JSON</small></span><span class="chev">↓</span></button>
        <button class="row" data-act="help"><span class="grow"><b>Help &amp; support</b><small>FAQ and contact</small></span><span class="chev">›</span></button>
        
        <button class="row" data-act="resetApp"><span class="grow"><b>Reset app</b><small>Start fresh with the original bills and groups</small></span><span class="chev">↺</span></button>
        <button class="row" data-act="logout"><span class="grow"><b>Log out</b></span></button>
        <button class="row" data-act="deleteAccount"><span class="grow"><b style="color:var(--bad)">Delete account</b><small>Removes all bills and groups</small></span></button>
      </div>
      <p class="sub" style="text-align:center;margin-top:18px;font-size:12px">PayRight v1.0 · not a law firm or regulator</p>
    </div>`,
  };
};

SCREENS.subscription = () => ({
  html: `<div class="scroll stag">
    ${topBar("Subscription")}
    <div class="h1" style="margin-bottom:16px">Pick a <span class="ital">plan.</span></div>
    <button class="plan-card ${S.plan === "free" ? "on" : ""}" data-act="pickPlan" data-k="free"><b>Free</b><div class="p">₹0</div><ul><li>10 bill checks a month</li><li>Splitting &amp; 2 groups</li><li>3 months of history</li></ul></button>
    <button class="plan-card ${S.plan === "plus" ? "on" : ""}" data-act="pickPlan" data-k="plus"><b>PayRight Plus</b><div class="p">₹79<small style="font-size:16px">/month</small></div><ul><li>Unlimited fair-use checks</li><li>Hospital &amp; grocery reports</li><li>Exports &amp; detailed insights</li><li>Unlimited groups</li></ul></button>
    <p class="sub" style="font-size:12px;text-align:center">Cancel anytime from this screen.</p>
  </div>`,
});

/* ===========================================================
   ACTIONS (all buttons route here through data-act)
   =========================================================== */
const ACT = {
  onbNext() { if (onbIdx < ONB.length - 1) { onbIdx++; refresh(); } else replace("auth"); },
  onbSkip() { replace("auth"); },
  authGo() {
    const n = $("#aName").value.trim(), e = $("#aEmail").value.trim(), pw = $("#aPass").value;
    if (!n) return toast("Please add your first name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast("Please enter a valid email");
    if (pw.length < 8) return toast("Password needs at least 8 characters");
    S.name = n; S.onboarded = true; tabGo("home"); toast("Welcome, " + n + "!");
  },
  authGuest() { S.onboarded = true; tabGo("home"); },
  authProvider() { toast("Google and Apple sign-in are coming soon"); },

  torch(t) { torch = !torch; t.classList.toggle("on", torch); toast(torch ? "Torch on" : "Torch off"); },
  pickPdf() { $("#fileInput").click(); },
  shutter() {
    const f = $("#flash"); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
    toast("Photo scanning is coming soon — upload the bill PDF");
    setTimeout(() => $("#fileInput").click(), 600);
  },

  rvCat(t) { getBill(stack[stack.length - 1].p.id).category = t.dataset.k; refresh(); },
  runAudit(t) {
    const b = getBill(t.dataset.p);
    b.merchant = $("#rvMerchant").value.trim() || b.merchant; b.date = $("#rvDate").value.trim() || b.date;
    replace("audit", { id: b.id });
  },
  toggleFnd(t) { t.parentElement.classList.toggle("open"); },
  saveBill(t) {
    const b = getBill(t.dataset.p);
    if (!S.bills.some(x => x.id === b.id)) { b.iso = b.iso || new Date().toISOString().slice(0, 10); S.bills.unshift(b); }
    draft = null; refresh(); toast("Saved to My bills");
    if (S.settings.notifAudit) S.notifs.unshift({ t: "Audit saved: " + b.merchant, d: headline(auditOf(b)), time: "now", read: false, go: ["audit", b.id] });
  },
  deleteBill(t) {
    openSheet(`<div class="h2">Delete this bill?</div><p class="sub" style="margin:8px 0 16px">The bill and its audit will be removed from your account.</p>
      <div class="btn-row"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn danger" data-act="confirmDeleteBill" data-p="${t.dataset.p}">Delete</button></div>`);
  },
  confirmDeleteBill(t) { S.bills = S.bills.filter(b => b.id !== t.dataset.p); closeSheet(); back(); toast("Bill deleted"); },
  closeSheet() { closeSheet(); },
  msgSheet(t) {
    const b = getBill(t.dataset.p); const text = clarificationMessage(b, auditOf(b));
    openSheet(`<div class="h2">Clarification message</div><p class="sub">Edit before sending. PayRight never sends anything for you.</p>
      <textarea id="msgText">${esc(text)}</textarea>
      <div class="btn-row"><button class="btn pri" data-act="copyMsg">Copy</button><a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">WhatsApp</a></div>`);
  },
  copyMsg() { copy($("#msgText").value); },
  askAbout(t) {
    const q = t.dataset.q;
    askCtx = t.dataset.p;
    go("ask", { id: t.dataset.p });
    if (q) setTimeout(() => ACT.askQ({ dataset: { q: "Tell me about: " + q } }), 450);
  },
  newComplaint(t) { go("newComplaint", { id: t.dataset.p }); },
  openPrices() { S.exploreTab = "prices"; tabGo("explore"); },
  exportReport() {
    const top_ = stack[stack.length - 1]; const b = getBill(top_.p.id), a = auditOf(b);
    const txt = [`PayRight audit report`, ``, `${b.merchant} — ${b.date}`, `Printed total: ${rs(b.printed.total)}`, `Our total: ${rs(a.ourTotal)}`, `Summary: ${headline(a)}`, ``,
      ...a.findings.map(f => `[${STATUS[f.status].label}] ${f.title} — ${f.sub}\n  ${f.explain}\n  Calculation: ${f.calc.replace(/<br>/g, "; ")}\n  Basis: ${f.rule}\n  What to do: ${f.action}`)].join("\n");
    download(`PayRight-${b.merchant.replace(/\W+/g, "-")}.txt`, txt); toast("Report downloaded");
  },

  splitMethod(t) { splits[stack[stack.length - 1].p.id].method = t.dataset.k; refresh(); },
  toggleAssign(t) {
    const st = splits[stack[stack.length - 1].p.id]; const i = +t.dataset.i, k = +t.dataset.k;
    const a = st.assign[i] || (st.assign[i] = []);
    st.assign[i] = a.includes(k) ? a.filter(x => x !== k) : [...a, k].sort();
    refresh();
  },
  toggleSvc() { const st = splits[stack[stack.length - 1].p.id]; st.includeService = !st.includeService; refresh(); },
  addPerson() {
    openSheet(`<div class="h2">Add a person</div><input class="inp" id="newPerson" placeholder="Name" style="margin:14px 0"><button class="btn pri full" data-act="confirmPerson">Add</button>`,
      sh => setTimeout(() => sh.querySelector("input").focus(), 300));
  },
  confirmPerson() {
    const n = $("#newPerson").value.trim(); if (!n) return toast("Enter a name");
    const st = splits[stack[stack.length - 1].p.id]; st.people.push(n);
    st.assign.forEach(a => a.push(st.people.length - 1)); closeSheet(); refresh();
  },
  renamePerson(t) {
    const st = splits[stack[stack.length - 1].p.id], i = +t.dataset.i;
    openSheet(`<div class="h2">Edit person</div><input class="inp" id="renameIn" value="${esc(st.people[i])}" style="margin:14px 0">
      <div class="btn-row">${i ? `<button class="btn ghost" data-act="removePerson" data-i="${i}">Remove</button>` : ""}<button class="btn pri" data-act="confirmRename" data-i="${i}">Save</button></div>`);
  },
  confirmRename(t) { const st = splits[stack[stack.length - 1].p.id]; st.people[+t.dataset.i] = $("#renameIn").value.trim() || st.people[+t.dataset.i]; closeSheet(); refresh(); },
  removePerson(t) {
    const st = splits[stack[stack.length - 1].p.id], i = +t.dataset.i;
    st.people.splice(i, 1);
    st.assign = st.assign.map(a => a.filter(x => x !== i).map(x => x > i ? x - 1 : x));
    if (st.payer >= st.people.length) st.payer = 0;
    closeSheet(); refresh();
  },
  shareSplit(t) {
    const b = getBill(t.dataset.p), st = splits[b.id], r = computeSplit(b, st);
    copy(`${b.merchant} — split with PayRight\n` + st.people.map((n, i) => `${n}: ${rs(r.per[i])}`).join("\n") + `\nPaid by ${st.people[st.payer]}`);
  },
  saveSplit(t) {
    openSheet(`<div class="h2">Add to which group?</div><div class="list-card" style="margin-top:12px">${S.groups.map(g => `<button class="row" data-act="confirmSplit" data-p="${t.dataset.p}" data-g="${g.id}"><span class="grow"><b>${esc(g.name)}</b><small>${g.members.join(", ")}</small></span><span class="chev">›</span></button>`).join("")}</div>
      <p class="sub" style="font-size:12px;margin-top:10px">People not in the group are added to it.</p>`);
  },
  confirmSplit(t) {
    const b = getBill(t.dataset.p), st = splits[b.id], r = computeSplit(b, st), g = S.groups.find(x => x.id === t.dataset.g);
    st.people.forEach(p => { if (!g.members.includes(p)) g.members.push(p); });
    const shares = {}; g.members.forEach(m => shares[m] = 0); st.people.forEach((p, i) => shares[p] += r.per[i]);
    g.expenses.unshift({ id: "e" + Date.now(), desc: b.merchant, amt: r.total, by: st.people[st.payer], date: new Date().toISOString().slice(0, 10), shares, billId: b.id });
    if (!S.bills.some(x => x.id === b.id)) { b.iso = new Date().toISOString().slice(0, 10); S.bills.unshift(b); draft = null; }
    closeSheet(); groupTab = "balances"; stack = [{ name: "groups" }, { name: "group", p: { id: g.id } }]; render("push"); toast("Added to " + g.name);
  },
  pickSplitBill() {
    openSheet(`<div class="h2">Split which bill?</div><div class="list-card" style="margin-top:12px">${S.bills.map(b => `<button class="row" data-act="goSplit" data-p="${b.id}"><span class="thumb ${CAT_THUMB[b.category]}">${esc(b.merchant[0])}</span><span class="grow"><b>${esc(b.merchant)}</b><small>${esc(b.date.split(" · ")[0])}</small></span><span class="amt">${rsShort(b.printed.total)}</span></button>`).join("")}</div>`);
  },
  goSplit(t) { closeSheet(); go("split", { id: t.dataset.p }); },
  newGroup() {
    openSheet(`<div class="h2">New group</div><label class="lbl">Name</label><input class="inp" id="ngName" placeholder="e.g. Hostel floor 3">
      <label class="lbl">Members (comma separated)</label><input class="inp" id="ngMembers" placeholder="Riya, Kabir, Meera">
      <button class="btn pri full" style="margin-top:16px" data-act="confirmGroup">Create group</button>`);
  },
  confirmGroup() {
    const n = $("#ngName").value.trim(); if (!n) return toast("Give the group a name");
    const mem = $("#ngMembers").value.split(",").map(s => s.trim()).filter(Boolean);
    const g = { id: "g" + Date.now(), name: n, members: ["You", ...mem.filter(m => m !== "You")], expenses: [], settlements: [] };
    S.groups.unshift(g); closeSheet(); go("group", { id: g.id }); toast("Group created");
  },
  groupTab(t) { groupTab = t.dataset.k; refresh(); },
  addExpense(t) {
    const g = S.groups.find(x => x.id === t.dataset.g);
    openSheet(`<div class="h2">Add expense</div><label class="lbl">What for?</label><input class="inp" id="exDesc" placeholder="e.g. Electricity bill">
      <label class="lbl">Amount (₹)</label><input class="inp" id="exAmt" type="number" min="1" step="0.01" placeholder="0.00">
      <label class="lbl">Paid by</label><select class="inp" id="exBy">${g.members.map(m => `<option>${esc(m)}</option>`).join("")}</select>
      <p class="sub" style="margin-top:10px;font-size:12.5px">Split equally between all ${g.members.length} members.</p>
      <button class="btn pri full" style="margin-top:14px" data-act="confirmExpense" data-g="${g.id}">Add</button>`);
  },
  confirmExpense(t) {
    const g = S.groups.find(x => x.id === t.dataset.g), d = $("#exDesc").value.trim(), amt = toPaise($("#exAmt").value || "0");
    if (!d || amt <= 0) return toast("Add a description and an amount");
    g.expenses.unshift({ id: "e" + Date.now(), desc: d, amt, by: $("#exBy").value, date: new Date().toISOString().slice(0, 10), shares: null });
    closeSheet(); refresh(); toast("Expense added");
  },
  settleSheet(t) {
    const { g, from, to, amt } = t.dataset;
    openSheet(`<div class="h2">${esc(from)} → ${esc(to)}</div><p class="sub" style="margin-top:4px">Full amount ${rs(+amt)}. Change it for a partial payment.</p>
      <label class="lbl">Amount (₹)</label><input class="inp" id="stAmt" type="number" step="0.01" value="${(amt / 100).toFixed(2)}">
      <label class="lbl">How was it paid?</label><div class="chips" id="stHow">${["UPI", "Cash", "Bank transfer"].map((m, i) => `<button class="chip ${i ? "" : "on"}" data-act="stHow">${m}</button>`).join("")}</div>
      <label class="lbl">Note (optional)</label><input class="inp" id="stNote" placeholder="e.g. Paid for Goa scooters">
      <button class="btn pri full" style="margin-top:16px" data-act="confirmSettle" data-g="${g}" data-from="${esc(from)}" data-to="${esc(to)}" data-max="${amt}">Record settlement</button>
      ${from === "You" ? `<a class="btn ghost full" style="margin-top:8px" href="upi://pay?pa=${encodeURIComponent(to.toLowerCase())}@upi&pn=${encodeURIComponent(to)}&am=${(amt / 100).toFixed(2)}&cu=INR">Pay with UPI</a>` : ""}
      <p class="sub" style="font-size:12px;margin-top:10px;text-align:center">PayRight records the settlement. The payment happens in your UPI app.</p>`);
  },
  stHow(t) { t.parentElement.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c === t)); },
  confirmSettle(t) {
    const amt = toPaise($("#stAmt").value || "0"), max = +t.dataset.max;
    if (amt <= 0 || amt > max) return toast("Enter an amount up to " + rs(max));
    const g = S.groups.find(x => x.id === t.dataset.g);
    const how = $("#stHow .chip.on").textContent, note = $("#stNote").value.trim();
    g.settlements.push({ from: t.dataset.from, to: t.dataset.to, amt, date: new Date().toISOString().slice(0, 10), note: how + (note ? " · " + note : "") });
    closeSheet(); refresh(); toast(amt < max ? "Partial settlement recorded" : "Settled up!");
  },

  exploreTab(t) { S.exploreTab = t.dataset.k; refresh(); },
  exploreCat(t) { exploreCat = t.dataset.k; refresh(); },
  billF(t) { billF = t.dataset.k; refresh(); },

  pickComplaintBill() {
    openSheet(`<div class="h2">Which bill?</div><div class="list-card" style="margin-top:12px">${S.bills.map(b => `<button class="row" data-act="goComplaint" data-p="${b.id}"><span class="thumb ${CAT_THUMB[b.category]}">${esc(b.merchant[0])}</span><span class="grow"><b>${esc(b.merchant)}</b><small>${headline(auditOf(b))}</small></span></button>`).join("")}</div>`);
  },
  goComplaint(t) { closeSheet(); go("newComplaint", { id: t.dataset.p }); },
  createComplaint(t) {
    const b = getBill(t.dataset.p), a = auditOf(b);
    const issues = a.findings.filter(f => f.status !== "ok" && f.amount);
    const picked = [...document.querySelectorAll(".ncIssue:checked")].map(x => issues[+x.dataset.i]);
    const title = picked.length ? picked.map(f => f.title).join(" & ") : ($("#ncNote").value.trim() || "Billing question");
    if (!S.bills.some(x => x.id === b.id)) { b.iso = new Date().toISOString().slice(0, 10); S.bills.unshift(b); draft = null; }
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    const c = { id: "PR-" + (2060 + S.complaints.length), billId: b.id, merchant: b.merchant, title: title.slice(0, 70), amt: sum(picked, f => Math.abs(f.amount)), status: "Draft", refund: 0,
      events: [{ s: "Draft", d: today, n: "Requested: " + $("#ncRemedy").value + ($("#ncNote").value.trim() ? " · " + $("#ncNote").value.trim() : "") }] };
    S.complaints.unshift(c);
    stack = [{ name: "home" }, { name: "complaints" }, { name: "complaint", p: { id: c.id } }]; render("push"); toast("Draft saved");
  },
  advance(t) {
    const c = S.complaints.find(x => x.id === t.dataset.p), to = t.dataset.to;
    if (to === "Merchant responded") {
      return openSheet(`<div class="h2">What did they say?</div><textarea id="respText" placeholder="Paste or summarise the merchant's reply"></textarea>
        <label class="lbl" style="margin-top:0">Refund received (₹, optional)</label><input class="inp" id="respRefund" type="number" step="0.01" placeholder="0.00">
        <button class="btn pri full" style="margin-top:14px" data-act="confirmResponse" data-p="${c.id}">Save response</button>`);
    }
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    const notes = { "Sent to merchant": "Sent by you", "Escalation prepared": "NCH complaint pack ready — not submitted by PayRight", "Submitted to authority": "Submitted by you · add your reference number", Resolved: c.refund ? "Refund recorded" : "Marked resolved by you" };
    c.status = to; c.events.push({ s: to, d: today, n: notes[to] || "" });
    refresh(); toast("Status: " + to);
  },
  confirmResponse(t) {
    const c = S.complaints.find(x => x.id === t.dataset.p);
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    const refund = toPaise($("#respRefund").value || "0");
    c.status = "Merchant responded"; c.refund = (c.refund || 0) + Math.max(0, refund);
    c.events.push({ s: "Merchant responded", d: today, n: ($("#respText").value.trim() || "Response recorded") + (refund > 0 ? ` · refund ${rs(refund)}` : "") });
    closeSheet(); refresh(); toast("Response recorded");
  },
  downloadPack(t) {
    const c = S.complaints.find(x => x.id === t.dataset.p), b = S.bills.find(x => x.id === c.billId);
    const a = b ? auditOf(b) : null;
    const txt = [`COMPLAINT PACK — #${c.id} (PayRight)`, ``, `Merchant: ${c.merchant}`, `Issue: ${c.title}`, `Amount in question: ${rs(c.amt)}`, `Status: ${c.status}`, ``,
      `Timeline:`, ...c.events.map(e => `- ${e.d}: ${e.s}${e.n ? " — " + e.n : ""}`), ``,
      b ? `Bill: ${b.merchant}, ${b.date}, printed total ${rs(b.printed.total)}, PayRight total ${rs(a.ourTotal)}` : "", ``,
      `Where to file: National Consumer Helpline — call 1915 or visit consumerhelpline.gov.in`, `PayRight provides information, not legal advice. It has not submitted this complaint.`].join("\n");
    download(`PayRight-complaint-${c.id}.txt`, txt); toast("Complaint pack downloaded");
  },

  askQ(t) { const q = t.dataset.q; S.chat.push({ me: true, t: q }); refresh(); typeAnswer(q); },
  askSend() { const i = $("#askInput"); const q = i.value.trim(); if (!q) return; S.chat.push({ me: true, t: q }); refresh(); typeAnswer(q); },
  clearChat() { S.chat = []; refresh(); },
  dropCtx() { askCtx = null; stack[stack.length - 1].p = {}; refresh(); },

  readAll() { S.notifs.forEach(n => n.read = true); refresh(); },
  openNotif(t) { const n = S.notifs[+t.dataset.i]; n.read = true; if (n.go[0] === "audit" && !getBill(n.go[1])) return refresh(); go(n.go[0], { id: n.go[1] }); },

  setTheme(t) { document.documentElement.setAttribute("data-theme", t.dataset.k); try { localStorage.setItem("pr-theme", t.dataset.k); } catch (e) {} refresh(); },
  toggleSetting(t) { S.settings[t.dataset.k] = !S.settings[t.dataset.k]; t.classList.toggle("on"); save(); },
  pickPlan(t) {
    if (t.dataset.k === S.plan) return;
    if (t.dataset.k === "free") { S.plan = "free"; refresh(); return toast("Switched to Free"); }
    openSheet(`<span class="tag plain">Early access</span><div class="h2" style="margin:10px 0 4px">PayRight Plus</div><p class="sub">₹79 / month</p>
      <div class="card" style="margin:14px 0"><div class="recon-r"><span>Plan</span><span>₹79.00</span></div><div class="recon-r t"><span>Due today</span><span>₹0.00</span></div></div>
      <button class="btn acc full" data-act="confirmPlus">Start PayRight Plus</button>`);
  },
  confirmPlus() { S.plan = "plus"; closeSheet(); refresh(); toast("Welcome to PayRight Plus!"); },
  exportAll() { download("payright-my-data.json", JSON.stringify({ name: S.name, bills: S.bills, groups: S.groups, complaints: S.complaints }, null, 2), "application/json"); toast("Your data was downloaded"); },
  help() {
    openSheet(`<div class="h2">Help &amp; support</div>
      <div class="list-card" style="margin-top:12px">
        <div class="row"><span class="grow"><b>How do I check a bill?</b><small>Tap Scan, then “Upload bill PDF” and choose your bill.</small></span></div>
        <div class="row"><span class="grow"><b>Is a flag an accusation?</b><small>No — it means a question is worth asking.</small></span></div>
        <div class="row"><span class="grow"><b>Contact</b><small>hello@payright.example</small></span></div>
      </div>`);
  },
  logout() { S.onboarded = false; onbIdx = 0; stack = [{ name: "auth" }]; render("fade"); },
  deleteAccount() {
    openSheet(`<div class="h2">Delete your account?</div><p class="sub" style="margin:8px 0 16px">All bills, groups and complaints will be removed. This can't be undone.</p>
      <div class="btn-row"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn danger" data-act="confirmDeleteAccount">Delete</button></div>`);
  },
  resetApp() { resetApp(); toast("App reset"); },
  confirmDeleteAccount() { closeSheet(); resetApp(); toast("Account deleted"); },
};

function typeAnswer(q) {
  const chat = $("#chat");
  const t = document.createElement("div"); t.className = "msg ai typing"; t.innerHTML = "<i></i><i></i><i></i>";
  chat.appendChild(t); chat.scrollTop = chat.scrollHeight;
  setTimeout(() => { S.chat.push(answer(q)); if (stack[stack.length - 1].name === "ask") refresh(); setTimeout(() => { const c = $("#chat"); if (c) c.scrollTop = c.scrollHeight; }, 20); }, 900);
}

/* ---------- PDF upload ---------- */
$("#fileInput").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const b = await readBillPdf(f);
    const m = MERCHANTS.find(x => x.name.toLowerCase().replace(/&/g, "and").replace(/\W/g, "") === b.merchant.toLowerCase().replace(/&/g, "and").replace(/\W/g, ""));
    if (m) b.mId = m.id;
    draft = b;
    if (stack[stack.length - 1].name === "scan") replace("process", { id: b.id, kind: "pdf", label: b.merchant });
    else go("process", { id: b.id, kind: "pdf", label: b.merchant });
  } catch (err) {
    openSheet(`<div class="h2">Couldn't read that PDF</div><p class="sub" style="margin:8px 0 16px;font-size:14.5px">${esc(err.message)}</p><button class="btn pri full" data-act="closeSheet">OK</button>`);
  }
});

/* ---------- global click routing ---------- */
$("#app").addEventListener("click", e => {
  const t = e.target.closest("[data-back],[data-tab],[data-go],[data-act]");
  if (!t || t.tagName === "SELECT" || t.disabled) return;
  if (t.hasAttribute("data-back")) return back();
  if (t.dataset.tab) { closeSheet(); return tabGo(t.dataset.tab); }
  if (t.dataset.go) { closeSheet(); return go(t.dataset.go, t.dataset.p ? { id: t.dataset.p } : {}); }
  if (t.dataset.act && ACT[t.dataset.act]) ACT[t.dataset.act](t, e);
});
// review screen inputs update the draft bill immediately
$("#app").addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.act === "rvQty" || t.dataset.act === "rvUnit") {
    const b = getBill(stack[stack.length - 1].p.id), i = +t.dataset.i;
    if (t.dataset.act === "rvQty") b.items[i][1] = Math.max(0, parseInt(t.value) || 0);
    else b.items[i][2] = Math.max(0, toPaise(t.value || "0"));
  }
});
$("#scrim").addEventListener("click", closeSheet);

/* ---------- reset to the starting data ---------- */
function resetApp() {
  const name = S.name;
  S = seedState(); S.name = name; S._namedFromSite = 1; onbIdx = 0; draft = null; askCtx = null;
  Object.keys(splits).forEach(k => delete splits[k]);
  stack = [{ name: "onboard" }]; render("fade");
}


/* ---------- boot ---------- */
(function boot() {
  const d = new Date(); $("#clock").textContent = (d.getHours() % 12 || 12) + ":" + String(d.getMinutes()).padStart(2, "0");
  const hash = location.hash.slice(1);
  const deep = { split: [{ name: "home" }, { name: "split", p: { id: "b1" } }], ask: [{ name: "home" }, { name: "ask", p: {} }],
    complaints: [{ name: "home" }, { name: "complaints" }], home: [{ name: "home" }], scan: [{ name: "home" }, { name: "scan" }] };
  if (deep[hash]) { S.onboarded = true; stack = deep[hash]; }
  else stack = [{ name: S.onboarded ? "home" : "onboard" }];
  render("fade");
  setTimeout(() => $("#splash").classList.add("gone"), 900);
})();
