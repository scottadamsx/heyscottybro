/**
 * Kiwi games shell — heyscottybro port (source of truth: kiwi-ide
 * kiwi-editor/src/vs/workbench/contrib/kiwi/browser/games/shell.ts).
 * The paper-&-clay skin is kept verbatim (fonts swapped to system stacks);
 * completion is re-pointed from the VS Code webview bridge to
 * parent.postMessage so GameFrame can score it. Games call
 * kiwiComplete(bonusPts, score, won) exactly as they do inside Kiwi.
 */

export const SHELL_HEAD = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  /* Paper & clay — a warm, branded surface (independent of editor theme, to match
     the Kiwi engage mockups). Sage green + gold play supporting roles. */
  :root{
    --bg:#FBFAF4; --card:#FFFFFF; --line:#E2DCCC; --fg:#2E2B25; --muted:#8C8676;
    --clay:#D97757; --clay-d:#C26343; --tint:#F6E9E2; --chip:#F3EFE7;
    --green:#6F9A4E; --green2:#557F38; --gold:#D9A65C; --gtext:#ffffff;
    /* Game tile fills (Memory, Minesweeper, 2048, Whack…) — must be visible vs. the bg. */
    --tile:#E7E0CE; --hover:#EFE9DA;
    --display:'Newsreader',Georgia,'Times New Roman',serif;
    --sans:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  /* Fit-to-window: center the activity, never scroll the page itself. */
  body{margin:0;font-family:var(--sans);background:var(--bg);color:var(--fg);line-height:1.5;
       overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:26px 28px}
  .wrap{width:100%;max-width:760px;margin:0 auto;display:flex;flex-direction:column;min-height:0}
  .k-label{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--clay-d)}
  .k-title,h1{font-family:var(--display);font-weight:500;font-size:30px;line-height:1.12;margin:6px 0 0;color:var(--fg)}
  .k-sub,.sub{color:var(--muted);font-size:13.5px;margin-top:6px}
  .reward{color:var(--clay-d);font-weight:600}
  .sim{display:none}
  /* Segmented progress (done = green, current = clay, rest = line). */
  .k-prog{display:flex;gap:6px;margin-bottom:18px}
  .k-prog>i{flex:1;height:4px;border-radius:999px;background:var(--line)}
  .k-prog>i.done{background:var(--green)} .k-prog>i.cur{background:var(--clay)}
  /* Option cards */
  .k-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px}
  @media (max-width:520px){ .k-grid{grid-template-columns:1fr} }
  .k-opt{display:flex;align-items:center;gap:16px;width:100%;text-align:left;cursor:pointer;
         background:var(--card);border:1.5px solid var(--line);border-radius:16px;padding:16px 18px;
         font-family:var(--display);font-size:21px;color:var(--fg);transition:border-color .12s,background .12s}
  .k-opt:hover{border-color:#dcd5c6}
  .k-opt.sel{border-color:var(--clay);background:var(--tint)}
  .k-opt-ic{flex:0 0 auto;width:44px;height:44px;border-radius:12px;background:var(--chip);
            display:flex;align-items:center;justify-content:center;font-size:20px}
  .k-opt.sel .k-opt-ic{background:var(--clay);color:#fff}
  .k-actions{display:flex;align-items:center;justify-content:space-between;margin-top:24px}
  .k-hint{color:var(--muted);font-size:13px}
  .k-primary{background:var(--clay);color:var(--gtext);border:0;border-radius:14px;padding:14px 26px;
             font-family:var(--sans);font-weight:600;font-size:15px;cursor:pointer;box-shadow:0 8px 20px -10px rgba(201,96,60,.6)}
  .k-primary:hover{background:var(--clay-d)} .k-primary:disabled{opacity:.5;cursor:default;box-shadow:none}
  .k-ghost{background:var(--card);color:var(--fg);border:1.5px solid var(--line);border-radius:12px;
           padding:11px 18px;font-family:var(--sans);font-weight:600;font-size:14px;cursor:pointer}
  .k-ghost:hover{background:var(--chip)}
  .center{text-align:center}
  /* Two centered divs side by side: title/info on the left, the game/video on the right. */
  .k-split{display:flex;flex-direction:row;align-items:center;justify-content:center;gap:44px;width:100%;flex-wrap:wrap}
  .k-split>.k-left{flex:0 1 360px;min-width:240px;max-width:420px}
  .k-split>.k-right{flex:0 0 auto;display:flex;align-items:center;justify-content:center}
  @media (max-width:600px){ .k-split{gap:22px} .k-split>.k-left{flex:1 1 100%;max-width:none} }
  /* Game canvases/boards: keep their natural size, centered — don't let the column's
     align-items:stretch blow them up to full width. Cap so they always fit. */
  canvas{align-self:center;max-width:100%;max-height:48vh}
  #grid,#board,#pads,.gameboard,.adwrap{align-self:center;max-width:100%}
  /* Generic button fallback (older games) — clay pill. */
  button{background:var(--clay);color:var(--gtext);border:0;border-radius:12px;padding:11px 20px;font-family:var(--sans);font-weight:600;cursor:pointer;font-size:14px}
  button:hover{background:var(--clay-d)} button:disabled{opacity:.5;cursor:default}
  p{margin:0 0 12px}
  .cell,.mc,.ft,.hole,.pad{padding:0!important;line-height:1;font-family:inherit}
  /* Shake (invalid Word Break key) + score pop (point feedback). */
  @keyframes kshake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}60%{transform:translateX(4px)}}
  .shake{animation:kshake .28s}
  @keyframes kpop{0%{transform:scale(1)}35%{transform:scale(1.22)}100%{transform:scale(1)}}
  .k-earn{font-weight:700;color:var(--clay-d);display:inline-block}
  .k-earn.pop,.pop{animation:kpop .35s}
  .k-win{color:var(--green);font-weight:700} .k-lose{color:var(--clay-d);font-weight:700}
  /* Big live score for games — large so you can read it at a glance while playing. */
  .k-bigscore{display:flex;align-items:baseline;gap:12px;margin-top:10px}
  .k-bigscore-n{font-family:var(--display);font-weight:700;font-size:56px;line-height:1;color:var(--fg);font-variant-numeric:tabular-nums}
  .k-bigscore-hi{font-size:13px;font-weight:700;letter-spacing:.06em;color:var(--clay-d)}
  @media (max-height:560px){ .k-bigscore-n{font-size:42px} }
  /* Tighten for short panels so things still fit without scrolling. */
  @media (max-height:560px){ body{padding:18px 22px} .k-title,h1{font-size:24px} .k-grid{margin-top:14px;gap:10px} .k-opt{padding:12px 14px;font-size:18px} .k-opt-ic{width:38px;height:38px} .k-actions{margin-top:16px} }
  @media (max-height:420px){ .k-title,h1{font-size:20px} .k-opt{font-size:16px} }
  /* --- B13 premium game shell: shared vocabulary every game can adopt --------------------- */
  /* Stage: the board/canvas frame — a designed paper card, not a floating void. */
  .k-right{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:20px;
           box-shadow:0 14px 32px -20px rgba(46,43,37,.38),0 2px 10px -6px rgba(46,43,37,.16)}
  @media (max-width:600px){ .k-right{padding:14px;border-radius:16px} }
  /* HUD strip: title / one-line rule / status cluster (score + earn chip) — see gameHead(). */
  .k-hud-rule{height:1px;border:0;background:var(--line);margin:12px 0 2px}
  /* Small pill chip (best-tile, pairs-progress, etc.) */
  .k-chip{display:inline-flex;align-items:center;gap:6px;background:var(--chip);color:var(--clay-d);
          font-size:11.5px;font-weight:700;letter-spacing:.02em;padding:5px 10px;border-radius:999px}
  /* Earn button as a chip: locked -> claimable (soft glow the moment it unlocks). */
  .k-earnbtn.k-earn-ready{animation:kglowpulse 900ms ease-out}
  @keyframes kglowpulse{0%{box-shadow:0 0 0 0 rgba(217,119,87,.55)}70%{box-shadow:0 0 0 14px rgba(217,119,87,0)}100%{box-shadow:0 0 0 0 rgba(217,119,87,0)}}
  /* Press-down feedback for interactive controls. */
  .k-press{transition:transform .08s ease}
  .k-press:active{transform:scale(.96)}
  /* Tile spawn / merge (2048 et al). */
  @keyframes ktilepop{0%{transform:scale(.55);opacity:.3}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
  .k-tilepop{animation:ktilepop .26s cubic-bezier(.2,.9,.3,1.2)}
  @keyframes kmergepulse{0%{transform:scale(1)}40%{transform:scale(1.16)}100%{transform:scale(1)}}
  .k-mergepulse{animation:kmergepulse .22s ease-out}
  /* Refined shake (mismatch / invalid input) — softer than the legacy .shake. */
  @keyframes kshakesoft{0%,100%{transform:translateX(0) rotate(0)}25%{transform:translateX(-3px) rotate(-2deg)}75%{transform:translateX(3px) rotate(2deg)}}
  .k-shake-soft{animation:kshakesoft .4s ease-in-out}
  /* CPU "thinking" pulse. */
  @keyframes kthinkdot{0%,100%{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1.1)}}
  .k-thinking{animation:kthinkdot 1s ease-in-out infinite}
  /* Win glow-pulse — a tasteful celebration beat, no confetti libs. */
  @keyframes kwinglow{0%{box-shadow:0 0 0 0 rgba(111,154,78,.5)}70%{box-shadow:0 0 0 16px rgba(111,154,78,0)}100%{box-shadow:0 0 0 0 rgba(111,154,78,0)}}
  .k-winglow{animation:kwinglow 1.1s ease-out}
  /* Progress pips — filled/empty round indicators (best-of trackers, pairs matched, etc.). */
  .k-pips{display:flex;gap:7px}
  .k-pip{width:9px;height:9px;border-radius:50%;background:var(--line);transition:background .15s,transform .15s}
  .k-pip.k-pip-win{background:var(--green)}
  .k-pip.k-pip-lose{background:var(--clay)}
  .k-pip.k-pip-draw{background:var(--muted)}
  /* Floating "+delta" score pop. */
  @keyframes kfloatup{0%{opacity:0;transform:translateY(4px) scale(.9)}20%{opacity:1;transform:translateY(-2px) scale(1.05)}100%{opacity:0;transform:translateY(-20px) scale(1)}}
  .k-scoredelta{position:absolute;font-weight:700;color:var(--clay-d);font-size:13px;pointer-events:none;animation:kfloatup .9s ease-out forwards}
  @media (prefers-reduced-motion:reduce){
    .k-earnbtn.k-earn-ready,.k-tilepop,.k-mergepulse,.k-shake-soft,.k-thinking,.k-winglow,.k-scoredelta,.shake,.pop{animation:none!important}
    .k-press:active{transform:none}
  }
</style>`;

export const DARK_SHELL_STYLE = ""; // paper skin only — Kiwi's dark variant depends on Kiwi-side tokens

// Kiwi pays Seeds; study breaks pay points.
export function reward(usd) {
  return `${Math.round(usd * 100).toLocaleString()} pts`;
}

export function gameHead(title, sub, usd) {
  return `<div class="k-label">Study Break</div><h1 class="k-title">${title}</h1><div class="k-sub">${sub} · earn <span class="reward">${reward(usd)}</span></div>`
    + `<hr class="k-hud-rule">`
    + `<div id="kbigscore" class="k-bigscore" style="display:none"><span id="kbs-now" class="k-bigscore-n">0</span><span id="kbs-hi" class="k-bigscore-hi"></span></div>`;
}

/** Completion + live-score plumbing, minus Kiwi's webview metrics firehose. */
export const COMPLETE_JS = `<script>
  function kiwiComplete(bonusPts, score, won){
    try { parent.postMessage({ __hsbArcade: true, type: 'complete',
      bonus: Math.max(0, Math.round(bonusPts || 0)),
      score: (score === undefined || score === null) ? null : Math.round(score),
      won: (won === undefined ? null : !!won) }, '*'); } catch (e) {}
  }
  function kpop(el){ if(!el)return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  var KBEST = (window.__KIWI_BEST | 0) || 0;
  function kScore(n){
    n = Math.round(n || 0);
    var box = document.getElementById('kbigscore'); if (!box) { return; }
    var nowEl = document.getElementById('kbs-now'), hiEl = document.getElementById('kbs-hi');
    box.style.display = '';
    if (nowEl) { nowEl.textContent = n; kpop(nowEl); }
    if (n > KBEST) { KBEST = n; }
    if (hiEl) { hiEl.textContent = KBEST > 0 ? ('BEST ' + KBEST) : ''; }
  }
  window.kScore = kScore;
  (function(){
    function scoreFrom(t){ var m = String(t || '').match(/(?:score|dots|points|got|level|streak|combo)\\D*(-?\\d+)/i); return m ? parseInt(m[1], 10) : null; }
    function tick(){ var st = document.getElementById('status'); if (!st) { return; } var n = scoreFrom(st.textContent); if (n !== null) { kScore(n); } }
    function attach(){ var st = document.getElementById('status'); if (st) { try { new MutationObserver(tick).observe(st, { childList: true, characterData: true, subtree: true }); } catch(e){} tick(); } }
    if (document.readyState !== 'loading') { attach(); } else { document.addEventListener('DOMContentLoaded', attach); }
  })();
<\/script>`;

export function shellHead(dark) {
  return dark ? SHELL_HEAD + DARK_SHELL_STYLE : SHELL_HEAD;
}
