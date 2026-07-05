import { shellHead, COMPLETE_JS, reward } from "./shell.js";
import { matchGame } from "./registry.js";
import { minesweeper } from "./minesweeper.js";
const QBANK = [
  { q: "What do you code in most?", o: ["TypeScript / JS", "Python", "Go / Rust", "Java / C#", "Something else"] },
  { q: "Biggest daily annoyance?", o: ["Context switching", "Slow builds", "Flaky tests", "Boilerplate", "Meetings"] },
  { q: "How do you feel about AI coding agents?", o: ["Love them", "Cautiously optimistic", "Skeptical", "No opinion"] },
  { q: "Where do you do most of your work?", o: ["VS Code", "Cursor", "JetBrains", "Neovim / Vim", "Other"] },
  { q: "How many side projects do you have going?", o: ["Zero", "One", "Two or three", "I have a problem"] },
  { q: "Roughly how much do you spend on AI tools / month?", o: ["$0", "Under $20", "$20\u2013$100", "$100\u2013$500", "$500+"] },
  { q: "What would make you switch IDEs?", o: ["Better AI", "Speed", "Lower cost", "Nicer UX", "Nothing"] },
  { q: "When do you code best?", o: ["Early morning", "Afternoon", "Late night", "Whenever there is coffee"] },
  { q: "How do you usually start a feature?", o: ["Write a test", "Sketch the UI", "Just start typing", "Ask an AI"] },
  { q: "Preferred way to learn something new?", o: ["Docs", "Video", "Reading code", "Trial and error"] },
  { q: "How important is earning credits while you wait?", o: ["Very", "Somewhat", "Neutral", "Not at all"] },
  { q: "Pick your poison for styling:", o: ["Tailwind", "Plain CSS", "CSS-in-JS", "A component library"] },
  { q: "What slows you down most in code review?", o: ["Waiting on reviewers", "Nitpicks", "Huge diffs", "Missing context"] },
  { q: "How do you feel about writing tests?", o: ["Love it", "Necessary evil", "Only when forced", "I ship and pray"] },
  { q: "Your relationship with the terminal?", o: ["I live there", "Comfortable", "Avoid when I can", "What terminal"] },
  { q: "How often do you deploy?", o: ["Many times a day", "Daily", "Weekly", "When it is ready"] },
  { q: "Tabs or spaces?", o: ["Tabs", "Spaces", "Whatever the linter says", "I refuse to answer"] },
  { q: "How do you name things?", o: ["Agonize over it", "Descriptive, move on", "foo, bar, baz", "Ask the AI"] },
  { q: "Biggest win from AI tools so far?", o: ["Boilerplate", "Debugging", "Learning new stacks", "Writing tests"] },
  { q: "What would make you trust an agent more?", o: ["Seeing its plan", "Approving each diff", "A reliable undo", "A track record"] },
  { q: "When something breaks in prod, you\u2026", o: ["Stay calm", "Panic quietly", "Blame the cache", "Roll back first"] },
  { q: "How many monitors?", o: ["Just the laptop", "One external", "Two", "Three or more"] },
  { q: "Where do new ideas hit you?", o: ["In the shower", "On a walk", "At 2am", "Mid-meeting"] },
  { q: "Your git commit messages are\u2026", o: ["Crafted", "Functional", '"fix"', '"asdf"'] },
  { q: "Documentation: be honest.", o: ["I write it", "I read it", "I skim it", "The code is the docs"] }
];
const QBANK_BY_AREA = {
  psychology: [
    { q: "When you\u2019re stressed, what helps most?", o: ["Talking it out", "Exercise", "Alone time", "Distraction", "Sleep"] },
    { q: "How well do you sleep on a normal night?", o: ["Like a rock", "Pretty well", "Restless", "Barely"] },
    { q: "How do you make big decisions?", o: ["Gut feeling", "Pros/cons list", "Ask others", "Overthink it"] },
    { q: "Which motivates you more?", o: ["Progress", "Praise", "Money", "Avoiding failure"] },
    { q: "How often do you feel genuinely focused?", o: ["Most of the day", "A few hours", "Rarely", "What is focus"] }
  ],
  health: [
    { q: "How many hours do you sleep?", o: ["Under 5", "5\u20136", "7\u20138", "9+"] },
    { q: "How often do you see a doctor?", o: ["Yearly checkup", "Only when sick", "Almost never", "Often"] },
    { q: "Your screen time per day?", o: ["Under 2h", "2\u20134h", "4\u20138h", "8h+"] },
    { q: "How much water do you drink?", o: ["Barely any", "A few glasses", "Plenty", "I track it"] },
    { q: "How do you handle a cold?", o: ["Push through", "Rest fully", "Meds + work", "Ignore it"] }
  ],
  nutrition: [
    { q: "How often do you cook at home?", o: ["Every day", "A few times a week", "Rarely", "Define cook"] },
    { q: "Your typical breakfast?", o: ["Skip it", "Coffee only", "Something quick", "A real meal"] },
    { q: "How do you feel about meal prep?", o: ["Love it", "Do it sometimes", "Tried, gave up", "Never"] },
    { q: "Biggest diet weakness?", o: ["Sugar", "Salty snacks", "Soda", "Late-night eating"] },
    { q: "Do you read nutrition labels?", o: ["Always", "Sometimes", "Only calories", "Never"] }
  ],
  fitness: [
    { q: "How often do you work out?", o: ["Daily", "3\u20134x a week", "Occasionally", "Never"] },
    { q: "Favorite kind of movement?", o: ["Lifting", "Running", "Sports", "Walking", "Yoga"] },
    { q: "What stops you from exercising?", o: ["Time", "Energy", "Motivation", "Nothing"] },
    { q: "Do you track your activity?", o: ["Watch/ring", "Phone app", "In my head", "I don\u2019t"] },
    { q: "Morning or evening workouts?", o: ["Morning", "Evening", "Lunch", "Whenever"] }
  ],
  finance: [
    { q: "How do you budget?", o: ["An app", "A spreadsheet", "In my head", "I don\u2019t"] },
    { q: "Where do you keep savings?", o: ["Bank", "Investments", "Crypto", "Under the mattress"] },
    { q: "How do you feel about your finances?", o: ["On top of it", "Okay", "Stressed", "Avoid thinking about it"] },
    { q: "Biggest monthly expense (besides rent)?", o: ["Food", "Subscriptions", "Transport", "Fun"] },
    { q: "Do you invest?", o: ["Regularly", "A little", "Want to start", "No"] }
  ],
  ai: [
    { q: "How often do you use AI tools?", o: ["Constantly", "Daily", "Sometimes", "Rarely"] },
    { q: "What do you trust AI with?", o: ["Drafts", "Code", "Decisions", "Almost nothing"] },
    { q: "Biggest worry about AI?", o: ["Jobs", "Accuracy", "Privacy", "None"] },
    { q: "Would you pay for a better AI?", o: ["Already do", "Maybe", "If it\u2019s cheap", "No"] },
    { q: "AI\u2019s best use today?", o: ["Writing", "Coding", "Research", "Images"] }
  ],
  gaming: [
    { q: "How often do you play games?", o: ["Daily", "Weekly", "Rarely", "Only on my phone"] },
    { q: "Platform of choice?", o: ["PC", "Console", "Mobile", "Handheld"] },
    { q: "Favorite genre?", o: ["Shooter", "RPG", "Strategy", "Puzzle", "Sports"] },
    { q: "Do you play multiplayer?", o: ["Always", "Sometimes", "Solo only", "Co-op only"] },
    { q: "What makes a game great?", o: ["Story", "Gameplay", "Friends", "Challenge"] }
  ],
  education: [
    { q: "How do you learn best?", o: ["Doing", "Watching", "Reading", "Teaching others"] },
    { q: "Last thing you learned for fun?", o: ["A language", "A skill", "A topic", "Nothing lately"] },
    { q: "Online courses: yes or no?", o: ["Finish them", "Start, don\u2019t finish", "Skeptical", "Never tried"] },
    { q: "Best teacher you had taught with\u2026", o: ["Stories", "Examples", "Tough love", "Patience"] },
    { q: "How do you take notes?", o: ["By hand", "Typed", "An app", "I don\u2019t"] }
  ],
  climate: [
    { q: "How worried are you about climate?", o: ["Very", "Somewhat", "A little", "Not really"] },
    { q: "How do you usually get around?", o: ["Car", "Transit", "Bike/walk", "Mix"] },
    { q: "Do you recycle?", o: ["Religiously", "Mostly", "Sometimes", "It\u2019s complicated"] },
    { q: "Would you pay more for green products?", o: ["Yes", "A little", "If it\u2019s easy", "No"] },
    { q: "Biggest lever for change?", o: ["Governments", "Companies", "Individuals", "Tech"] }
  ],
  food: [
    { q: "How adventurous is your palate?", o: ["Try anything", "Pretty open", "Picky", "Same 5 meals"] },
    { q: "Coffee or tea?", o: ["Coffee", "Tea", "Both", "Neither"] },
    { q: "How often do you order takeout?", o: ["Most days", "Weekly", "Rarely", "Never"] },
    { q: "Spice tolerance?", o: ["Bring the heat", "Medium", "Mild", "None"] },
    { q: "Best meal of the day?", o: ["Breakfast", "Lunch", "Dinner", "Snacks"] }
  ],
  travel: [
    { q: "Ideal trip?", o: ["Beach", "City", "Mountains", "Road trip"] },
    { q: "How do you plan travel?", o: ["Spreadsheet", "Wing it", "An app", "Ask friends"] },
    { q: "Window or aisle?", o: ["Window", "Aisle", "Don\u2019t care", "I drive"] },
    { q: "Trips per year?", o: ["None", "1\u20132", "3\u20135", "I\u2019m always gone"] },
    { q: "Travel style?", o: ["Budget", "Comfort", "Luxury", "Adventure"] }
  ],
  music: [
    { q: "How do you listen most?", o: ["Streaming", "Vinyl/CD", "Radio", "Live"] },
    { q: "Music while working?", o: ["Always", "Lyrics-free only", "Silence", "Depends"] },
    { q: "Favorite genre right now?", o: ["Hip-hop / R&B", "Pop", "Rock", "Electronic", "Indie"] },
    { q: "Discover new music via\u2026", o: ["Algorithms", "Friends", "Playlists", "Live shows"] },
    { q: "Concerts per year?", o: ["None", "1\u20132", "Several", "I live for them"] }
  ],
  film: [
    { q: "How do you watch most?", o: ["Streaming", "Theater", "Download", "TV"] },
    { q: "Binge or savor?", o: ["Binge", "One a night", "Weekends", "Background noise"] },
    { q: "Favorite genre?", o: ["Action", "Comedy", "Drama", "Sci-fi", "Horror"] },
    { q: "Reality TV: guilty pleasure?", o: ["Love it", "Some of it", "Hate it", "Never watch"] },
    { q: "Subtitles on?", o: ["Always", "For accents", "Foreign only", "Never"] }
  ],
  sports: [
    { q: "Do you follow sports?", o: ["Religiously", "Big games only", "Casually", "Not at all"] },
    { q: "Watch or play?", o: ["Both", "Watch", "Play", "Neither"] },
    { q: "Favorite to watch?", o: ["Soccer", "Basketball", "Football", "Other"] },
    { q: "Fantasy leagues?", o: ["In several", "One", "Tried it", "No"] },
    { q: "Best part of game day?", o: ["The game", "The snacks", "The friends", "The bets"] }
  ],
  career: [
    { q: "How do you feel about your work?", o: ["Love it", "It\u2019s fine", "Restless", "Looking elsewhere"] },
    { q: "Remote, office, or hybrid?", o: ["Remote", "Office", "Hybrid", "Depends"] },
    { q: "What matters most in a job?", o: ["Pay", "Growth", "People", "Flexibility"] },
    { q: "Side hustle?", o: ["Active one", "Thinking about it", "Used to", "No"] },
    { q: "Where do you want to be in 5 years?", o: ["Same field, higher", "Own thing", "Pivot", "No idea"] }
  ],
  science: [
    { q: "Most exciting frontier?", o: ["Space", "Biotech", "AI", "Energy"] },
    { q: "Would you go to space?", o: ["In a heartbeat", "Maybe", "Too risky", "No"] },
    { q: "How do you keep up with science?", o: ["News", "YouTube", "Papers", "I don\u2019t"] },
    { q: "Most underrated invention?", o: ["The wheel", "Refrigeration", "The internet", "Antibiotics"] },
    { q: "Science fiction or science fact?", o: ["Fiction", "Fact", "Both", "Neither"] }
  ]
};
function sample(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
function survey(usd, count, area) {
  const pool = area && QBANK_BY_AREA[area] ? QBANK_BY_AREA[area] : QBANK;
  const qs = sample(pool, Math.min(count, pool.length)).map((q) => ({ q: q.q, o: sample(q.o, q.o.length) }));
  const data = JSON.stringify(qs).replace(/</g, "\\u003c");
  return `<div class="wrap">
  <div class="k-prog" id="prog"></div>
  <div class="k-label">Quick Pulse \xB7 <span id="qn"></span></div>
  <div class="k-title" id="q"></div>
  <div class="k-grid" id="opts"></div>
  <div id="otherWrap" style="display:none;margin-top:8px"><input id="otherIn" type="text" placeholder="Tell us more\u2026" style="width:100%;padding:10px 12px;border:1px solid var(--line,#cdbfa6);border-radius:10px;font-size:15px;background:var(--card,#fff);box-sizing:border-box"></div>
  <div class="k-actions">
    <span class="k-hint">Tap a card \xB7 anonymous \xB7 earn <span class="reward">${reward(usd)}</span></span>
    <button class="k-primary" id="next" disabled>Next &#8594;</button>
  </div>
  <script>
    var QS=${data}, N=QS.length, i=0, picked=null;
    var ICONS=['<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor"><path d="M9 1.5 3.5 9H7l-1 5.5L12.5 7H8l1-5.5z"/></svg>',
      '<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor"><path d="M8 1l1.7 4.6L14.3 7.3 9.7 9 8 13.6 6.3 9 1.7 7.3 6.3 5.6z"/></svg>',
      '<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor"><path d="M8 1.2l5 1.9v4.1c0 3.1-2.1 5.6-5 6.8-2.9-1.2-5-3.7-5-6.8V3.1z"/></svg>',
      '<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor"><path d="M10.6 2.2 13.8 5.4 6 13.2 2.8 10z M2 14l1-3 2 2z"/></svg>'];
    var prog=document.getElementById('prog'),qn=document.getElementById('qn'),qEl=document.getElementById('q'),oEl=document.getElementById('opts'),next=document.getElementById('next');
    var otherWrap=document.getElementById('otherWrap'),otherIn=document.getElementById('otherIn');
    otherIn.addEventListener('input',function(){ if(otherWrap.style.display!=='none'){ picked=otherIn.value.trim()?'Other: '+otherIn.value.trim():null; next.disabled=!picked; } });
    function drawProg(){prog.innerHTML='';for(var s=0;s<N;s++){var b=document.createElement('i');if(s<i)b.className='done';else if(s===i)b.className='cur';prog.appendChild(b);}}
    function show(){
      if(i>=N){ qEl.textContent='Thanks \u2014 crediting your reward\u2026'; oEl.innerHTML=''; document.querySelector('.k-actions').style.display='none'; document.querySelector('.k-label').style.display='none'; drawProg(); kiwiComplete(); return; }
      picked=null; next.disabled=true; otherWrap.style.display='none'; otherIn.value=''; drawProg();
      var d=QS[i]; qn.textContent=(i+1)+' of '+N; qEl.textContent=d.q; oEl.innerHTML='';
      d.o.forEach(function(opt,idx){
        var b=document.createElement('button'); b.className='k-opt'; b.type='button';
        b.innerHTML='<span class="k-opt-ic">'+ICONS[idx%ICONS.length]+'</span><span>'+opt+'</span>';
        b.addEventListener('click',function(){
          var all=oEl.querySelectorAll('.k-opt'); for(var k=0;k<all.length;k++)all[k].classList.remove('sel'); b.classList.add('sel');
          if(/^other/i.test(opt)){ otherWrap.style.display='block'; otherIn.focus(); picked=otherIn.value.trim()?'Other: '+otherIn.value.trim():null; next.disabled=!picked; }
          else { otherWrap.style.display='none'; picked=opt; next.disabled=false; }
        });
        oEl.appendChild(b);
      });
    }
    next.addEventListener('click',function(){ if(picked===null)return; try{KM.qChoice=picked;}catch(e){} i++; show(); });
    show();
  <\/script>
</div>`;
}
const ARTICLES = [
  { src: "The Anthropic Blog", title: "Why agents should show their work", body: [
    "When a coding agent edits your files silently, trust erodes the first time it gets something wrong. The fix isn't fewer edits \u2014 it's legible ones.",
    "A visible plan tells you where the work is going. A running log shows what it touched. And a diff you approve, line by line, turns a black box into a colleague who asks before it commits.",
    "The goal isn't to slow the agent down \u2014 it's to make its speed trustworthy. When you can see the reasoning, you stop double-checking everything and start delegating the parts you'd rather not do yourself.",
    "That's the whole bet: legibility is what lets you hand over more."
  ] },
  { src: "Frontend Weekly", title: "The three-file rule for clean React", body: [
    "If a component needs more than three files to understand, it's probably doing too much. Component, styles, and a hook \u2014 that should usually be the whole story.",
    "State that lives far from where it's used becomes a scavenger hunt. Keep it local until two components genuinely need it, then lift it exactly one level.",
    "Props are a contract. The fewer you pass, the fewer ways a component can be misused \u2014 and the easier it is to delete later."
  ] },
  { src: "Platform Notes", title: "Your CI is slow because of one thing", body: [
    "Most slow pipelines aren't slow everywhere \u2014 they're slow in one step that nobody profiled. Time each stage before you buy faster runners.",
    "Cache the things that don't change between runs: dependencies, build artifacts, compiled layers. A warm cache beats a bigger machine almost every time.",
    "Run independent jobs in parallel and fail fast. The point of CI is a quick, honest no \u2014 not a thorough yes an hour later."
  ] },
  { src: "Backend Digest", title: "Indexes are not magic", body: [
    "An index trades write speed and disk for read speed. Add one for every query and you'll quietly make every insert slower.",
    "The order of columns in a composite index matters more than people expect \u2014 it has to match how you actually filter and sort.",
    "Before you add an index, read the query plan. The database will tell you what it's doing; most of the time we just don't ask."
  ] },
  { src: "Security Brief", title: "Secrets don't belong in your repo", body: [
    "A key in git history is a key forever \u2014 rewriting history doesn't help once it's been cloned or mirrored. Rotate first, clean up second.",
    "Environment variables and a real secrets manager exist for a reason. The five minutes they cost you up front are cheaper than a 2 a.m. incident.",
    "Treat every secret as already leaked and design so that a single leak isn't catastrophic: scope keys narrowly, expire them often."
  ] },
  { src: "Perf Journal", title: "Measure before you optimize", body: [
    "Intuition about performance is wrong often enough that you should never trust it without a profile. The bottleneck is rarely where it feels like it is.",
    "Optimize the hot path, not the pretty code. A 2% function called a million times beats a 50% function called twice.",
    "And write down the number before and after. 'Faster' isn't a result \u2014 '180ms to 40ms' is."
  ] },
  { src: "Dev Career", title: "The senior engineer's real job", body: [
    "Past a certain point, your output stops being code and starts being decisions other people can build on. The leverage moves from typing to judgment.",
    "The best seniors make themselves replaceable on purpose \u2014 documenting, mentoring, removing the bottleneck that is them.",
    "You're not measured by how much you can do, but by how much the team can do because you were there."
  ] },
  { src: "OSS Field Notes", title: "Maintaining what people depend on", body: [
    "The hard part of open source isn't writing it \u2014 it's saying no kindly, a hundred times, to keep the project coherent.",
    "A good issue template saves more time than any feature. Make it easy for people to give you what you need to help them.",
    "Burnout is the main cause of dead projects. Protect the maintainer and the project takes care of itself."
  ] },
  { src: "Systems Reading", title: "Caching is a promise to be wrong later", body: [
    "Every cache is a bet that stale data is acceptable for a while. The whole game is choosing how long 'a while' is.",
    "Invalidation is hard because it's really a question about correctness, not code. Decide what 'fresh enough' means before you reach for a TTL.",
    "When in doubt, cache less. A correct slow path you understand beats a fast wrong one you don't."
  ] },
  { src: "Maker's Log", title: "Shrink your feedback loop", body: [
    "The most productive builders keep the gap between 'I changed it' and 'I saw it run' as close to zero as they can.",
    "A live preview, a watch task, and a one-key test run beat any new framework you could adopt this week.",
    "Protect your attention like the scarce resource it is. Every context switch is a tax you pay in lost momentum."
  ] }
];
function article(usd, articles, readTitles) {
  const data = JSON.stringify(articles && articles.length ? articles : ARTICLES).replace(/</g, "\\u003c");
  const readData = JSON.stringify(readTitles ?? []).replace(/</g, "\\u003c");
  const rewardStr = JSON.stringify(reward(usd));
  return `<style>
    .art{display:flex;flex-direction:row;gap:34px;align-items:stretch;width:100%}
    .art-img{flex:0 0 210px;position:relative;overflow:hidden;border-radius:18px;display:flex;flex-direction:column;justify-content:space-between;padding:18px;color:#fff;background:linear-gradient(150deg,#c2704f,#7d3f2e)}
    .art-img::after{content:'';position:absolute;inset:0;background:linear-gradient(150deg,rgba(255,255,255,.14),rgba(0,0,0,.30));pointer-events:none}
    .art-cov-top,.art-cov-bot{position:relative;z-index:1;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.88}
    .art-cov-mono{position:relative;z-index:1;align-self:center;margin:auto 0;font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:92px;line-height:1;opacity:.96;text-shadow:0 2px 18px rgba(0,0,0,.25)}
    .art-body{flex:1;min-width:0;display:flex;flex-direction:column}
    .art-text{overflow-y:auto;max-height:42vh;margin-top:14px;font-size:15px;line-height:1.62;color:var(--fg);padding-right:10px}
    .art-text p{margin:0 0 14px}
    .art-prog{height:4px;background:var(--line);border-radius:999px;margin-top:14px;overflow:hidden}
    .art-prog>div{height:100%;width:0;background:var(--clay);transition:width .15s}
    .art-foot{display:flex;gap:12px;align-items:center;margin-top:14px;flex-wrap:wrap}
    #artnext{background:transparent;color:var(--clay);border:1px solid var(--line)}
    .art-foot .k-hint{margin:0}
    @media (max-width:600px){ .art{flex-direction:column;gap:16px} .art-img{flex:0 0 120px;flex-direction:row;align-items:center} .art-cov-mono{font-size:56px;margin:0} }
  </style>
  <div class="wrap">
    <div class="art">
      <div class="art-img" id="cover">
        <div class="art-cov-top" id="covsrc"></div>
        <div class="art-cov-mono" id="covmono"></div>
        <div class="art-cov-bot" id="covread"></div>
      </div>
      <div class="art-body">
        <div class="k-label" id="src"></div>
        <h1 class="k-title" id="title"></h1>
        <div class="art-text" id="text"></div>
        <div class="art-prog"><div id="pfill"></div></div>
        <div class="k-hint" id="plabel" style="margin-top:8px">0% read \xB7 scroll to continue</div>
        <div class="art-foot">
          <button class="k-primary" id="artdone" disabled>I\u2019ve read this</button>
          <button id="artnext">Read another</button>
          <span class="k-hint" id="artmsg"></span>
        </div>
      </div>
    </div>
  <script>
    var A=${data}, READ=${readData}, REWARD=${rewardStr};
    var srcEl=document.getElementById('src'),titleEl=document.getElementById('title'),text=document.getElementById('text');
    var cover=document.getElementById('cover'),covsrc=document.getElementById('covsrc'),covmono=document.getElementById('covmono'),covread=document.getElementById('covread');
    var GRAD=['linear-gradient(150deg,#c2704f,#7d3f2e)','linear-gradient(150deg,#5b7d6a,#2f4a3c)','linear-gradient(150deg,#4f6d8c,#2b3f57)','linear-gradient(150deg,#8c6a9a,#4a3358)','linear-gradient(150deg,#b08a4f,#6e5230)','linear-gradient(150deg,#5a6b8c,#33405c)'];
    function paintCover(){
      cover.style.background=GRAD[((idx%GRAD.length)+GRAD.length)%GRAD.length];
      covsrc.textContent=pick.src||'Article';
      covmono.textContent=((pick.title||'?').trim().charAt(0)||'?').toUpperCase();
      var w=pick.body.join(' ').trim().split(/\\s+/).filter(Boolean).length;
      covread.textContent=Math.max(1,Math.round(w/200))+' min read';
    }
    var fill=document.getElementById('pfill'),label=document.getElementById('plabel');
    var done=document.getElementById('artdone'),nextBtn=document.getElementById('artnext'),msg=document.getElementById('artmsg');
    var idx=-1,pick=null,credited=false,canCredit=false;
    // Reading-pace analytics (advanced): time-on-text sampled into 10 deciles, words reached, wpm,
    // and a dwell coefficient-of-variation \u2014 reset on every render so "Read another" re-measures.
    var artWords=0,artDec,artReadMs,artLast;
    function unread(avoid){ var u=[]; for(var i=0;i<A.length;i++){ if(i!==avoid && READ.indexOf(A[i].title)<0) u.push(i); } return u; }
    function others(avoid){ var u=[]; for(var i=0;i<A.length;i++){ if(i!==avoid) u.push(i); } return u; }
    function nextIdx(avoid){ var u=unread(avoid); if(!u.length) u=others(avoid); if(!u.length) u=[avoid<0?0:avoid]; return u[Math.floor(Math.random()*u.length)]; }
    function enable(){ if(credited||canCredit)return; canCredit=true; done.disabled=false; label.textContent='Done reading? Hit \u201CI\u2019ve read this\u201D.'; }
    function upd(){ var max=text.scrollHeight-text.clientHeight; var pct=max<=4?100:Math.min(100,Math.round(text.scrollTop/max*100)); fill.style.width=pct+'%'; if(pct<100 && !canCredit)label.textContent=pct+'% read \xB7 scroll to continue'; if(pct>=98)enable(); }
    function render(){
      pick=A[idx]; srcEl.textContent=pick.src; titleEl.textContent=pick.title; paintCover();
      text.innerHTML=pick.body.map(function(p){return '<p>'+p+'</p>';}).join(''); text.scrollTop=0;
      artWords=(text.textContent||'').trim().split(/\\s+/).filter(Boolean).length; artDec=[0,0,0,0,0,0,0,0,0,0]; artReadMs=0; artLast=Date.now();
      credited=false; canCredit=false; fill.style.width='0%';
      var already=READ.indexOf(pick.title)>=0;
      if(already){ done.style.display='none'; msg.textContent='You\u2019ve read this one \u2014 pick another to earn.'; label.textContent='Already read'; }
      else { done.style.display=''; done.disabled=true; done.textContent='I\u2019ve read this \xB7 +'+REWARD; msg.textContent=''; }
      upd();
      setTimeout(function(){ if(!already && text.scrollHeight-text.clientHeight<=4) enable(); },1500);
    }
    text.addEventListener('scroll',upd);
    done.addEventListener('click',function(){ if(credited||done.disabled)return; credited=true; KM.articleTitle=pick.title; done.disabled=true; nextBtn.disabled=true; fill.style.width='100%'; label.textContent=''; msg.textContent='\u2713 Nice \u2014 crediting +'+REWARD+'\u2026'; kiwiComplete(0); });
    nextBtn.addEventListener('click',function(){ if(credited)return; idx=nextIdx(idx); render(); });
    setInterval(function(){
      var now=Date.now(), dt=now-artLast; artLast=now;
      if(dt>0 && dt<1500 && !document.hidden){ var mx=text.scrollHeight-text.clientHeight, p=mx>0?text.scrollTop/mx:0; artDec[Math.min(9,Math.max(0,Math.floor(p*10)))]+=dt; artReadMs+=dt; }
      KM.articleWords=artWords; KM.readMs=artReadMs; KM.dwellDeciles=artDec.map(function(x){return Math.round(x/1000);});
      var readWords=artWords*(Math.min(100,KM.maxScrollPct)/100), mins=artReadMs/60000; KM.wpm=mins>0?Math.round(readWords/mins):0;
      var nz=artDec.filter(function(x){return x>0;});
      if(nz.length){var mean=nz.reduce(function(a,b){return a+b;},0)/nz.length; var vv=nz.reduce(function(a,b){return a+(b-mean)*(b-mean);},0)/nz.length; KM.dwellCV=mean>0?Math.round(Math.sqrt(vv)/mean*100)/100:0;}
    },500);
    idx=nextIdx(-1); render();
  <\/script>
  </div>`;
}
function watch(usd) {
  const vids = [
    { u: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4", t: "Big Buck Bunny", by: "Blender \xB7 HD clip" },
    { u: "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_2MB.mp4", t: "Jellyfish", by: "Nature \xB7 4K demo" },
    { u: "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4", t: "Sintel", by: "Blender \xB7 Short film" },
    { u: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", t: "Flower blooming", by: "MDN \xB7 CC0 clip" },
    { u: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4", t: "Vintage clip", by: "MDN \xB7 CC0 clip" }
  ];
  const data = JSON.stringify(vids);
  return `<style>
    .yt-wrap{width:440px;max-width:100%;aspect-ratio:16/9;background:#000;border-radius:14px;overflow:hidden}
    .yt-wrap video{width:100%;height:100%;display:block;background:#000}
  </style>
  <div class="wrap"><div class="k-split">
    <div class="k-left">
      <div class="k-label">Now Playing</div>
      <h1 class="k-title" id="vt"></h1>
      <div class="k-sub" id="vby"></div>
      <div id="status" class="k-sub" style="margin-top:12px">Watch to earn \u2014 claim unlocks after ~20s</div>
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button id="another">Another video</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
    </div>
    <div class="k-right"><div class="yt-wrap"><video id="v" controls autoplay muted playsinline></video></div></div>
  </div></div>
  <script>
    var V=${data}, idx=Math.floor(Math.random()*V.length);
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),v=document.getElementById('v'),vt=document.getElementById('vt'),vby=document.getElementById('vby');
    var watched=0,bonus=0,iv=null,credited=false,errs=0,failed=false;
    var another=document.getElementById('another');
    function load(){ var p=V[idx]; vt.textContent=p.t; vby.textContent=p.by; v.src=p.u; if(v.play){ v.play().catch(function(){}); } }
    // If no clip will play, don't strand the user: say it's coming soon and let them skip right away
    // or wait ~20s to claim anyway (the claim timer below runs regardless of whether video plays).
    function videoFailed(){ failed=true; statusEl.textContent='Video not working yet \u2014 coming soon. Skip now, or wait to claim.'; another.textContent='Skip'; }
    v.addEventListener('error', function(){ errs++; if(errs<=V.length){ statusEl.textContent='That clip wouldn\u2019t load \u2014 trying another\u2026'; idx=(idx+1)%V.length; watched=0; setTimeout(load, 300); return; } videoFailed(); });
    function start(){ if(iv)return; iv=setInterval(function(){ watched++;
      if(watched>=20&&done.disabled){ done.disabled=false; done.textContent='Claim ${reward(usd)}'; statusEl.textContent = failed ? 'You can claim now' : 'You can claim now \xB7 finish it for a bonus'; }
    },1000); }
    v.addEventListener('play', start);
    v.addEventListener('ended', function(){ if(iv){clearInterval(iv);iv=null;} bonus=6; done.disabled=false; done.textContent='Claim ${reward(usd)} + bonus'; statusEl.textContent='Finished the video \u2014 bonus unlocked!'; });
    another.addEventListener('click', function(){ if(failed){ kiwiComplete(0); return; } idx=(idx+1)%V.length; watched=0; load(); statusEl.textContent='Loaded another \xB7 watch to earn'; });
    done.addEventListener('click', function(){ if(credited)return; credited=true; kiwiComplete(bonus, Math.round(v.currentTime||watched)); });
    load(); start();
  <\/script>`;
}
function ad(usd) {
  const ADS = [
    { n: "Vercel", t: "Ship faster. Deploy in seconds." },
    { n: "Supabase", t: "The open-source Firebase alternative." },
    { n: "Linear", t: "Issue tracking built for speed." },
    { n: "Raycast", t: "Your shortcut to everything." },
    { n: "Stripe", t: "Payments infrastructure for the internet." },
    { n: "Postman", t: "The single platform for your APIs." },
    { n: "Notion", t: "One workspace. Every team." },
    { n: "Figma", t: "Design, together, in the browser." },
    { n: "Sentry", t: "Catch errors before your users do." },
    { n: "Railway", t: "Deploy apps without the DevOps." }
  ];
  const data = JSON.stringify(ADS);
  return `<style>
    .ad-logo{width:190px;height:190px;border-radius:26px;background:var(--tint);color:var(--clay);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:600;font-size:92px}
    .ad-prog{height:4px;background:var(--line);border-radius:999px;overflow:hidden;margin-top:18px}.ad-prog>div{height:100%;width:0;background:var(--clay)}
    @media (max-width:600px){.ad-logo{width:120px;height:120px;font-size:58px}}
  </style>
  <div class="wrap"><div class="k-split">
    <div class="k-left">
      <div class="k-label">Sponsored \xB7 Simulated</div>
      <h1 class="k-title" id="adname"></h1>
      <div class="k-sub" id="adtag" style="margin-top:6px"></div>
      <div class="ad-prog"><div id="afill"></div></div>
      <div class="k-hint" id="acount" style="margin-top:8px">Watch ~10s for the full reward</div>
      <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button class="k-ghost" id="skip">Skip \u2014 earn ${reward(usd)}</button><button class="k-primary" id="done" disabled>Watch fully \u2014 earn ${Math.round(usd * 1e3) + 4} Seeds</button></div>
    </div>
    <div class="k-right"><div class="ad-logo" id="adlogo"></div></div>
  </div>
  <script>
    var ADS=${data}, c=ADS[Math.floor(Math.random()*ADS.length)];
    document.getElementById('adname').textContent=c.n;
    document.getElementById('adtag').textContent=c.t;
    document.getElementById('adlogo').textContent=c.n.charAt(0);
    var t=10,over=false,fill=document.getElementById('afill'),count=document.getElementById('acount'),skip=document.getElementById('skip'),done=document.getElementById('done');
    setTimeout(function(){fill.style.transition='width 10s linear';fill.style.width='100%';},30);
    var iv=setInterval(function(){t--;count.textContent=Math.max(0,t)+'s left';if(t<=0){clearInterval(iv);if(!over){over=true;skip.style.display='none';done.disabled=false;count.textContent='Ad finished \u2014 claim your reward';}}},1000);
    skip.addEventListener('click',function(){if(over)return;over=true;clearInterval(iv);kiwiComplete(0);});
    done.addEventListener('click',function(){kiwiComplete(4);});
  <\/script>
  </div>`;
}
function surveyWall(url) {
  const safe = url.replace(/"/g, "&quot;");
  return `<style>.sw{height:100%;display:flex;flex-direction:column}.sw iframe{flex:1;width:100%;border:0;border-radius:14px;margin-top:10px;background:#fff}</style>
  <div class="wrap sw">
    <div class="k-label">Paid Survey</div>
    <div class="k-sub" style="margin-top:2px">Answers go to the survey partner \xB7 Seeds land when you finish</div>
    <iframe src="${safe}" allow="clipboard-write; fullscreen"></iframe>
  </div>`;
}
function kiwiQuestion(spec) {
  const data = JSON.stringify(spec).replace(/</g, "\\u003c");
  return `<style>
    .kq{max-width:540px;margin:0 auto;display:flex;flex-direction:column;gap:16px;align-items:center;text-align:center}
    .kq-badge{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--green2);background:#e9f1e2;padding:6px 13px;border-radius:999px}
    .kq-q{font-family:var(--display);font-size:25px;font-weight:600;color:var(--fg);line-height:1.25}
    .kq-sub{font-size:12.5px;color:var(--muted)}
    .kq-scale{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    .kq-face{width:56px;height:56px;border-radius:15px;border:1.5px solid var(--line);background:var(--card);font-size:26px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .1s,border-color .1s,background .1s}
    .kq-face:hover,.kq-face.sel{border-color:var(--green);background:#eef5e8;transform:translateY(-2px)}
    .kq-opts{display:flex;flex-wrap:wrap;gap:9px;justify-content:center}
    .kq-pill{padding:10px 16px;border-radius:999px;border:1.5px solid var(--line);background:var(--card);color:var(--fg);font-size:14px;cursor:pointer}
    .kq-pill:hover,.kq-pill.sel{border-color:var(--green);background:#eef5e8;color:var(--green2)}
    .kq-why{display:none;flex-direction:column;gap:9px;width:100%;align-items:center}
    .kq-why.on{display:flex}
    .kq-go{margin-top:4px;padding:11px 28px;border-radius:999px;border:0;background:var(--green2);color:#fff;font-weight:700;font-size:14px;cursor:pointer;opacity:.45;pointer-events:none}
    .kq-go.on{opacity:1;pointer-events:auto}
  </style>
  <div class="wrap"><div class="kq">
    <span class="kq-badge">\u{1F95D} Kiwi Question</span>
    <div class="kq-q" id="kqq"></div>
    <div class="kq-sub">Helps tune what you see \xB7 totally optional</div>
    <div id="kqbody"></div>
    <div class="kq-why" id="kqwhy"><div class="kq-sub">Mind sharing why?</div><div class="kq-opts" id="kqwhyo"></div></div>
    <button class="kq-go" id="kqgo">Done \xB7 +1 Seed</button>
  </div></div>
  <script>
    var S=${data};
    document.getElementById('kqq').textContent=S.prompt;
    var body=document.getElementById('kqbody'),go=document.getElementById('kqgo'),why=document.getElementById('kqwhy'),whyo=document.getElementById('kqwhyo');
    KM.qType=S.type;KM.qTarget=S.target||'';
    function enableGo(){go.classList.add('on');}
    if(S.type==='rating'){
      var sc=document.createElement('div');sc.className='kq-scale';var faces=['\u{1F61E}','\u{1F615}','\u{1F610}','\u{1F642}','\u{1F60D}'];
      faces.forEach(function(f,i){var b=document.createElement('button');b.className='kq-face';b.textContent=f;b.addEventListener('click',function(){for(var k=0;k<sc.children.length;k++)sc.children[k].classList.remove('sel');b.classList.add('sel');KM.qRating=i+1;enableGo();if(i+1<=3&&S.whyOptions&&S.whyOptions.length){why.classList.add('on');}else{why.classList.remove('on');}});sc.appendChild(b);});
      body.appendChild(sc);
      (S.whyOptions||[]).forEach(function(o){var b=document.createElement('button');b.className='kq-pill';b.textContent=o;b.addEventListener('click',function(){for(var k=0;k<whyo.children.length;k++)whyo.children[k].classList.remove('sel');b.classList.add('sel');KM.qChoice=o;});whyo.appendChild(b);});
    } else if(S.type==='reason'){
      var op=document.createElement('div');op.className='kq-opts';
      (S.options||[]).forEach(function(o){var b=document.createElement('button');b.className='kq-pill';b.textContent=o;b.addEventListener('click',function(){for(var k=0;k<op.children.length;k++)op.children[k].classList.remove('sel');b.classList.add('sel');KM.qChoice=o;enableGo();});op.appendChild(b);});
      body.appendChild(op);
    } else {
      var op2=document.createElement('div');op2.className='kq-opts';KM.qInterests=[];
      (S.options||[]).forEach(function(o){var b=document.createElement('button');b.className='kq-pill';b.textContent=o;b.addEventListener('click',function(){var i=KM.qInterests.indexOf(o);if(i>=0){KM.qInterests.splice(i,1);b.classList.remove('sel');}else{KM.qInterests.push(o);b.classList.add('sel');}if(KM.qInterests.length)enableGo();else go.classList.remove('on');});op2.appendChild(b);});
      body.appendChild(op2);
    }
    go.addEventListener('click',function(){kiwiComplete(0,S.type==='rating'?(KM.qRating||0):0);});
  <\/script>`;
}
function earnActivityHtml(opp, rewardUsd, opts = {}) {
  const id = opp.id.toLowerCase();
  let body;
  const gameMatch = matchGame(id);
  if (opp.kind === "kiwi-question" && opts.kiwiQ) {
    body = kiwiQuestion(opts.kiwiQ);
  } else if (opp.kind === "survey" && opts.surveyWallUrl) {
    body = surveyWall(opts.surveyWallUrl);
  } else if (gameMatch) {
    body = gameMatch.render(rewardUsd);
  } else if (opp.kind === "opt-in-ad" || id.includes("ad")) {
    body = ad(rewardUsd);
  } else if (opp.kind === "survey") {
    body = survey(rewardUsd, 4, opp.area);
  } else if (opp.kind === "article-summary") {
    body = article(rewardUsd, opts.articles, opts.readTitles);
  } else if (opp.kind === "video-pick") {
    body = watch(rewardUsd);
  } else if (opp.kind === "puzzle") {
    body = minesweeper(rewardUsd);
  } else {
    body = article(rewardUsd);
  }
  const best = Math.max(0, Math.round(opts.bestScore || 0));
  const bestJs = `<script>window.__KIWI_BEST=${best};<\/script>`;
  const htmlAttr = opts.dark ? ' data-kiwi-theme="dark"' : "";
  return `<!DOCTYPE html><html${htmlAttr}><head>${shellHead(opts.dark)}</head><body>${bestJs}${COMPLETE_JS}${body}</body></html>`;
}
export {
  earnActivityHtml
};
