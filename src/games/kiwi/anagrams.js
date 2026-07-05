import { gameHead, reward } from "./shell.js";
const RACKS = "[{r:'GARDEN',w:['ARE','ERA','EAR','RAN','RAG','AGE','DEN','END','RED','NAG','DRAG','DEAR','DARE','EARN','NEAR','AGED','DARN','GRAN','ANGER','RANGE','GRAND','GRADE','GARDEN']},{r:'STRIPE',w:['TIP','SIP','SIR','RIP','PIT','SIT','TIE','IRE','RIPE','STIR','TIPS','PITS','SPIT','RISE','TIER','TIRE','SITE','RITE','PIER','PIES','TRIPE','SPIRE','STRIP','STRIPE','PRIEST']},{r:'PLANET',w:['TAN','PAN','PAL','LAP','TAP','ATE','EAT','TEA','ANT','NET','TEN','LET','PET','APE','NAP','PLAN','LEAP','LEAN','LATE','TALE','TEAL','NEAT','ANTE','PANT','PLEA','NAPE','PANE','PEAT','TAPE','LANE','PLATE','PLANE','PANEL','PLANT','PENAL','PLANET']},{r:'MASTER',w:['ARM','ART','RAT','TAR','EAR','ATE','EAT','TEA','SAT','SEA','SET','ERA','ARE','MAT','MATE','TEAM','MEAT','SEAT','EATS','EAST','TEAS','RATE','TEAR','TARE','STAR','ARTS','RATS','TARS','MARS','ARMS','MAST','TAMER','STARE','TEARS','RATES','TEAMS','STEAM','MEATS','TAMES','MATES','MASTER','STREAM']},{r:'SILVER',w:['SIR','IRE','LIE','VIE','LEI','LIVE','EVIL','VEIL','VILE','RISE','RILE','SIRE','LIES','ISLE','LIVER','LIVES','VEILS','SILVER','SLIVER']},{r:'CANDLE',w:['CAN','LAD','LED','DEN','END','ACE','AND','LAND','LANE','LEAD','DEAL','DEAN','ACNE','CANE','LACE','CLAD','DANCE','CLEAN','LANCE','DECAL','CANDLE']}]";
function anagrams(usd) {
  return `<style>
    .an-rack{display:flex;gap:8px}
    .an-lc{width:44px;height:44px;border-radius:10px;border:2px solid var(--line);background:var(--card);
        display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:700;
        font-size:22px;color:var(--fg)}
    .an-inrow{display:flex;gap:8px;margin-top:14px}
    .an-input{width:160px;height:42px;border-radius:10px;border:1.5px solid var(--line);background:var(--card);
        font-family:var(--display);font-size:19px;font-weight:600;text-transform:uppercase;text-align:center;
        color:var(--fg);letter-spacing:.06em}
    .an-input:focus{outline:none;border-color:var(--clay)}
    .an-found{display:flex;gap:6px;flex-wrap:wrap;max-width:340px;margin-top:14px;max-height:22vh;overflow-y:auto}
    .an-chip{background:var(--chip);color:var(--clay-d);font-weight:700;font-size:12.5px;padding:5px 10px;border-radius:999px}
    .an-msg{font-size:12.5px;color:var(--muted);min-height:16px;margin-top:6px}
    @media (prefers-reduced-motion:reduce){ .k-shake-soft{animation:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Anagrams", "Find as many words as you can in the 6-letter rack \u2014 90 seconds", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Loading\u2026</div>
  <div class="k-pips" id="pips" style="margin-top:10px"></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb" class="k-press">New rack</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="anStage"><div class="an-arena" style="display:flex;flex-direction:column;align-items:center">
    <div class="an-rack" id="rack"></div>
    <div class="an-inrow"><input id="wordInput" class="an-input" maxlength="6" autocomplete="off" spellcheck="false" placeholder="type a word"><button id="submitWord" class="k-press">Add</button></div>
    <div class="an-msg" id="msg"></div>
    <div class="an-found" id="found"></div>
  </div></div>
  </div>
  <script>
    var RACKS=${RACKS};
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),pips=document.getElementById('pips');
    var rackEl=document.getElementById('rack'),input=document.getElementById('wordInput'),msg=document.getElementById('msg'),foundEl=document.getElementById('found'),stage=document.getElementById('anStage');
    var puzzle,foundSet,timeLeft,timer,over,bestBonus;
    var GOAL=8,BONUS_GOAL=12,DURATION=90;
    function shuffleLetters(s){var a=s.split('');for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
    function renderRack(){rackEl.innerHTML='';shuffleLetters(puzzle.r).forEach(function(ch){var b=document.createElement('div');b.className='an-lc';b.textContent=ch;rackEl.appendChild(b);});}
    function renderPips(){pips.innerHTML='';for(var i=0;i<BONUS_GOAL;i++){var sp=document.createElement('span');
      sp.className='k-pip'+(i<foundSet.length?(i<GOAL?' k-pip-win':' k-pip-draw'):'');pips.appendChild(sp);}}
    function renderFound(){foundEl.innerHTML='';foundSet.forEach(function(w){var c=document.createElement('span');c.className='an-chip';c.textContent=w;foundEl.appendChild(c);});renderPips();}
    function shake(text){msg.textContent=text;stage.classList.remove('k-shake-soft');void stage.offsetWidth;stage.classList.add('k-shake-soft');}
    function tick(){timeLeft--;statusEl.textContent=timeLeft+'s left \xB7 '+foundSet.length+' word'+(foundSet.length===1?'':'s')+' found';
      if(timeLeft<=0){endRound();}}
    function endRound(){over=true;clearInterval(timer);input.disabled=true;
      statusEl.textContent="Time's up \u2014 "+foundSet.length+' word'+(foundSet.length===1?'':'s')+' found.';
      if(foundSet.length>=GOAL){done.disabled=false;done.classList.add('k-earn-ready');}}
    function submit(){if(over)return;var w=(input.value||'').trim().toUpperCase();input.value='';
      if(w.length<3){shake('Words need 3+ letters.');return;}
      if(foundSet.indexOf(w)>=0){shake(w+' already found.');return;}
      if(puzzle.w.indexOf(w)<0){shake(w+' is not a word from this rack.');return;}
      foundSet.push(w);msg.textContent='Nice \u2014 '+w+'!';renderFound();KM.guesses=foundSet.length;
      if(foundSet.length>=GOAL&&!done.classList.contains('k-earn-ready')){done.disabled=false;done.classList.add('k-earn-ready');}
      if(foundSet.length>=BONUS_GOAL){statusEl.textContent=timeLeft+'s left \xB7 '+foundSet.length+' words found (bonus tier!)';}}
    document.getElementById('submitWord').addEventListener('click',submit);
    input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();submit();}});
    function init(){puzzle=RACKS[Math.floor(Math.random()*RACKS.length)];foundSet=[];over=false;timeLeft=DURATION;
      done.disabled=true;done.classList.remove('k-earn-ready');msg.textContent='';input.value='';input.disabled=false;
      renderRack();renderFound();statusEl.textContent=timeLeft+'s left \xB7 0 words found';
      clearInterval(timer);timer=setInterval(tick,1000);input.focus();}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){var bonus=foundSet.length>=BONUS_GOAL?8:4;kiwiComplete(bonus,foundSet.length,foundSet.length>=GOAL);});
    init();
  <\/script>
</div>`;
}
export {
  anagrams
};
