/* ===========================================================
   PayRight — Bill core (shared by the website and the app)
   1. Reads text from a text-based PDF bill (no OCR needed)
   2. Parses it into a structured bill
   3. Audits it with exact integer arithmetic (paise)
   =========================================================== */

/* ---------- money helpers (all amounts in paise) ---------- */
const rs = p => (p < 0 ? "-" : "") + "₹" + (Math.abs(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rsShort = p => p % 100 === 0 ? (p < 0 ? "-" : "") + "₹" + (Math.abs(p) / 100).toLocaleString("en-IN") : rs(p);
const pct = bp => (bp / 100).toString().replace(/\.0+$/, "") + "%";
const ofBp = (base, bp) => Math.round(base * bp / 10000);

/* "1,886.50" → 188650, done on the string so no float error creeps in */
function toPaise(str) {
  let s = String(str).replace(/[,\s]/g, "").replace(/^(rs\.?|inr|₹)/i, "");
  const neg = s.startsWith("-"); s = s.replace(/^[-+]/, "");
  const [whole, frac = ""] = s.split(".");
  const v = parseInt(whole || "0", 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  return neg ? -v : v;
}
const toBp = str => Math.round(parseFloat(str) * 100);

/* ===========================================================
   1. PDF → lines of text
   =========================================================== */
async function extractPdfLines(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let raw = "";
  for (let i = 0; i < buf.length; i += 8192) raw += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
  if (!raw.startsWith("%PDF")) throw new Error("That file isn't a PDF.");

  // Fast path: uncompressed text streams
  const lines = [];
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let m;
  while ((m = streamRe.exec(raw))) {
    const body = m[1];
    if (!/\bTj\b|\bTJ\b/.test(body)) continue;
    const tj = /\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:\([^)]*\)|[^\]])*)\]\s*TJ/g;
    let t;
    while ((t = tj.exec(body))) {
      if (t[1] !== undefined) lines.push(unescapePdf(t[1]));
      else lines.push((t[2].match(/\(((?:\\.|[^\\)])*)\)/g) || []).map(s => unescapePdf(s.slice(1, -1))).join(""));
    }
  }
  if (lines.filter(l => l.trim()).length > 3) return lines;

  // Fallback: other text-based PDFs (compressed streams) via pdf.js
  return await extractWithPdfJs(buf);
}
function unescapePdf(s) {
  return s.replace(/\\([nrtbf()\\]|\d{1,3})/g, (_, c) => {
    if (/\d/.test(c)) return String.fromCharCode(parseInt(c, 8));
    return { n: "\n", r: "", t: " ", b: "", f: "", "(": "(", ")": ")", "\\": "\\" }[c];
  });
}
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      res(window.pdfjsLib);
    };
    s.onerror = () => rej(new Error("Couldn't load the PDF reader. Check your internet connection and try again."));
    document.head.appendChild(s);
  });
}
async function extractWithPdfJs(buf) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: buf }).promise;
  const out = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const rows = {};
    tc.items.forEach(it => {
      const y = Math.round(it.transform[5] / 3) * 3;
      (rows[y] = rows[y] || []).push(it);
    });
    Object.keys(rows).map(Number).sort((a, b) => b - a).forEach(y => {
      out.push(rows[y].sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(" "));
    });
  }
  return out;
}

/* ===========================================================
   2. Lines → structured bill
   =========================================================== */
const NUM = "(-?(?:rs\\.?\\s*)?[\\d,]+\\.\\d{2})";
function parseBillLines(rawLines, fileName) {
  const lines = rawLines.map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const bill = {
    id: "pdf-" + Date.now(), source: "pdf", fileName: fileName || "bill.pdf",
    merchant: "", place: "", date: "", gstin: "", dineIn: true, story: "Your uploaded PDF", category: "restaurant", stayDays: null,
    items: [], printed: { subtotal: null, discount: null, taxes: [], fees: [], round: 0, total: null }, extra: [],
  };
  const header = [];
  let pastItems = false, admit = null, discharge = null;
  const all = lines.join(" ");
  if (/hospital|clinic|patient|uhid|admission|diagnostic|nursing/i.test(all)) bill.category = "hospital";
  else if (/grocer|supermarket|mart\b|kirana|store/i.test(all)) bill.category = "grocery";
  else if (/delivery order/i.test(all)) bill.category = "delivery";

  for (const l of lines) {
    let m;
    if (/thank you|visit again|^-+$|^=+$|^item\b.*\bqty\b/i.test(l)) continue;
    if (/^(tax invoice|bill no|invoice no|order (id|no)|cashier|server|steward|final|inpatient|outpatient|day ?care bill|reports? )/i.test(l)) continue;
    if ((m = l.match(/^gstin\s*[:\-]?\s*(.+)$/i))) { bill.gstin = m[1]; continue; }
    if ((m = l.match(/^(admission|admitted|doa)\s*(?:date)?\s*[:\-]?\s*(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/i))) { admit = new Date(+m[4], m[3] - 1, +m[2]); bill.admitted = m[2] + "-" + m[3] + "-" + m[4]; continue; }
    if ((m = l.match(/^(discharge|discharged|dod)\s*(?:date)?\s*[:\-]?\s*(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/i))) { discharge = new Date(+m[4], m[3] - 1, +m[2]); bill.discharged = m[2] + "-" + m[3] + "-" + m[4]; continue; }
    if (/^(patient|uhid|ip no|op no|mrn|age|ward no|consultant|ref(erred)? by|doctor)\s*[:\-]/i.test(l)) continue;
    if ((m = l.match(/^date\s*[:\-]?\s*(.+)$/i))) { bill.date = m[1].replace(/\s*time\s*[:\-]?\s*/i, " · "); continue; }
    if (/delivery order|take ?away|parcel/i.test(l) && !/fee|charge/i.test(l)) { bill.dineIn = false; continue; }
    if (/dine[- ]?in|table\s*\d/i.test(l) && !/\d+\.\d{2}$/.test(l)) { bill.dineIn = true; continue; }

    if ((m = l.match(new RegExp("^(.+?)\\s+(\\d{1,3})\\s+" + NUM + "\\s+" + NUM + "$", "i"))) && !pastItems) {
      let name = m[1].trim(), mrp = null;
      const mm = name.match(/\(\s*mrp\s*(?:rs\.?)?\s*([\d,]+\.\d{2})\s*\)/i);
      if (mm) { mrp = toPaise(mm[1]); name = name.replace(mm[0], "").trim(); }
      bill.items.push([name, parseInt(m[2], 10), toPaise(m[3]), mrp, toPaise(m[4])]);
      continue;
    }
    if ((m = l.match(new RegExp("^sub\\s*-?\\s*total\\b.*?" + NUM + "$", "i")))) { bill.printed.subtotal = toPaise(m[1]); pastItems = true; continue; }
    if ((m = l.match(new RegExp("^(?:disc(?:ount)?\\.?)\\s*(.*?)\\s*\\(?(\\d+(?:\\.\\d+)?)%\\)?\\s*" + NUM + "$", "i")))) {
      bill.printed.discount = { name: (m[1] || "Discount").trim() + " (" + m[2] + "%)", bp: toBp(m[2]), amt: Math.abs(toPaise(m[3])) };
      pastItems = true; continue;
    }
    if ((m = l.match(new RegExp("^(CGST|SGST|UTGST|IGST)\\s*@?\\s*(\\d+(?:\\.\\d+)?)\\s*%.*?" + NUM + "$", "i")))) {
      bill.printed.taxes.push({ name: m[1].toUpperCase(), bp: toBp(m[2]), amt: toPaise(m[3]) }); pastItems = true; continue;
    }
    if ((m = l.match(new RegExp("^round(?:ing)?\\s*-?\\s*off\\b.*?" + NUM + "$", "i")))) { bill.printed.round = toPaise(m[1]); pastItems = true; continue; }
    if ((m = l.match(new RegExp("^(?:grand\\s*|net\\s*)?(?:total|amount payable|bill amount)\\b.*?" + NUM + "$", "i")))) { bill.printed.total = toPaise(m[1]); pastItems = true; continue; }
    if ((m = l.match(new RegExp("^(.*?(?:charge|fee|surcharge|levy|cess|fund).*?)\\s+" + NUM + "$", "i")))) {
      const name = m[1].trim();
      const kind = /service/i.test(name) ? "service" : /packag|packing|container/i.test(name) ? "packaging"
        : /platform|convenience|handling/i.test(name) ? "platform" : /delivery/i.test(name) ? "delivery" : "other";
      bill.printed.fees.push({ name, amt: toPaise(m[2]), kind }); pastItems = true; continue;
    }
    if (!pastItems && !bill.items.length) header.push(l);
  }

  if (admit && discharge) bill.stayDays = Math.max(1, Math.round((discharge - admit) / 86400000));
  if (bill.category !== "restaurant" && bill.category !== "delivery") bill.dineIn = false;
  bill.merchant = header[0] ? titleCase(header[0]) : "";
  bill.place = header.slice(1, 3).join(", ");

  if (!bill.items.length || bill.printed.total === null) {
    throw new Error("We couldn't find line items and a total in this PDF. PayRight reads text-based PDF bills. Scanned photos of bills aren't supported yet.");
  }
  if (!bill.merchant) {
    bill.merchant = "Unknown merchant";
    bill.extra.push(needInfo("Merchant details missing", "No business name found", "We couldn't read the merchant's name, so this bill can't be linked to a merchant profile.", "Add the merchant name when you save the bill."));
  }
  if (bill.printed.subtotal === null) {
    bill.extra.push(needInfo("No subtotal printed", "Checked items against the total instead", "The bill doesn't show a subtotal line, so we used the sum of items.", "Nothing required."));
  }
  if (!bill.printed.taxes.length && bill.category !== "hospital") {
    bill.extra.push(needInfo("No GST lines found", "Tax may be included in prices", "We couldn't find CGST/SGST/IGST lines. Prices may be tax-inclusive, or tax may be missing.", "Check whether the menu says prices include GST."));
  }
  return bill;
}
function titleCase(s) {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\bAnd\b/g, "&") : s;
}
function needInfo(title, sub, explain, action) {
  return { status: "need", title, sub, amount: 0, explain, calc: "—", rule: "Missing information on the bill.", action, conf: "Parsing from PDF text", missing: title };
}
async function readBillPdf(file) {
  const lines = await extractPdfLines(file);
  return parseBillLines(lines, file.name);
}

/* ===========================================================
   3. The audit engine
   =========================================================== */
const STATUS = {
  ok: { label: "Verified", mark: '<span class="mark ok">✓</span>' },
  rev: { label: "Review", mark: '<span class="mark rev"><i>!</i></span>' },
  opt: { label: "Optional", mark: '<span class="mark opt">○</span>' },
  unx: { label: "Unexplained", mark: '<span class="mark unx">?</span>' },
  need: { label: "Needs info", mark: '<span class="mark need">…</span>' },
};

function audit(r) {
  const p = r.printed;
  const findings = [];
  const cat = r.category || "restaurant";
  const hosp = cat === "hospital";
  const lines = r.items.map(([name, qty, unit, mrp, printedLine]) => ({ name, qty, unit, mrp: mrp ?? null, printedLine: printedLine ?? qty * unit, total: qty * unit }));
  const ourSub = lines.reduce((s, l) => s + l.total, 0);
  const extract = r.source === "pdf" ? "PDF text 100%" : "Extraction 98%";

  // line items
  const badLines = lines.filter(l => l.printedLine !== l.total);
  badLines.forEach(l => findings.push({
    status: "rev", title: `"${l.name}" line total is wrong`, sub: `${l.qty} × ${rs(l.unit)} printed as ${rs(l.printedLine)}`, amount: l.printedLine - l.total,
    explain: `${l.qty} × ${rs(l.unit)} is ${rs(l.total)}, but the bill prints ${rs(l.printedLine)} for this line — ${rs(Math.abs(l.printedLine - l.total))} ${l.printedLine > l.total ? "more" : "less"}.`,
    calc: `${l.qty} × ${rs(l.unit)} = ${rs(l.total)} ≠ ${rs(l.printedLine)}`,
    rule: "Arithmetic check (deterministic).", action: "Ask for this line to be recalculated.", conf: `${extract} · Arithmetic 100%`,
  }));
  if (!badLines.length) findings.push({
    status: "ok", title: "Each line multiplies correctly", sub: `${lines.length} line items checked`, amount: ourSub,
    explain: "For every line we multiplied quantity by unit price and matched it to the printed line total.",
    calc: lines.map(l => `${l.qty} × ${rs(l.unit)} = ${rs(l.total)}`).join("<br>"),
    rule: "Arithmetic check (deterministic).", action: "Nothing to do.", conf: `${extract} · Arithmetic 100%`,
  });

  // subtotal
  if (p.subtotal !== null) {
    const d = p.subtotal - ourSub;
    findings.push(d === 0 ? {
      status: "ok", title: "Subtotal adds up", sub: `Printed ${rs(p.subtotal)} = our ${rs(ourSub)}`, amount: ourSub,
      explain: "The sum of all line items equals the printed subtotal.",
      calc: lines.map(l => rs(l.total)).join(" + ") + " = " + rs(ourSub),
      rule: "Arithmetic check (deterministic).", action: "Nothing to do.", conf: "Arithmetic 100%",
    } : {
      status: "rev", title: "Subtotal doesn't match the items", sub: `Printed ${rs(p.subtotal)} · items add to ${rs(ourSub)}`, amount: d,
      explain: `The items add up to ${rs(ourSub)}, but the printed subtotal is ${rs(p.subtotal)} — ${rs(Math.abs(d))} ${d > 0 ? "more" : "less"}. It could be a missed line, a manual entry or a mistake.`,
      calc: lines.map(l => rs(l.total)).join(" + ") + " = " + rs(ourSub) + `<br>Printed ${rs(p.subtotal)} → difference ${rs(d)}`,
      rule: "Arithmetic check (deterministic).", action: "Ask the cashier how the subtotal was calculated.", conf: `${extract} · Arithmetic 100%`,
      missing: "Was anything ordered that isn't printed on the bill?",
    });
  }

  // discount
  let ourDisc = 0;
  if (p.discount) {
    ourDisc = ofBp(ourSub, p.discount.bp);
    const ok = ourDisc === p.discount.amt;
    findings.push({
      status: ok ? "ok" : "rev", title: ok ? "Discount applied correctly" : "Discount amount looks off", sub: `${p.discount.name} · ${rs(p.discount.amt)}`, amount: p.discount.amt,
      explain: ok ? "The discount percentage was applied to the full subtotal." : `${pct(p.discount.bp)} of ${rs(ourSub)} is ${rs(ourDisc)}, but the bill deducts ${rs(p.discount.amt)}.`,
      calc: `${pct(p.discount.bp)} × ${rs(ourSub)} = ${rs(ourDisc)}`,
      rule: "Arithmetic check (deterministic).", action: ok ? "Nothing to do." : "Ask how the discount was calculated.", conf: "Arithmetic 100%",
    });
  }

  // taxes
  const base = ourSub - ourDisc;
  const svc = p.fees.filter(f => f.kind === "service").reduce((s, f) => s + f.amt, 0);
  let ourTax = 0;
  if (p.taxes.length) {
    let taxOk = true, onService = svc > 0;
    const calc = p.taxes.map(t => {
      const v = ofBp(base, t.bp); ourTax += v;
      if (v !== t.amt) taxOk = false;
      if (ofBp(base + svc, t.bp) !== t.amt) onService = false;
      return `${t.name} ${pct(t.bp)} × ${rs(base)} = ${rs(v)} (printed ${rs(t.amt)})`;
    });
    const printedTax = p.taxes.reduce((s, t) => s + t.amt, 0);
    const rate = p.taxes.reduce((s, t) => s + t.bp, 0);
    if (taxOk) findings.push({
      status: "ok", title: `GST ${pct(rate)} recalculated`, sub: p.taxes.map(t => `${t.name} ${rs(t.amt)}`).join(" + "), amount: printedTax,
      explain: (cat === "restaurant" ? "Tax was applied on the food amount only" : "Tax was applied on the item amount") + (p.taxes.length === 2 ? ", and CGST and SGST are equal halves as expected." : "."),
      calc: calc.join("<br>"), rule: "Arithmetic check. CGST = SGST for intra-state supply.", action: "Nothing to do.", conf: `${extract} · Arithmetic 100%`,
    });
    else if (onService) findings.push({
      status: "rev", title: "GST was charged on the service charge", sub: `Printed ${rs(printedTax)} · expected ${rs(ourTax)}`, amount: printedTax - ourTax,
      explain: "The tax matches the food amount plus the service charge. Current consumer-protection guidance says GST shouldn't be levied on a service charge added to the bill.",
      calc: calc.join("<br>") + `<br>${pct(rate)} × (${rs(base)} + ${rs(svc)} service) = ${rs(printedTax)} ← what was printed`,
      rule: "CCPA guidelines on service charge (4 Jul 2022). Check the latest version on the official source.", action: "Ask for the service charge and the tax on it to be removed.", conf: `${extract} · Rule applicability high`,
    });
    else findings.push({
      status: "rev", title: "Tax calculated on the wrong amount", sub: `Printed ${rs(printedTax)} · expected ${rs(ourTax)}`, amount: printedTax - ourTax,
      explain: "The tax rate is fine, but it was applied to a different amount than the items add up to, so the tax itself is off.",
      calc: calc.join("<br>"), rule: "Arithmetic check (deterministic).", action: "Mention this together with the subtotal difference.", conf: "Arithmetic 100%",
    });
  }

  // duplicates
  let dupValue = 0;
  const seen = {};
  lines.forEach(l => {
    const k = l.name.toLowerCase() + "|" + l.qty + "|" + l.unit;
    if (seen[k]) {
      const afterDisc = l.total - (p.discount ? ofBp(l.total, p.discount.bp) : 0);
      const withTax = afterDisc + p.taxes.reduce((s, t) => s + ofBp(afterDisc, t.bp), 0);
      dupValue += withTax;
      findings.push({
        status: "rev", title: `"${l.name}" appears twice`, sub: `${l.qty} × ${rs(l.unit)} on two separate lines`, amount: withTax,
        explain: hosp ? "Two identical lines can be a repeat test or procedure — or a duplicate entry. Check with your doctor's orders or reports." : "Two identical lines can be a genuine second order — or a duplicate. Only you know how many you received.",
        calc: `Line ${rs(l.total)} → after discount ${rs(afterDisc)} → incl. tax ${rs(withTax)}`,
        rule: "Pattern check: identical repeated line items.", action: "If you ordered it once, ask for this line to be removed.", conf: `${extract} · Duplicate pattern high`,
        missing: "How many did you actually order?",
      });
    }
    seen[k] = 1;
  });

  // MRP: an item charged above its printed maximum retail price
  let mrpExcess = 0;
  lines.filter(l => l.mrp !== null && l.unit > l.mrp).forEach(l => {
    const extra = (l.unit - l.mrp) * l.qty;
    mrpExcess += extra;
    findings.push({
      status: "rev", title: `"${l.name}" charged above MRP`, sub: `${rs(l.unit)} each · MRP ${rs(l.mrp)}`, amount: extra,
      explain: `The bill shows an MRP of ${rs(l.mrp)} but charges ${rs(l.unit)} per unit. Packaged goods and medicines generally shouldn't be sold above their MRP.`,
      calc: `(${rs(l.unit)} − ${rs(l.mrp)}) × ${l.qty} = ${rs(extra)} above MRP`,
      rule: "Legal Metrology (Packaged Commodities) Rules, 2011 — MRP is the maximum retail price.",
      action: "Ask for this item to be billed at or below MRP.", conf: `${extract} · Rule applicability high`,
    });
  });
  if (lines.some(l => l.mrp !== null) && !mrpExcess) findings.push({
    status: "ok", title: "Items within MRP", sub: `${lines.filter(l => l.mrp !== null).length} items with MRP checked`, amount: 0,
    explain: "Every item that shows an MRP was charged at or below it.", calc: lines.filter(l => l.mrp !== null).map(l => `${l.name}: ${rs(l.unit)} ≤ ${rs(l.mrp)}`).join("<br>"),
    rule: "Legal Metrology (Packaged Commodities) Rules, 2011.", action: "Nothing to do.", conf: extract,
  });

  // Hospital: per-day charges vs. length of stay
  let extraDays = 0;
  if (hosp && r.stayDays) {
    lines.filter(l => /room|bed|ward|icu|nursing|stay/i.test(l.name)).forEach(l => {
      if (l.qty > r.stayDays) {
        const v = (l.qty - r.stayDays) * l.unit;
        extraDays += v;
        findings.push({
          status: "rev", title: `${l.name}: ${l.qty} days billed`, sub: `Stay was ${r.stayDays} night${r.stayDays > 1 ? "s" : ""} (${r.admitted} → ${r.discharged})`, amount: v,
          explain: `This per-day charge is billed for ${l.qty} days, but the admission and discharge dates on the bill cover ${r.stayDays} night${r.stayDays > 1 ? "s" : ""}. Some hospitals count by calendar day, so ask how the days were counted.`,
          calc: `(${l.qty} − ${r.stayDays}) × ${rs(l.unit)} = ${rs(v)}`,
          rule: "Consistency check: per-day charges vs. dates printed on the bill.", action: "Ask the billing desk to explain the day count.", conf: `${extract} · Date match high`,
          missing: "The hospital's day-counting policy (by night or by calendar day).",
        });
      } else if (l.qty <= r.stayDays) {
        findings.push({
          status: "ok", title: `${l.name} matches the stay`, sub: `${l.qty} × ${rs(l.unit)} · ${r.stayDays}-night stay`, amount: l.total,
          explain: "The number of days billed is consistent with the admission and discharge dates.", calc: `${l.qty} days ≤ ${r.stayDays} nights`,
          rule: "Consistency check.", action: "Nothing to do.", conf: extract,
        });
      }
    });
  }
  // Hospital: GST on healthcare
  if (hosp && p.taxes.length) {
    const t = p.taxes.reduce((s, x) => s + x.amt, 0);
    findings.push({
      status: "need", title: "GST charged on a healthcare bill", sub: `${rs(t)} in GST`, amount: t,
      explain: "Healthcare services by clinical establishments are generally exempt from GST. GST can still apply to some items, such as non-ICU room rent above ₹5,000 a day or pharmacy sales. We can't tell which items the tax was applied to.",
      calc: p.taxes.map(x => `${x.name} ${pct(x.bp)} = ${rs(x.amt)}`).join("<br>"),
      rule: "GST exemption for health care services (Notification 12/2017-CT(Rate), as amended). Check the current position on the official source.",
      action: "Ask which items the GST applies to.", conf: `${extract} · Rule applicability medium`,
      missing: "Which line items the GST was charged on.",
    });
  }
  if (hosp) (r.extra = r.extra || []).some(x => x.beta) || r.extra.push({
    beta: true, status: "need", title: "Hospital checks are in beta", sub: "Arithmetic is exact · rules still being validated", amount: 0,
    explain: "Arithmetic, duplicates, MRP and day-count checks are reliable. Medical necessity, package rates and insurance coverage need human and expert review.",
    calc: "—", rule: "Category status: beta.", action: "Use this report as a starting point for questions to the billing desk.", conf: "Category coverage: partial",
  });

  // fees
  let optional = 0, unexplained = 0;
  p.fees.forEach(f => {
    if (hosp && /registration|consultation/i.test(f.name)) {
      findings.push({
        status: "ok", title: f.name, sub: `${rs(f.amt)} · standard one-time fee`, amount: f.amt,
        explain: "A one-time registration fee is common at clinics and hospitals and is clearly labelled.",
        calc: "Flat amount.", rule: "Disclosed fee type.", action: "Nothing to do.", conf: extract,
      });
      return;
    }
    if (hosp) {
      unexplained += f.amt;
      findings.push({
        status: "unx", title: f.name, sub: `${rs(f.amt)} with no item breakdown`, amount: f.amt,
        explain: "Lump-sum charges like administrative, miscellaneous or service fees often aren't itemised on hospital bills. You're entitled to ask what they cover.",
        calc: "Flat amount — no breakdown provided.",
        rule: "Charter of Patients' Rights (NHRC / MoHFW) — right to information on rates and an itemised bill.",
        action: "Request an itemised breakdown of this charge.", conf: `${extract} · Rule applicability medium`,
        missing: "An itemised breakdown from the hospital.",
      });
      return;
    }
    if (f.kind === "service") {
      optional += f.amt;
      findings.push({
        status: "opt", title: "Service charge", sub: `${f.name} · ${rs(f.amt)}`, amount: f.amt,
        explain: "Current Indian consumer-protection guidance says restaurants should not add a service charge automatically — paying it is your choice.",
        calc: `${rs(f.amt)} = ${(f.amt / ourSub * 100).toFixed(1)}% of ${rs(ourSub)}`,
        rule: "CCPA guidelines on levy of service charge in hotels & restaurants (4 Jul 2022). Check the latest version on the official source.",
        action: "You can politely ask for it to be removed, or keep it as a tip if you were happy.", conf: `${extract} · Rule applicability high`,
      });
    } else if (f.kind === "delivery" || (f.kind === "packaging" && !r.dineIn)) {
      findings.push({
        status: "ok", title: f.name, sub: `${rs(f.amt)} · flat fee on a delivery order`, amount: f.amt,
        explain: "A flat fee that is normal for delivery orders. Check that it matches what the app showed you at checkout.",
        calc: "Flat amount — no percentage to verify.", rule: "Disclosed fee type.", action: "Nothing to do, unless it differs from checkout.", conf: extract,
      });
    } else if (/carry ?bag|\bbag\b/i.test(f.name)) {
      findings.push({
        status: "need", title: f.name, sub: `${rs(f.amt)} added at billing`, amount: f.amt,
        explain: "Charging for carry bags has been challenged in consumer forums, especially for bags printed with the store's branding. It matters whether you were told about the charge before billing.",
        calc: "Flat amount.", rule: "No single verified rule — depends on facts and disclosure.", action: "If you weren't told beforehand, ask for it to be removed.", conf: `${extract} · Rule match low`,
        missing: "Were you told about the bag charge before billing?",
      });
    } else if (f.kind === "platform") {
      findings.push({
        status: "need", title: f.name, sub: `${rs(f.amt)} set by the ordering platform`, amount: f.amt,
        explain: "Platform and convenience fees are set by the app and should be shown before you pay. We can't see your checkout screen.",
        calc: "Flat amount — no percentage to verify.", rule: "No verified rule applied.", action: "Compare with the fee shown at checkout.", conf: `${extract} · Rule match low`,
        missing: "A screenshot of the checkout screen.",
      });
    } else {
      unexplained += f.amt;
      findings.push({
        status: "unx", title: f.name, sub: `${rs(f.amt)} on a ${r.dineIn ? "dine-in" : cat === "grocery" ? "store" : "takeaway"} bill`, amount: f.amt,
        explain: f.kind === "packaging" ? "Packaging charges usually relate to takeaway or delivery, and this looks like a dine-in bill." : "We couldn't establish what this fee is for.",
        calc: "Flat amount — no percentage to verify.",
        rule: "No verified rule applied. Treated as unexplained, not as wrong.", action: "Ask what the charge covers before paying it.", conf: `${extract} · Rule match low`,
        missing: "What does this charge cover?",
      });
    }
  });

  // grand total
  const fees = p.fees.reduce((s, f) => s + f.amt, 0);
  const ourTotal = ourSub - ourDisc + ourTax + fees + p.round;
  const totDiff = p.total - ourTotal;
  findings.push(totDiff === 0 ? {
    status: "ok", title: "Grand total matches", sub: `Our total ${rs(ourTotal)}`, amount: ourTotal,
    explain: `We rebuilt the bill from scratch and got the same total.${p.round ? " The round-off of " + rs(p.round) + " is within 50 paise." : ""}`,
    calc: `${rs(ourSub)}${ourDisc ? " − " + rs(ourDisc) : ""}${ourTax ? " + " + rs(ourTax) + " tax" : ""}${fees ? " + " + rs(fees) + " fees" : ""}${p.round ? " + " + rs(p.round) + " round-off" : ""} = ${rs(ourTotal)}`,
    rule: "Arithmetic check (deterministic).", action: "Nothing to do.", conf: "Arithmetic 100%",
  } : {
    status: "rev", title: totDiff > 0 ? "Grand total is higher than it should be" : "Grand total is lower than expected", sub: `Printed ${rs(p.total)} · ours ${rs(ourTotal)}`, amount: totDiff,
    explain: `Rebuilding the bill from its own line items gives ${rs(ourTotal)}. The printed total differs by ${rs(Math.abs(totDiff))}. This is pure arithmetic — it doesn't depend on any legal interpretation.`,
    calc: `${rs(ourSub)}${ourDisc ? " − " + rs(ourDisc) : ""} + ${rs(ourTax)} tax${fees ? " + " + rs(fees) : ""}${p.round ? " + " + rs(p.round) : ""} = ${rs(ourTotal)}<br>Printed ${rs(p.total)} − ${rs(ourTotal)} = ${rs(totDiff)}`,
    rule: "Arithmetic check (deterministic).", action: "Show the cashier this calculation and ask for a corrected bill.", conf: `${extract} · Arithmetic 100%`,
  });

  (r.extra || []).forEach(x => findings.push(x));
  const order = { rev: 0, unx: 1, opt: 2, need: 3, ok: 4 };
  findings.sort((a, b) => order[a.status] - order[b.status]);

  const counts = {};
  findings.forEach(f => counts[f.status] = (counts[f.status] || 0) + 1);
  const worst = findings[0] ? findings[0].status : "ok";

  return {
    lines, ourSub, ourDisc, ourTax, fees, ourTotal, findings, counts, worst,
    money: { over: Math.max(0, totDiff), contest: dupValue + mrpExcess + extraDays, optional, unexplained, refund: 0 },
  };
}

function headline(a) {
  const issues = (a.counts.rev || 0) + (a.counts.unx || 0);
  if (issues) return `${issues} thing${issues > 1 ? "s" : ""} worth a question.`;
  if (a.counts.opt) return "The maths is right. One charge is your choice.";
  if (a.counts.need) return "Adds up — a little context is missing.";
  return "Everything checks out.";
}

function clarificationMessage(r, a) {
  const points = a.findings.filter(f => ["rev", "unx", "opt"].includes(f.status));
  if (!points.length) return `Hello,\n\nThank you for the visit to ${r.merchant}. I checked the bill and everything adds up. Thanks for the clear billing!`;
  const ls = points.map(f => {
    if (f.status === "opt") return `• The ${f.title.toLowerCase()} of ${rs(f.amount)} — I understand this is voluntary, and I'd like it removed.`;
    if (f.status === "unx") return `• "${f.title}" of ${rs(f.amount)} — could you tell me what this covers?`;
    return `• ${f.title}: ${f.sub}.`;
  });
  return `Hello,\n\nThank you for the visit to ${r.merchant}${r.date ? " on " + r.date.split(" · ")[0] : ""}. Before paying, I checked the bill and had a few questions:\n\n${ls.join("\n")}\n\nCould you please take a look and share a corrected bill if needed?\n\nThank you.`;
}
