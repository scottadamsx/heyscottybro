import { gameHead, reward } from "./shell.js";
function rhythmtaps(usd) {
  return `<style>
    .rt-lanes{display:flex;gap:10px}
    .rt-lane{width:58px;height:280px;background:var(--tile);border-radius:8px;position:relative;overflow:hidden}
    .rt-key{position:absolute;left:0;right:0;bottom:0;height:44px;display:flex;align-items:center;justify-content:center;
            font-family:var(--display);font-weight:700;font-size:16px;color:var(--muted);background:var(--chip);
            border-top:2px solid var(--line);transition:background .1s,color .1s}
    .rt-lane.pulse .rt-key{background:var(--clay);color:#fff}
    .rt-note{position:absolute;left:6px;right:6px;height:16px;border-radius:5px;background:var(--fg)}
    .rt-fx{position:absolute;left:50%;top:40%;transform:translateX(-50%);font-family:var(--display);font-weight:700;font-size:13px;pointer-events:none}
    .rt-fx.perfect{color:var(--green2)} .rt-fx.good{color:var(--gold)} .rt-fx.miss{color:var(--clay-d)}
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Rhythm Taps", "Hit D F J K in time with the falling notes \u2014 45 seconds", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Press Start when ready</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="startb" class="k-press">Start</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div class="rt-lanes" id="lanes"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),lanesEl=document.getElementById('lanes'),startB=document.getElementById('startb');
    var LANES=['D','F','J','K'],BEAT=461,DURATION=45000,TRAVEL=1400,PERFECT=100,GOOD=220;
    var notes,laneEls,running,over,accuracy,startTime,raf;
    var perfectCount,goodCount,missCount;
    function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
    function buildLanes(){lanesEl.innerHTML='';laneEls=[];
      LANES.forEach(function(k,i){var lane=document.createElement('div');lane.className='rt-lane';lane.dataset.lane=i;
        var key=document.createElement('div');key.className='rt-key';key.textContent=k;lane.appendChild(key);
        lanesEl.appendChild(lane);laneEls.push(lane);});}
    function genNotes(seed){var rng=mulberry32(seed);var out=[];var prevLane=-1;
      for(var t=0;t<DURATION;t+=BEAT){var lane=Math.floor(rng()*4);
        if(lane===prevLane)lane=(lane+1+Math.floor(rng()*3))%4;
        prevLane=lane;out.push({time:t,lane:lane,el:null,judged:false});}
      return out;}
    function pulse(laneIdx){var lane=laneEls[laneIdx];lane.classList.remove('pulse');void lane.offsetWidth;lane.classList.add('pulse');
      setTimeout(function(){lane.classList.remove('pulse');},140);}
    function fx(laneIdx,text,cls){var lane=laneEls[laneIdx];var f=document.createElement('div');f.className='rt-fx '+cls;f.textContent=text;
      lane.appendChild(f);setTimeout(function(){if(f.parentNode)f.parentNode.removeChild(f);},420);}
    function judge(note,tier){note.judged=true;if(note.el&&note.el.parentNode)note.el.parentNode.removeChild(note.el);
      if(tier==='perfect')perfectCount++;else if(tier==='good')goodCount++;else missCount++;}
    function frame(){if(!running)return;var elapsed=Date.now()-startTime;
      for(var i=0;i<notes.length;i++){var n=notes[i];if(n.judged)continue;
        var progress=(elapsed-(n.time-TRAVEL))/TRAVEL;
        if(progress>=0&&progress<=1.15){
          if(!n.el){n.el=document.createElement('div');n.el.className='rt-note';laneEls[n.lane].appendChild(n.el);}
          n.el.style.top=(Math.min(progress,1)*(280-44-16))+'px';
        }
        if(elapsed>n.time+GOOD){judge(n,'miss');}
      }
      var doneCount=0;for(var j=0;j<notes.length;j++)if(notes[j].judged)doneCount++;
      var pct=notes.length?Math.round(100*(perfectCount+goodCount)/notes.length):0;
      statusEl.textContent=Math.max(0,Math.ceil((DURATION-elapsed)/1000))+'s left \xB7 Perfect '+perfectCount+' \xB7 Good '+goodCount+' \xB7 Miss '+missCount+' \xB7 '+pct+'%';
      kScore(pct);
      if(elapsed>=DURATION+GOOD||doneCount>=notes.length){endRound();return;}
      raf=requestAnimationFrame(frame);}
    function endRound(){running=false;over=true;if(raf)cancelAnimationFrame(raf);
      accuracy=notes.length?Math.round(100*(perfectCount+goodCount)/notes.length):0;
      statusEl.textContent='Round over \u2014 '+accuracy+'% accuracy (Perfect '+perfectCount+', Good '+goodCount+', Miss '+missCount+')';
      if(accuracy>=80){done.disabled=false;done.classList.add('k-earn-ready');}
      LANES.forEach(function(k,i){var el=laneEls[i].querySelectorAll('.rt-note');for(var q=0;q<el.length;q++)el[q].remove();});}
    function handleKey(ch){if(!running)return;var laneIdx=LANES.indexOf(ch);if(laneIdx<0)return;
      pulse(laneIdx);var now=Date.now()-startTime;
      var best=null,bestDelta=Infinity;
      for(var i=0;i<notes.length;i++){var n=notes[i];if(n.judged||n.lane!==laneIdx)continue;
        var delta=Math.abs(now-n.time);if(delta<=GOOD&&delta<bestDelta){best=n;bestDelta=delta;}}
      if(best){var tier=bestDelta<=PERFECT?'perfect':'good';judge(best,tier);
        fx(laneIdx,tier==='perfect'?'PERFECT':'GOOD',tier);}}
    document.addEventListener('keydown',function(e){var ch=(e.key||'').toUpperCase();if(LANES.indexOf(ch)>=0)handleKey(ch);});
    function start(){if(running)return;var seed=(Date.now()^Math.floor(Math.random()*1e9))>>>0;
      notes=genNotes(seed);perfectCount=0;goodCount=0;missCount=0;over=false;accuracy=0;
      done.disabled=true;done.classList.remove('k-earn-ready');
      buildLanes();running=true;startTime=Date.now();statusEl.textContent='Go!';
      raf=requestAnimationFrame(frame);}
    startB.addEventListener('click',start);
    done.addEventListener('click',function(){var bonus=accuracy>=95?8:5;kiwiComplete(bonus,accuracy,accuracy>=80);});
    buildLanes();
  <\/script>
</div>`;
}
export {
  rhythmtaps
};
