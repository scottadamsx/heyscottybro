/**
 * Minimal, safe Markdown → HTML for chat messages.
 * Escapes HTML first, then applies a small subset: headings, bold, italic,
 * inline code, code fences, links, bullet/numbered lists, and tables (grids).
 */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+?)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
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
      html += "<div class='chat-grid-wrap'><table class='chat-grid'><thead><tr>" + header.map((h) => `<th>${inline(escapeHtml(h))}</th>`).join("") + "</tr></thead><tbody>";
      html += rows.map((r) => "<tr>" + r.map((c) => `<td>${inline(escapeHtml(c))}</td>`).join("") + "</tr>").join("");
      html += "</tbody></table></div>";
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) { closeLists(); const lvl = Math.min(heading[1].length + 3, 6); html += `<h${lvl}>${inline(escapeHtml(heading[2]))}</h${lvl}>`; i++; continue; }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) { if (!inOl) { /* keep */ } if (!inUl) { closeLists(); html += "<ul>"; inUl = true; } html += `<li>${inline(escapeHtml(ul[1]))}</li>`; i++; continue; }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) { if (!inOl) { closeLists(); html += "<ol>"; inOl = true; } html += `<li>${inline(escapeHtml(ol[1]))}</li>`; i++; continue; }

    if (line.trim() === "") { closeLists(); i++; continue; }

    closeLists();
    html += `<p>${inline(escapeHtml(line))}</p>`;
    i++;
  }
  closeLists();
  return html;
}
