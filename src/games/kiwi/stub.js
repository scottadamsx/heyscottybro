const SAMPLE = [
  // 45 simulated surveys across fields of study (each pulls from its area's question pool).
  { id: "sim-sv-psych-1", kind: "survey", area: "psychology", title: "Stress & coping pulse", description: "How you handle pressure.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-psych-2", kind: "survey", area: "psychology", title: "Decision-making study", description: "How you choose.", rewardSeeds: 10, estMinutes: 3 },
  { id: "sim-sv-psych-3", kind: "survey", area: "psychology", title: "Focus & flow survey", description: "Attention and motivation.", rewardSeeds: 9, estMinutes: 2 },
  { id: "sim-sv-health-1", kind: "survey", area: "health", title: "Sleep habits study", description: "How you rest.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-health-2", kind: "survey", area: "health", title: "Everyday health pulse", description: "Daily wellbeing.", rewardSeeds: 9, estMinutes: 2 },
  { id: "sim-sv-health-3", kind: "survey", area: "health", title: "Screen-time & wellbeing", description: "Screens and you.", rewardSeeds: 10, estMinutes: 3 },
  { id: "sim-sv-nutri-1", kind: "survey", area: "nutrition", title: "Eating habits survey", description: "How you eat.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-nutri-2", kind: "survey", area: "nutrition", title: "Cooking at home study", description: "Kitchen habits.", rewardSeeds: 9, estMinutes: 2 },
  { id: "sim-sv-nutri-3", kind: "survey", area: "nutrition", title: "Label-reading pulse", description: "What you check.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-fit-1", kind: "survey", area: "fitness", title: "Exercise routine survey", description: "How you move.", rewardSeeds: 9, estMinutes: 2 },
  { id: "sim-sv-fit-2", kind: "survey", area: "fitness", title: "Movement & motivation", description: "What keeps you going.", rewardSeeds: 10, estMinutes: 3 },
  { id: "sim-sv-fit-3", kind: "survey", area: "fitness", title: "Activity tracking study", description: "How you measure it.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-fin-1", kind: "survey", area: "finance", title: "Budgeting habits study", description: "How you plan money.", rewardSeeds: 12, estMinutes: 3 },
  { id: "sim-sv-fin-2", kind: "survey", area: "finance", title: "Saving & investing pulse", description: "Where it goes.", rewardSeeds: 14, estMinutes: 4 },
  { id: "sim-sv-fin-3", kind: "survey", area: "finance", title: "Money mindset survey", description: "How you feel about it.", rewardSeeds: 11, estMinutes: 3 },
  { id: "sim-sv-ai-1", kind: "survey", area: "ai", title: "AI usage study", description: "How you use AI.", rewardSeeds: 10, estMinutes: 3 },
  { id: "sim-sv-ai-2", kind: "survey", area: "ai", title: "Trust in AI survey", description: "What you trust it with.", rewardSeeds: 11, estMinutes: 3 },
  { id: "sim-sv-ai-3", kind: "survey", area: "ai", title: "AI & your work pulse", description: "AI at work.", rewardSeeds: 10, estMinutes: 2 },
  { id: "sim-sv-game-1", kind: "survey", area: "gaming", title: "Gaming habits survey", description: "How you play.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-game-2", kind: "survey", area: "gaming", title: "Player preferences study", description: "What you like.", rewardSeeds: 9, estMinutes: 2 },
  { id: "sim-sv-game-3", kind: "survey", area: "gaming", title: "What makes a game great", description: "Your take.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-edu-1", kind: "survey", area: "education", title: "How you learn study", description: "Your learning style.", rewardSeeds: 9, estMinutes: 2 },
  { id: "sim-sv-edu-2", kind: "survey", area: "education", title: "Lifelong learning pulse", description: "Learning for fun.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-edu-3", kind: "survey", area: "education", title: "Note-taking habits", description: "How you capture ideas.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-clim-1", kind: "survey", area: "climate", title: "Climate attitudes study", description: "How you feel.", rewardSeeds: 10, estMinutes: 3 },
  { id: "sim-sv-clim-2", kind: "survey", area: "climate", title: "Sustainable habits survey", description: "Daily choices.", rewardSeeds: 9, estMinutes: 2 },
  { id: "sim-sv-clim-3", kind: "survey", area: "climate", title: "Green spending pulse", description: "What you\u2019d pay for.", rewardSeeds: 10, estMinutes: 2 },
  { id: "sim-sv-food-1", kind: "survey", area: "food", title: "Palate & taste study", description: "What you like.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-food-2", kind: "survey", area: "food", title: "Takeout habits survey", description: "How you order.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-food-3", kind: "survey", area: "food", title: "Coffee vs tea pulse", description: "Your daily cup.", rewardSeeds: 7, estMinutes: 1 },
  { id: "sim-sv-trav-1", kind: "survey", area: "travel", title: "Travel style study", description: "How you roam.", rewardSeeds: 9, estMinutes: 2 },
  { id: "sim-sv-trav-2", kind: "survey", area: "travel", title: "Trip planning survey", description: "How you plan.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-trav-3", kind: "survey", area: "travel", title: "Wanderlust pulse", description: "Where you\u2019d go.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-music-1", kind: "survey", area: "music", title: "Listening habits study", description: "How you listen.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-music-2", kind: "survey", area: "music", title: "Music discovery survey", description: "How you find new music.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-music-3", kind: "survey", area: "music", title: "Concert-goer pulse", description: "Live shows.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-film-1", kind: "survey", area: "film", title: "Streaming habits study", description: "How you watch.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-film-2", kind: "survey", area: "film", title: "Genre preferences survey", description: "What you watch.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-film-3", kind: "survey", area: "film", title: "Reality TV pulse", description: "Guilty pleasures.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-sport-1", kind: "survey", area: "sports", title: "Sports fandom study", description: "How you follow.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-sport-2", kind: "survey", area: "sports", title: "Game-day habits survey", description: "Your rituals.", rewardSeeds: 8, estMinutes: 2 },
  { id: "sim-sv-career-1", kind: "survey", area: "career", title: "Work satisfaction study", description: "How work feels.", rewardSeeds: 12, estMinutes: 3 },
  { id: "sim-sv-career-2", kind: "survey", area: "career", title: "Remote work survey", description: "Where you work.", rewardSeeds: 11, estMinutes: 3 },
  { id: "sim-sv-sci-1", kind: "survey", area: "science", title: "Science curiosity study", description: "What excites you.", rewardSeeds: 10, estMinutes: 3 },
  { id: "sim-sv-sci-2", kind: "survey", area: "science", title: "Future tech pulse", description: "Frontiers ahead.", rewardSeeds: 10, estMinutes: 3 },
  { id: "sim-summary-1", kind: "article-summary", title: "Read an article", description: "A quick ~1-min read while your agent runs.", rewardSeeds: 8, estMinutes: 1 },
  { id: "sim-video-1", kind: "video-pick", title: "Watch a short tutorial", description: "Watch a quick clip while your agent runs.", rewardSeeds: 6, estMinutes: 2 },
  { id: "sim-wordle", kind: "puzzle", title: "Word Break", description: "Guess the 6-letter word.", rewardSeeds: 4, estMinutes: 1 },
  { id: "sim-pong", kind: "puzzle", title: "Play Pong", description: "First to 3 beats the CPU.", rewardSeeds: 4, estMinutes: 1 },
  { id: "sim-fruit", kind: "puzzle", title: "Fruit Match", description: "Match-3 fruit \u2014 reach 300.", rewardSeeds: 4, estMinutes: 1 },
  { id: "sim-minesweeper", kind: "puzzle", title: "Play Minesweeper", description: "Clear the board between agent runs.", rewardSeeds: 4, estMinutes: 1 },
  { id: "sim-2048", kind: "puzzle", title: "Play 2048", description: "Reach 256 to claim your credits.", rewardSeeds: 4, estMinutes: 1 },
  { id: "sim-memory", kind: "puzzle", title: "Memory Match", description: "Find all six pairs.", rewardSeeds: 4, estMinutes: 1 },
  { id: "sim-snake", kind: "puzzle", title: "Play Snake", description: "Eat six apples to claim.", rewardSeeds: 4, estMinutes: 1 },
  { id: "sim-fifteen", kind: "puzzle", title: "Number Slide", description: "Slide tiles into order (1\u20138).", rewardSeeds: 4, estMinutes: 1 },
  { id: "sim-simon", kind: "puzzle", title: "Play Simon", description: "Repeat the sequence to level 5.", rewardSeeds: 4, estMinutes: 1 },
  { id: "sim-whack", kind: "puzzle", title: "Whack-a-Mole", description: "Score 12 in 25 seconds.", rewardSeeds: 4, estMinutes: 1 },
  { id: "sim-pacman", kind: "puzzle", title: "Play Pac-Kiwi", description: "Eat dots, dodge ghosts \u2014 last longer, earn more.", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-flyer", kind: "puzzle", title: "Play Kiwi Flyer", description: "One-button arcade \u2014 last longer, earn more.", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-blackjack", kind: "puzzle", title: "Blackjack", description: "Beat the dealer to 21 \u2014 play as many hands as you like.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-poker", kind: "puzzle", title: "Video Poker", description: "15 chips, one draw \u2014 build the best hand.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-tripeaks", kind: "puzzle", title: "Tri-Peaks Solitaire", description: "Quick solitaire \u2014 clear the board.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-war", kind: "puzzle", title: "War", description: "Card war \u2014 best of nine flips.", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-higherlower", kind: "puzzle", title: "Higher or Lower", description: "Guess the next card \u2014 build a streak.", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-tictactoe", kind: "puzzle", title: "Tic-Tac-Toe", description: "Beat the computer at Xs and Os.", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-connect4", kind: "puzzle", title: "Connect 4", description: "Line up four against the CPU.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-mastermind", kind: "puzzle", title: "Mastermind", description: "Crack the hidden 4-colour code.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-lightsout", kind: "puzzle", title: "Lights Out", description: "Turn off every light on the grid.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-rps", kind: "puzzle", title: "Rock Paper Scissors", description: "Best of five vs the computer.", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-reaction", kind: "puzzle", title: "Reaction Test", description: "How fast are your reflexes?", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-breakout", kind: "puzzle", title: "Brick Breaker", description: "Clear the bricks with the paddle.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-typing", kind: "puzzle", title: "Typing Test", description: "How many words per minute?", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-stroop", kind: "puzzle", title: "Color Match", description: "Tap the ink colour, not the word.", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-aim", kind: "puzzle", title: "Aim Trainer", description: "Click the targets, beat the clock.", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-pig", kind: "puzzle", title: "Pig (Dice)", description: "Press your luck to 50 vs the CPU.", rewardSeeds: 3, estMinutes: 2 },
  { id: "sim-diceduel", kind: "puzzle", title: "Dice Duel", description: "Out-roll the CPU \u2014 best of five.", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-oddone", kind: "puzzle", title: "Odd One Out", description: "Spot the slightly different shade.", rewardSeeds: 3, estMinutes: 1 },
  { id: "sim-maze", kind: "puzzle", title: "Maze", description: "Find your way to the exit.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-sokoban", kind: "puzzle", title: "Sokoban", description: "Push every box onto a target.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-blockcascade", kind: "puzzle", title: "Block Cascade", description: "Clear falling lines \u2014 10 to claim, 25 pays a bonus tier.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-paddlebreak", kind: "puzzle", title: "Paddle Breaker", description: "Clear both boards with the same 3-ball stock.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-gridtoggle", kind: "puzzle", title: "Grid Toggle", description: "Turn off every light on the 5\xD75 grid within 25 moves.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-ladder", kind: "puzzle", title: "Word Ladder", description: "Change one letter at a time to reach the target word.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-reversi", kind: "puzzle", title: "Reversi", description: "Flank the CPU on the 8\xD78 board \u2014 most discs wins.", rewardSeeds: 4, estMinutes: 3 },
  { id: "sim-dotsboxes", kind: "puzzle", title: "Dots and Boxes", description: "Claim more boxes than the CPU on the 5\xD75 dot grid.", rewardSeeds: 4, estMinutes: 3 },
  // B13 expansion wave 2 (7 new games).
  { id: "sim-nonogram", kind: "puzzle", title: "Nonogram", description: "Fill the 8\xD78 grid to match the row and column clues.", rewardSeeds: 4, estMinutes: 3 },
  { id: "sim-sudokumini", kind: "puzzle", title: "Mini Sudoku", description: "Solve the 6\xD76 grid \u2014 1\u20136 in every row, column, and box.", rewardSeeds: 4, estMinutes: 3 },
  { id: "sim-bullscows", kind: "puzzle", title: "Bulls and Cows", description: "Crack the hidden 4-digit code in 8 tries.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-anagrams", kind: "puzzle", title: "Anagrams", description: "Find as many words as you can in the 6-letter rack.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-bankroll21", kind: "puzzle", title: "Bankroll", description: "Beat the house across 3+ hands of blackjack.", rewardSeeds: 4, estMinutes: 3 },
  { id: "sim-pipes", kind: "puzzle", title: "Pipes", description: "Rotate tiles to connect the source to the drain.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-rhythmtaps", kind: "puzzle", title: "Rhythm Taps", description: "Hit D F J K in time with the falling notes.", rewardSeeds: 3, estMinutes: 1 },
  // B13 expansion wave 3 (final 5 — the arcade's full 50).
  { id: "sim-checkers", kind: "puzzle", title: "Checkers", description: "8\xD78 draughts vs the CPU \u2014 forced captures, kings.", rewardSeeds: 4, estMinutes: 3 },
  { id: "sim-gomoku", kind: "puzzle", title: "Gomoku", description: "Five in a row on the 12\xD712 board vs the CPU.", rewardSeeds: 4, estMinutes: 3 },
  { id: "sim-gridseek", kind: "puzzle", title: "Word Search", description: "Find all 8 hidden words in the 10\xD710 grid.", rewardSeeds: 4, estMinutes: 3 },
  { id: "sim-twentyfour", kind: "puzzle", title: "24", description: "Make 24 from four numbers \u2014 each used exactly once.", rewardSeeds: 4, estMinutes: 2 },
  { id: "sim-lanehopper", kind: "puzzle", title: "Lane Hopper", description: "Hop across scrolling lanes \u2014 five crossings to claim.", rewardSeeds: 3, estMinutes: 2 },
  { id: "sim-ad-1", kind: "opt-in-ad", title: "Watch a sponsor", description: "A 10s sponsor message \u2014 watch fully to earn more.", rewardSeeds: 2, estMinutes: 1 },
  { id: "sim-ad-2", kind: "opt-in-ad", title: "Watch a sponsor", description: "A 10s sponsor message \u2014 watch fully to earn more.", rewardSeeds: 2, estMinutes: 1 }
];
class SimulatedEarningProvider {
  constructor(opportunities = SAMPLE) {
    this.id = "simulated";
    this.displayName = "Kiwi Earn (Preview)";
    /** Always true — these rewards are not backed by a real buyer yet. */
    this.simulated = true;
    this.opportunities = opportunities;
  }
  isAvailable() {
    return true;
  }
  async listOpportunities() {
    return [...this.opportunities];
  }
  async complete(opportunityId) {
    const opp = this.opportunities.find((o) => o.id === opportunityId);
    const awardedSeeds = opp?.rewardSeeds ?? 0;
    return {
      opportunityId,
      awardedSeeds,
      simulated: true,
      at: Date.now()
    };
  }
}
export {
  SimulatedEarningProvider,
  SAMPLE as KIWI_OPPORTUNITIES
};
