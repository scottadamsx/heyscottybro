/**
 * markdownToPdf — turn an agent's Markdown reply into a real PDF, with no
 * dependencies. We hand-build the PDF byte stream (same dependency-light spirit
 * as utils/markdown.js) so agents can "show their work" as a proper, paginated,
 * downloadable document that opens in the in-app PdfViewer.
 *
 * Scope: text documents. Supports a title block, H1–H3 headings, paragraphs
 * with word-wrap, bullet/numbered lists, fenced code (monospace), simple tables
 * and horizontal rules. Inline emphasis markers are flattened to plain text
 * (raw PDF can't easily style mid-line), links render as "text (url)".
 *
 * Uses only the three standard Type1 fonts (Helvetica, Helvetica-Bold, Courier),
 * so nothing is embedded. Output is pure ASCII (WinAnsi), which keeps byte
 * offsets == string length and the writer trivial.
 */

// ── Standard AFM advance widths (units / 1000 em) for codes 32–126 ───────────
// Accurate widths give correct word-wrapping without embedding metrics files.
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELVB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const COURIER_W = 600; // monospace: every glyph is 600

function charWidth(code, widths) {
  if (code < 32 || code > 126) code = 63; // '?'
  return widths[code - 32];
}
function measure(str, font, size) {
  if (font === "courier") return str.length * COURIER_W / 1000 * size;
  const widths = font === "bold" ? HELVB : HELV;
  let w = 0;
  for (let i = 0; i < str.length; i++) w += charWidth(str.charCodeAt(i), widths);
  return w / 1000 * size;
}

// ── Text cleanup ─────────────────────────────────────────────────────────────
// Map common typographic unicode to ASCII, drop anything else outside 32–126.
function sanitize(s) {
  return String(s)
    .replace(/[‘’‚‹›]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/[•·●▪]/g, "*")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/\t/g, "    ")
    .replace(/[^\x20-\x7E]/g, "?");
}
// Flatten inline markdown to readable plain text.
function stripInline(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")                 // images
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)") // links
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")                          // inline code
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/__([^_]+?)__/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+?)\*/g, "$1$2")
    .replace(/(^|[^_])_([^_\n]+?)_/g, "$1$2");
}
const clean = (s) => sanitize(stripInline(s));

// ── PDF string escaping ──────────────────────────────────────────────────────
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

// ── Markdown → block list ────────────────────────────────────────────────────
function parseBlocks(md) {
  const lines = String(md || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {                              // fenced code
      i++;
      const code = [];
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++;
      blocks.push({ type: "code", lines: code });
      continue;
    }
    // table: header row + |---| separator
    if (line.includes("|") && i + 1 < lines.length && /^[\s:|-]+$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
      const row = (l) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const header = row(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") { rows.push(row(lines[i])); i++; }
      blocks.push({ type: "table", header, rows });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ type: "h", level: Math.min(h[1].length, 3), text: h[2] }); i++; continue; }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { blocks.push({ type: "hr" }); i++; continue; }

    const ul = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (ul) { blocks.push({ type: "li", indent: Math.floor(ul[1].length / 2), bullet: "*", text: ul[2] }); i++; continue; }
    const ol = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (ol) { blocks.push({ type: "li", indent: Math.floor(ol[1].length / 2), bullet: `${ol[2]}.`, text: ol[3] }); i++; continue; }

    if (line.trim() === "") { blocks.push({ type: "space" }); i++; continue; }

    blocks.push({ type: "p", text: line });               // paragraph (one source line)
    i++;
  }
  return blocks;
}

// ── Word-wrap a string to a max width in points ──────────────────────────────
function wrap(text, font, size, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const out = [];
  let cur = "";
  for (const word of words) {
    let w = word;
    // Break a single over-long word by characters.
    while (measure(w, font, size) > maxW && w.length > 1) {
      let cut = w.length;
      while (cut > 1 && measure(w.slice(0, cut), font, size) > maxW) cut--;
      out.push((cur ? cur + " " : "") + w.slice(0, cut));
      cur = "";
      w = w.slice(cut);
    }
    const trial = cur ? cur + " " + w : w;
    if (measure(trial, font, size) > maxW && cur) { out.push(cur); cur = w; }
    else cur = trial;
  }
  if (cur) out.push(cur);
  return out;
}

// ── Page geometry & type scale ───────────────────────────────────────────────
const PAGE_W = 612, PAGE_H = 792;
const ML = 56, MR = 56, MT = 70, MB = 58;
const CONTENT_W = PAGE_W - ML - MR;
const TYPE = {
  title:   { font: "bold", size: 20, lead: 26, before: 0,  after: 4 },
  sub:     { font: "reg",  size: 10, lead: 14, before: 0,  after: 10 },
  h1:      { font: "bold", size: 16, lead: 22, before: 14, after: 4 },
  h2:      { font: "bold", size: 13, lead: 18, before: 12, after: 3 },
  h3:      { font: "bold", size: 11, lead: 15, before: 10, after: 2 },
  p:       { font: "reg",  size: 10.5, lead: 15, before: 0, after: 6 },
  li:      { font: "reg",  size: 10.5, lead: 15, before: 0, after: 2 },
  code:    { font: "courier", size: 9, lead: 12.5, before: 4, after: 6 },
  table:   { font: "courier", size: 8.5, lead: 12, before: 6, after: 8 },
  footer:  { font: "reg",  size: 8, lead: 10 },
};
const FONT_KEY = { reg: "F1", bold: "F2", courier: "F3" };

// ── Lay blocks out into positioned page lines ────────────────────────────────
// Each emitted line: { x, font, size, text, color? }
function layout(blocks, title, subtitle) {
  const pages = [];
  let cur = [];
  let y = PAGE_H - MT;

  const newPage = () => { pages.push(cur); cur = []; y = PAGE_H - MT; };
  const room = (need) => { if (y - need < MB) newPage(); };

  const emit = (text, style, x = ML, color) => {
    room(style.lead);
    y -= style.lead;
    cur.push({ x, y, font: style.font, size: style.size, text, color });
  };

  // Title block (page 1 only)
  if (title) {
    for (const ln of wrap(sanitize(title), "bold", TYPE.title.size, CONTENT_W)) emit(ln, TYPE.title);
    if (subtitle) { y -= 2; for (const ln of wrap(sanitize(subtitle), "reg", TYPE.sub.size, CONTENT_W)) emit(ln, TYPE.sub, ML, [0.42, 0.45, 0.5]); }
    y -= 4;
    cur.push({ rule: true, y: y, x: ML, w: CONTENT_W }); // header rule
    y -= 12;
  }

  for (const b of blocks) {
    if (b.type === "space") { y -= 6; continue; }

    if (b.type === "hr") {
      room(14); y -= 8;
      cur.push({ rule: true, y, x: ML, w: CONTENT_W, faint: true });
      y -= 6;
      continue;
    }

    if (b.type === "h") {
      const st = TYPE[`h${b.level}`];
      y -= st.before;
      for (const ln of wrap(clean(b.text), st.font, st.size, CONTENT_W)) emit(ln, st);
      y -= st.after;
      continue;
    }

    if (b.type === "p") {
      const st = TYPE.p;
      for (const ln of wrap(clean(b.text), st.font, st.size, CONTENT_W)) emit(ln, st);
      y -= st.after;
      continue;
    }

    if (b.type === "li") {
      const st = TYPE.li;
      const pad = b.indent * 16;
      const marker = b.bullet === "*" ? "•".replace("•", "-") : b.bullet; // ASCII bullet
      const labelW = measure(marker + " ", st.font, st.size);
      const textX = ML + pad + labelW;
      const wrapped = wrap(clean(b.text), st.font, st.size, CONTENT_W - pad - labelW);
      wrapped.forEach((ln, idx) => {
        room(st.lead); y -= st.lead;
        if (idx === 0) cur.push({ x: ML + pad, y, font: st.font, size: st.size, text: marker });
        cur.push({ x: textX, y, font: st.font, size: st.size, text: ln });
      });
      y -= st.after;
      continue;
    }

    if (b.type === "code") {
      const st = TYPE.code;
      y -= st.before;
      const maxCharW = CONTENT_W - 16;
      for (const raw of b.lines) {
        const text = sanitize(raw.replace(/\t/g, "    "));
        // hard-wrap long code lines on character width
        let s = text.length ? text : " ";
        while (s.length) {
          let cut = s.length;
          while (cut > 1 && measure(s.slice(0, cut), "courier", st.size) > maxCharW) cut--;
          emit(s.slice(0, cut), st, ML + 8, [0.20, 0.22, 0.27]);
          s = s.slice(cut);
        }
      }
      y -= st.after;
      continue;
    }

    if (b.type === "table") {
      const st = TYPE.table;
      const cols = b.header.length;
      const cells = [b.header, ...b.rows].map((r) => {
        const c = r.slice(0, cols);
        while (c.length < cols) c.push("");
        return c.map((x) => clean(x));
      });
      const widths = [];
      for (let c = 0; c < cols; c++) widths[c] = Math.min(28, Math.max(...cells.map((r) => r[c].length), 1));
      const pad = (s, w) => (s.length > w ? s.slice(0, w - 1) + "." : s + " ".repeat(w - s.length));
      const renderRow = (r) => r.map((x, c) => pad(x, widths[c])).join(" | ");
      const lines = [renderRow(cells[0]), widths.map((w) => "-".repeat(w)).join("-+-"), ...cells.slice(1).map(renderRow)];
      y -= st.before;
      for (const ln of lines) {
        let s = ln;
        const maxCharW = CONTENT_W;
        while (measure(s, "courier", st.size) > maxCharW && s.length > 1) s = s.slice(0, -1);
        emit(s, st);
      }
      y -= st.after;
      continue;
    }
  }
  pages.push(cur);
  return pages;
}

// ── Serialize positioned lines → a PDF content stream ────────────────────────
function streamFor(lines, pageNum, pageCount, footerText) {
  let s = "";
  let curColor = null;
  const setColor = (c) => {
    const col = c || [0, 0, 0];
    const key = col.join(",");
    if (key !== curColor) { s += `${col[0]} ${col[1]} ${col[2]} rg\n`; curColor = key; }
  };
  for (const it of lines) {
    if (it.rule) {
      const g = it.faint ? 0.85 : 0.72;
      s += `${g} ${g} ${g} RG 0.7 w\n${it.x} ${it.y} m ${it.x + it.w} ${it.y} l S\n`;
      curColor = null; // S/RG don't change fill, but reset to be safe
      continue;
    }
    setColor(it.color);
    s += `BT /${FONT_KEY[it.font]} ${it.size} Tf 1 0 0 1 ${it.x.toFixed(2)} ${it.y.toFixed(2)} Tm (${esc(it.text)}) Tj ET\n`;
  }
  // Footer: page number (centre) + optional label (left), in grey.
  const f = TYPE.footer;
  const num = `${pageNum} / ${pageCount}`;
  const numX = (PAGE_W - measure(num, "reg", f.size)) / 2;
  s += `0.55 0.57 0.6 rg\n`;
  s += `BT /F1 ${f.size} Tf 1 0 0 1 ${numX.toFixed(2)} ${(MB - 22).toFixed(2)} Tm (${esc(num)}) Tj ET\n`;
  if (footerText) {
    const ft = sanitize(footerText);
    s += `BT /F1 ${f.size} Tf 1 0 0 1 ${ML} ${(MB - 22).toFixed(2)} Tm (${esc(ft)}) Tj ET\n`;
  }
  return s;
}

// ── Assemble the PDF document (objects + xref) ───────────────────────────────
function assemble(pageStreams, info) {
  // Object numbering: 1 Catalog, 2 Pages, 3 F1, 4 F2, 5 F3, 6 Info,
  // then per page: page obj, content obj.
  const objs = [];
  const FONTS = [
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  ];
  const n = pageStreams.length;
  const pageObjNum = (idx) => 7 + idx * 2;
  const contentObjNum = (idx) => 8 + idx * 2;

  objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[2] = `<< /Type /Pages /Count ${n} /Kids [${pageStreams.map((_, i) => `${pageObjNum(i)} 0 R`).join(" ")}] >>`;
  objs[3] = FONTS[0];
  objs[4] = FONTS[1];
  objs[5] = FONTS[2];
  const d = new Date();
  const z = (x) => String(x).padStart(2, "0");
  const date = `D:${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
  objs[6] = `<< /Producer (heyscottybro Command Center) /Title (${esc(sanitize(info.title || "Document"))}) /CreationDate (${date}) >>`;

  pageStreams.forEach((stream, i) => {
    objs[pageObjNum(i)] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjNum(i)} 0 R >>`;
    objs[contentObjNum(i)] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  });

  const maxObj = 6 + n * 2;
  let body = "%PDF-1.4\n";
  const offsets = [];
  for (let num = 1; num <= maxObj; num++) {
    offsets[num] = body.length;
    body += `${num} 0 obj\n${objs[num]}\nendobj\n`;
  }
  const xrefStart = body.length;
  let xref = `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
  for (let num = 1; num <= maxObj; num++) xref += `${String(offsets[num]).padStart(10, "0")} 00000 n \n`;
  body += xref;
  body += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  // All content is ASCII, so a 1-byte-per-char encoding is exact.
  const bytes = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xff;
  return bytes;
}

/**
 * Render Markdown to a PDF Blob.
 * @param {string} markdown
 * @param {{title?:string, subtitle?:string, footer?:string}} [opts]
 * @returns {Blob}
 */
export function markdownToPdfBlob(markdown, opts = {}) {
  const { title = "", subtitle = "", footer = "" } = opts;
  const blocks = parseBlocks(markdown);
  const pages = layout(blocks, title, subtitle);
  const streams = pages.map((lines, i) => streamFor(lines, i + 1, pages.length, footer));
  const bytes = assemble(streams, { title });
  return new Blob([bytes], { type: "application/pdf" });
}

/** Convenience: Blob → object URL (remember to revoke when done). */
export function markdownToPdfUrl(markdown, opts) {
  return URL.createObjectURL(markdownToPdfBlob(markdown, opts));
}
