import { gameHead, reward } from "./shell.js";
const WORDS = "'AWAY','BACK','BAKE','BALL','BAND','BANK','BARE','BARK','BARN','BASE','BATH','BEAD','BEAM','BEAN','BEAR','BEAT','BEEN','BEER','BELL','BELT','BEND','BEST','BIKE','BILL','BITE','BOAT','BOLD','BOLT','BONE','BOOK','BOOM','BOOT','BORN','BOSS','BOTH','BRAG','BRAN','BRED','BREW','BROW','BUCK','BULB','BULK','BULL','BURN','BUSH','BUSY','CAFE','CAGE','CAKE','CALL','CALM','CAMP','CANE','CAPE','CARD','CARE','CARP','CARS','CART','CASE','CASH','CAST','CATS','CAVE','CELL','CHIN','CHIP','CLAM','CLAN','CLAP','CLAW','CLAY','CLIP','COAL','COAT','CODE','COIL','COIN','COLD','COME','COOK','COOL','COPE','COPY','CORD','CORE','CORK','CORN','COST','COZY','CREW','CROP','CUBE','CURB','CURE','CURL','CUTE','DAMP','DARE','DARK','DART','DASH','DATE','DAWN','DAYS','DEAD','DEAF','DEAL','DEAN','DEAR','DECK','DEED','DEEP','DEER','DESK','DIAL','DICE','DIET','DIME','DINE','DIRT','DISH','DISK','DOCK','DOES','DOGS','DOLE','DOLL','DOME','DONE','DOOR','DOSE','DOVE','DOWN','DRAG','DRAW','DREW','DROP','DRUG','DRUM','DUAL','DUCK','DUDE','DUEL','DULL','DUMP','DUNE','DUST','EARN','EARS','EAST','EASY','FACE','FACT','FADE','FAIL','FAIR','FAKE','FALL','FAME','FANG','FARM','FAST','FATE','FEED','FEEL','FEET','FELL','FELT','FIGS','FILE','FILL','FILM','FIND','FINE','FIRE','FIRM','FISH','FIST','FIVE','FLAG','FLAT','FLEW','FLIP','FLOW','FOAM','FOLD','FOLK','FOND','FOOD','FOOL','FOOT','FORD','FORK','FORM','FORT','FOUL','FOUR','FREE','FRET','FUEL','FULL','FUND','FUSE','GAIN','GALE','GAME','GANG','GAPS','GASP','GATE','GAVE','GAZE','GEAR','GEMS','GIFT','GIVE','GLOW','GOAL','GOAT','GOLD','GOLF','GONE','GOOD','GRAY','GREW','GREY','GRID','GRIM','GRIN','GRIP','GROW','GULF','GULP','GUMS','GUNS','GUSH','GUYS','HAIL','HAIR','HALF','HALL','HALT','HAND','HANG','HARD','HARM','HASH','HATE','HAUL','HAVE','HAZE','HEAD','HEAL','HEAP','HEAR','HEAT','HEEL','HEIR','HELD','HELL','HELM','HELP','HERB','HERD','HERE','HERO','HIDE','HIKE','HILL','HINT','HIRE','HIVE','HOLD','HOLE','HOLY','HOME','HOOD','HOOK','HOPE','HORN','HOSE','HOST','HOUR','HULK','HULL','HUMP','HUNT','HURL','HURT','HUSH','ITEM','JAIL','JEEP','JEST','JETS','JOIN','JOLT','JUMP','JUNK','JUST','KEEL','KEEN','KEEP','KICK','KIDS','KILL','KIND','KING','KISS','KITE','KNEE','KNEW','KNIT','KNOT','KNOW','LACE','LACK','LAID','LAKE','LAMB','LAMP','LAND','LANE','LAST','LATE','LAWN','LEAD','LEAF','LEAN','LEAP','LEFT','LEGS','LEND','LENS','LIDS','LIFE','LIFT','LIKE','LIMB','LIME','LINE','LINK','LIPS','LIST','LIVE','LOAD','LOAF','LOAN','LOBE','LOCK','LOFT','LOGO','LOGS','LONE','LONG','LOOK','LOOP','LORD','LOSE','LOSS','LOST','LOUD','LOVE','LUCK','LUMP','LUNG','LURE','LURK','LUSH','LUST','MADE','MAIL','MAIN','MAKE','MALE','MALL','MALT','MAPS','MARK','MARS','MASK','MASS','MAST','MATE','MATH','MAZE','MEAL','MEAN','MEAT','MEET','MELD','MELT','MEND','MESH','MESS','MICE','MILD','MILE','MILK','MILL','MIND','MINE','MINT','MISS','MIST','MODE','MOLD','MOLE','MOOD','MOON','MORE','MOSS','MOST','MOTH','MOVE','MUCH','MUCK','MULE','MUSE','MUSH','MUST','MYTH','NAIL','NAME','NEAR','NEAT','NECK','NEED','NEST','NEXT','NICE','NICK','NINE','NODE','NONE','NOOK','NOON','NORM','NOSE','NOTE','NOUN','OATH','PACE','PACK','PAGE','PAID','PAIL','PAIN','PAIR','PALE','PALM','PALS','PANT','PARK','PART','PASS','PAST','PATH','PAVE','PEAK','PEAL','PEAR','PEAS','PEEK','PEEL','PEER','PENS','PEST','PETS','PICK','PIER','PIGS','PIKE','PILE','PILL','PINE','PINK','PINS','PINT','PIPE','PLAN','PLAY','PLOT','PLOW','PLUG','PLUM','PLUS','POLE','POLL','POND','PONY','POOL','POOR','POPE','PORK','PORT','POSE','POST','POUR','POUT','PRAY','PREP','PREY','PROD','PROP','PULL','PULP','PUMP','PUNK','PUNT','PUNY','PURE','PUSH','PUTS','RACE','RACK','RAFT','RAGE','RAID','RAIL','RAIN','RANK','RANT','RARE','RASH','RATE','RATS','RAVE','READ','REAL','REAP','REAR','REED','REEF','REIN','RENT','REST','RICE','RICH','RIDE','RIFT','RING','RINK','RIOT','RIPE','RISE','RISK','RITE','ROAD','ROAM','ROAR','ROBE','ROCK','RODE','ROLE','ROLL','ROOF','ROOK','ROOM','ROOT','ROPE','ROSE','ROSY','ROUT','RUDE','RUIN','RULE','RUNE','RUNS','RUSH','RUST','SAFE','SAID','SAIL','SAKE','SALE','SALT','SAME','SAND','SANG','SANK','SAVE','SCAN','SCAR','SEAL','SEAM','SEAR','SEAS','SEAT','SEED','SEEK','SEEM','SEEN','SEEP','SEER','SEES','SELF','SELL','SEND','SENT','SETS','SHED','SHIN','SHIP','SHOE','SHOP','SHOT','SHOW','SHUT','SICK','SIDE','SIFT','SILK','SILO','SING','SINK','SITE','SIZE','SKID','SKIM','SKIN','SKIP','SKIT','SLAB','SLAM','SLAP','SLAT','SLAW','SLED','SLID','SLIM','SLIP','SLIT','SLOT','SLOW','SLUG','SLUM','SNAG','SNAP','SNIP','SNOW','SOAK','SOAP','SOCK','SOFA','SOFT','SOIL','SOLD','SOLE','SOLO','SOME','SONG','SONS','SOON','SOOT','SORE','SORT','SOUL','SOUP','SOUR','SPAM','SPAN','SPAR','SPAT','SPIN','SPIT','SPOT','SPUN','SPUR','STAB','STAG','STAR','STAY','STEM','STEP','STEW','STIR','STOP','STUB','STUD','STUN','SUCH','SUIT','SUNK','SURE','SURF','SWAB','SWAM','SWAN','SWAP','SWAT','SWAY','SWIM','TACK','TAIL','TAKE','TALE','TALK','TALL','TAME','TANG','TANK','TAPE','TARE','TARP','TASK','TEAK','TEAL','TEAM','TEAR','TEAS','TELL','TEND','TENT','TERM','TEST','TEXT','THAN','THAT','THEM','THEN','THEY','THIN','THIS','THUD','THUG','THUS','TICK','TIDE','TIDY','TIED','TIES','TILE','TILL','TILT','TIME','TINT','TINY','TIPS','TOAD','TOES','TOLD','TOLL','TONE','TONS','TOOL','TOOT','TOSS','TOTE','TOUR','TOWN','TOYS','TRAP','TRAY','TREE','TREK','TRIM','TRIP','TROD','TROT','TRUE','TSAR','TUBA','TUBE','TUCK','TUNE','TURF','TURN','TUSK','TWIG','TWIN','TYPE','UNIT','VAIN','VANE','VASE','VAST','VEAL','VEIL','VEIN','VERB','VERY','VEST','VIBE','VICE','VINE','VOLT','VOTE','WADE','WAGE','WAIL','WAIT','WAKE','WALK','WALL','WAND','WANT','WARD','WARE','WARM','WARN','WARP','WARS','WART','WARY','WASH','WASP','WATT','WAVE','WAXY','WAYS','WEAK','WEAN','WEAR','WEED','WEEK','WEEP','WELT','WENT','WEPT','WERE','WEST','WHAT','WHEN','WHIM','WHIP','WHIZ','WHOM','WICK','WIDE','WIFE','WILD','WILL','WIND','WINE','WING','WINK','WIPE','WIRE','WISE','WISH','WISP','WITH','WOLF','WOOD','WOOL','WORD','WORE','WORK','WORM','WORN','WOVE','WRAP','YARD','YARN','YAWN','YEAR','YELL','YELP','YOLK','YOUR','ZEAL','ZERO','ZEST','ZONE'";
function ladder(usd) {
  return `<style>
    .ladder-arena{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%}
    .ladder-goal{display:flex;gap:6px;padding:8px 10px;border:1.5px dashed var(--line);border-radius:10px}
    .ladder-goal.reached{border-style:solid;border-color:var(--green);background:var(--tint)}
    .ladder-chain{display:flex;flex-direction:column;gap:6px;max-height:38vh;overflow-y:auto;padding:2px}
    .ladder-row{display:flex;gap:6px}
    .lc{width:36px;height:36px;border-radius:8px;border:2px solid var(--line);background:var(--card);
        display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:600;
        font-size:17px;color:var(--fg);text-transform:uppercase}
    .lc.changed{border-color:var(--clay);background:var(--tint);color:var(--clay-d)}
    .lc.start{background:var(--chip)}
    .ladder-inrow{display:flex;gap:8px;margin-top:4px}
    .ladder-input{width:120px;height:40px;border-radius:10px;border:1.5px solid var(--line);background:var(--card);
        font-family:var(--display);font-size:18px;font-weight:600;text-transform:uppercase;text-align:center;
        color:var(--fg);letter-spacing:.06em}
    .ladder-input:focus{outline:none;border-color:var(--clay)}
    .ladder-msg{font-size:12.5px;color:var(--muted);min-height:16px}
    @media (prefers-reduced-motion:reduce){ .k-shake-soft{animation:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Word Ladder", "Change one letter at a time (real words only) to reach the target", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Loading\u2026</div>
  <div class="k-pips" id="pips" style="margin-top:10px"></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb" class="k-press">New puzzle</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="ladderStage"><div class="ladder-arena">
    <div class="ladder-goal" id="goalRow"></div>
    <div class="ladder-chain" id="chain"></div>
    <div class="ladder-inrow"><input id="wordInput" class="ladder-input" maxlength="4" autocomplete="off" spellcheck="false" placeholder="????"><button id="submitWord" class="k-press">Go</button></div>
    <div class="ladder-msg" id="msg"></div>
  </div></div>
  </div>
  <script>
    var WORDS=[${WORDS}];
    var WSET={};for(var wi=0;wi<WORDS.length;wi++)WSET[WORDS[wi]]=1;
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),pips=document.getElementById('pips');
    var goalRow=document.getElementById('goalRow'),chainEl=document.getElementById('chain'),input=document.getElementById('wordInput'),msg=document.getElementById('msg'),stage=document.getElementById('ladderStage');
    var start,target,optimal,limit,chain,solved,withinGate;
    function diffCount(a,b){var n=0;for(var i=0;i<4;i++)if(a[i]!==b[i])n++;return n;}
    function neighbors(w){var out=[];for(var i=0;i<WORDS.length;i++){if(WORDS[i]!==w&&diffCount(WORDS[i],w)===1)out.push(WORDS[i]);}return out;}
    function bfsDistances(s){var dist={};dist[s]=0;var q=[s],qi=0;while(qi<q.length){var cur=q[qi++];var ns=neighbors(cur);for(var i=0;i<ns.length;i++){if(dist[ns[i]]===undefined){dist[ns[i]]=dist[cur]+1;q.push(ns[i]);}}}return dist;}
    function pickPuzzle(){var s=WORDS[Math.floor(Math.random()*WORDS.length)];var dist=bfsDistances(s);
      var cands=Object.keys(dist).filter(function(w){return dist[w]>=3&&dist[w]<=7;});
      if(!cands.length)cands=Object.keys(dist).filter(function(w){return dist[w]>0;});
      var t=cands[Math.floor(Math.random()*cands.length)];
      return {start:s,target:t,optimal:dist[t]};}
    function renderPips(){pips.innerHTML='';for(var i=0;i<limit;i++){var sp=document.createElement('span');var used=chain.length-1;sp.className='k-pip'+(i<used?(i<optimal?' k-pip-win':' k-pip-draw'):'');pips.appendChild(sp);}}
    function letterBoxes(word,cls,prev){var row=document.createElement('div');row.className='ladder-row';
      for(var i=0;i<4;i++){var b=document.createElement('div');b.className='lc'+(cls?' '+cls:'');if(prev&&prev[i]!==word[i])b.classList.add('changed');b.textContent=word[i];row.appendChild(b);}
      return row;}
    function render(){goalRow.innerHTML='';goalRow.appendChild(letterBoxes(target,null,null));goalRow.classList.toggle('reached',solved);
      chainEl.innerHTML='';for(var i=0;i<chain.length;i++){chainEl.appendChild(letterBoxes(chain[i],i===0?'start':null,i>0?chain[i-1]:null));}
      chainEl.scrollTop=chainEl.scrollHeight;renderPips();}
    function newPuzzle(){var p=pickPuzzle();start=p.start;target=p.target;optimal=p.optimal;limit=optimal+2;
      chain=[start];solved=false;withinGate=false;done.disabled=true;done.classList.remove('k-earn-ready');
      msg.textContent='';input.value='';input.disabled=false;
      statusEl.textContent=start+' \u2192 '+target+' \xB7 '+optimal+'-step optimal (gate: '+limit+' or fewer)';
      render();input.focus();}
    function shakeMsg(text){msg.textContent=text;chainEl.classList.remove('k-shake-soft');void chainEl.offsetWidth;chainEl.classList.add('k-shake-soft');}
    function submit(){if(solved)return;var w=(input.value||'').trim().toUpperCase();
      if(w.length!==4||!/^[A-Z]{4}$/.test(w)){shakeMsg('Type a 4-letter word.');return;}
      if(!WSET[w]){shakeMsg(w+' is not in the word list.');return;}
      var prev=chain[chain.length-1];
      if(diffCount(prev,w)!==1){shakeMsg('Change exactly one letter from '+prev+'.');return;}
      if(chain.indexOf(w)>=0){shakeMsg('Already used '+w+' in this ladder.');return;}
      chain.push(w);input.value='';msg.textContent='';render();KM.moves++;
      if(w===target){solved=true;withinGate=chain.length-1<=limit;input.disabled=true;
        if(withinGate){statusEl.textContent='Reached '+target+' in '+(chain.length-1)+' steps \u2014 inside the gate! Claim below.';done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}
        else{statusEl.textContent='Reached '+target+' in '+(chain.length-1)+' steps \u2014 over the '+limit+'-step gate. New puzzle to try again.';}
        return;}
      if(chain.length-1>=limit){statusEl.textContent='Out of steps ('+limit+') before reaching '+target+'. New puzzle to try again.';input.disabled=true;}}
    document.getElementById('submitWord').addEventListener('click',submit);
    input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();submit();}});
    document.getElementById('newb').addEventListener('click',newPuzzle);
    done.addEventListener('click',function(){var steps=chain.length-1;var bonus=withinGate?(steps===optimal?7:5):0;kiwiComplete(bonus,steps,withinGate);});
    newPuzzle();
  <\/script>
</div>`;
}
export {
  ladder
};
