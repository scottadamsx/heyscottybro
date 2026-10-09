/**
 * Minimal, safe Markdown → HTML for chat messages.
 * Escapes HTML first, then applies a small subset: headings, bold, italic,
 * inline code, code fences, links, bullet/numbered lists, and tables (grids).
 */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInlineText(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+?)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+?)\*/g, "<em>$1</em>");
}

function nextMarkdownLink(s, fromIndex) {
  let start = s.indexOf("[", fromIndex);
  while (start >= 0) {
    const labelEnd = s.indexOf("]", start + 1);
    if (labelEnd < 0) return null;
    if (s[labelEnd + 1] !== "(") {
      start = s.indexOf("[", start + 1);
      continue;
    }

    let depth = 1;
    let cursor = labelEnd + 2;
    while (cursor < s.length && depth > 0) {
      if (s[cursor] === "(") depth += 1;
      else if (s[cursor] === ")") depth -= 1;
      cursor += 1;
    }
    if (depth !== 0) return null;

    return {
      start,
      end: cursor,
      label: s.slice(start + 1, labelEnd),
      href: s.slice(labelEnd + 2, cursor - 1),
      source: s.slice(start, cursor),
    };
  }
  return null;
}

function safeHttpUrl(value) {
  if (!value) return false;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (/\s/.test(char) || code <= 31 || code === 127) return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function safeDocumentUrl(value) {
  if (!/^\/admin\/vault\?tab=documents&open=[0-9a-f-]{36}$/i.test(value || "")) return false;
  try {
    const parsed = new URL(value, "https://heyscottybro.invalid");
    return parsed.origin === "https://heyscottybro.invalid"
      && parsed.pathname === "/admin/vault"
      && parsed.searchParams.get("tab") === "documents"
      && /^[0-9a-f-]{36}$/i.test(parsed.searchParams.get("open") || "");
  } catch {
    return false;
  }
}

function inline(s) {
  let html = "";
  let cursor = 0;
  for (;;) {
    const link = nextMarkdownLink(s, cursor);
    if (!link) break;
    html += formatInlineText(s.slice(cursor, link.start));
    html += safeHttpUrl(link.href)
      ? `<a href="${escapeHtmlAttribute(link.href)}" target="_blank" rel="noreferrer">${formatInlineText(link.label)}</a>`
      : safeDocumentUrl(link.href)
        ? `<a href="${escapeHtmlAttribute(link.href)}">${formatInlineText(link.label)}</a>`
      : formatInlineText(link.source);
    cursor = link.end;
  }
  return html + formatInlineText(s.slice(cursor));
}

function splitRow(line) {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
}

export function renderMarkdown(text) {
  if (!text) return "";
  const lines = String(text).split(/\r?\n/);
  let html = "";
  let inUl = false;
  let inOl = false;
  const closeLists = () => {
    if (inUl) { html += "</ul>"; inUl = false; }
    if (inOl) { html += "</ol>"; inOl = false; }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // code fence
    if (/^```/.test(line)) {
      closeLists();
      let code = "";
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code += escapeHtml(lines[i]) + "\n"; i++; }
      i++;
      html += `<pre><code>${code}</code></pre>`;
      continue;
    }

    // table: a row of pipes followed by a |---|---| separator
    if (line.includes("|") && i + 1 < lines.length && /-/.test(lines[i + 1]) && /^[\s:|-]+$/.test(lines[i + 1])) {
      closeLists();
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") { rows.push(splitRow(lines[i])); i++; }
      html += "<div class='chat-grid-wrap'><table class='chat-grid'><thead><tr>" + header.map((h) => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>";
      html += rows.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("");
      html += "</tbody></table></div>";
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { closeLists(); const lvl = Math.min(heading[1].length + 3, 6); html += `<h${lvl}>${inline(heading[2])}</h${lvl}>`; i++; continue; }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) { if (!inUl) { closeLists(); html += "<ul>"; inUl = true; } html += `<li>${inline(ul[1])}</li>`; i++; continue; }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) { if (!inOl) { closeLists(); html += "<ol>"; inOl = true; } html += `<li>${inline(ol[1])}</li>`; i++; continue; }

    if (line.trim() === "") { closeLists(); i++; continue; }

    closeLists();
    html += `<p>${inline(line)}</p>`;
    i++;
  }
  closeLists();
  return html;
}
