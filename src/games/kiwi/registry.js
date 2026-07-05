import { wordle } from "./wordBreak.js";
import { pong } from "./pong.js";
import { fruitMatch } from "./fruitMatch.js";
import { minesweeper } from "./minesweeper.js";
import { pacman } from "./pacman.js";
import { flyer } from "./flyer.js";
import { game2048 } from "./game2048.js";
import { memory } from "./memory.js";
import { snake } from "./snake.js";
import { fifteen } from "./fifteenPuzzle.js";
import { simon } from "./simon.js";
import { whack } from "./whackAMole.js";
import { blackjack } from "./blackjack.js";
import { videopoker } from "./videopoker.js";
import { tripeaks } from "./tripeaks.js";
import { war } from "./war.js";
import { higherlower } from "./higherlower.js";
import { tictactoe } from "./tictactoe.js";
import { connect4 } from "./connect4.js";
import { mastermind } from "./mastermind.js";
import { lightsout } from "./lightsout.js";
import { rps } from "./rps.js";
import { reaction } from "./reaction.js";
import { breakout } from "./breakout.js";
import { typingtest } from "./typingtest.js";
import { stroop } from "./stroop.js";
import { aimtrainer } from "./aimtrainer.js";
import { pig } from "./pig.js";
import { diceduel } from "./diceduel.js";
import { colorpick } from "./colorpick.js";
import { maze } from "./maze.js";
import { sokoban } from "./sokoban.js";
import { blockcascade } from "./blockcascade.js";
import { paddlebreak } from "./paddlebreak.js";
import { gridtoggle } from "./gridtoggle.js";
import { ladder } from "./ladder.js";
import { reversi } from "./reversi.js";
import { dotsboxes } from "./dotsboxes.js";
import { nonogram } from "./nonogram.js";
import { sudokumini } from "./sudokumini.js";
import { bullscows } from "./bullscows.js";
import { anagrams } from "./anagrams.js";
import { bankroll21 } from "./bankroll21.js";
import { pipes } from "./pipes.js";
import { rhythmtaps } from "./rhythmtaps.js";
import { checkers } from "./checkers.js";
import { gomoku } from "./gomoku.js";
import { gridseek } from "./gridseek.js";
import { twentyfour } from "./twentyfour.js";
import { lanehopper } from "./lanehopper.js";
const KIWI_GAMES = [
  { id: "wordle", aliases: ["word"], title: "Word Break", ruleLine: "Guess the 6-letter word in 6 tries", rewardSpec: "solve it (fewer tries = bigger bonus), or use all 6 rows for the base reward", render: wordle },
  { id: "pong", title: "Pong", ruleLine: "First to 3 beats the CPU. Mouse or \u2191\u2193 to move", rewardSpec: "play a match; bonus scales with points scored", render: pong },
  { id: "fruit", title: "Fruit Match", ruleLine: "Swap neighbours to line up 3+. Reach 300", rewardSpec: "reach the 300-point target to claim", render: fruitMatch },
  { id: "minesweeper", title: "Minesweeper", ruleLine: "Clear the 9\xD79 board (10 mines). One life", rewardSpec: "clear the board or hit a mine \u2014 one life, no retries", render: minesweeper },
  { id: "pacman", aliases: ["pac"], title: "Pac-Kiwi", ruleLine: "Eat dots, dodge ghosts \u2014 one life", rewardSpec: "bonus scales with dots eaten and clearing the board", render: pacman },
  { id: "flyer", aliases: ["flappy"], title: "Kiwi Flyer", ruleLine: "Tap / Space to fly, dodge the gaps", rewardSpec: "bonus scales with how long you last", render: flyer },
  { id: "2048", title: "2048", ruleLine: "Arrow keys \u2014 reach 128+ to claim", rewardSpec: "128+ tile unlocks Claim; higher tiles pay a bigger bonus", render: game2048 },
  { id: "memory", title: "Memory Match", ruleLine: "Find all 8 pairs", rewardSpec: "match every pair to unlock Claim", render: memory },
  { id: "snake", title: "Snake", ruleLine: "Arrow keys. Eat 10 apples to unlock Claim", rewardSpec: "10 apples unlocks Claim; keep going for a longer run", render: snake },
  { id: "fifteen", aliases: ["15"], title: "Number Slide", ruleLine: "Slide tiles into order (1\u20138)", rewardSpec: 'solve it (or the 30s stuck-skip) to unlock Claim; solving within par*2 moves pays a bigger "challenging" bonus', render: fifteen },
  { id: "simon", title: "Simon", ruleLine: "Repeat the sequence \u2014 reach level 8", rewardSpec: "reach level 8 to unlock Claim", render: simon },
  { id: "whack", title: "Whack-a-Mole", ruleLine: "Score 12 in 30 seconds", rewardSpec: "12 hits inside the round timer unlocks Claim", render: whack },
  { id: "blackjack", title: "Blackjack", ruleLine: "Beat the dealer without busting", rewardSpec: "play any number of hands; bonus scales with hands won", render: blackjack },
  { id: "poker", title: "Video Poker", ruleLine: "15 chips, one draw per hand", rewardSpec: "bonus scales with chips won above the 15-chip start", render: videopoker },
  { id: "tripeak", title: "Tri-Peaks Solitaire", ruleLine: "Clear cards one rank above or below the base", rewardSpec: "bonus scales with cards cleared", render: tripeaks },
  { id: "war", title: "War", ruleLine: "Flip a card each round \u2014 best of 9", rewardSpec: "win the best-of-9 to unlock the bonus", render: war },
  { id: "higher", title: "Higher or Lower", ruleLine: "Build a streak, cash out anytime", rewardSpec: "bonus scales with your best streak", render: higherlower },
  { id: "tictactoe", title: "Tic-Tac-Toe", ruleLine: "You are X \u2014 beat the computer", rewardSpec: "first win unlocks Claim; bonus scales with wins", render: tictactoe },
  { id: "connect", title: "Connect 4", ruleLine: "Line up four against the CPU", rewardSpec: "first win unlocks Claim; bonus scales with wins", render: connect4 },
  { id: "mastermind", title: "Mastermind", ruleLine: "Crack the 4-colour code in 8 tries", rewardSpec: "crack the code to earn the bigger bonus", render: mastermind },
  { id: "lights", title: "Lights Out", ruleLine: "Turn off every light on the grid", rewardSpec: "turn every light off to unlock the bonus", render: lightsout },
  { id: "rps", title: "Rock Paper Scissors", ruleLine: "Best of 5 against the computer", rewardSpec: "win the best-of-5 to unlock the bonus", render: rps },
  { id: "reaction", title: "Reaction Test", ruleLine: "Click the instant it turns green \u2014 five rounds", rewardSpec: "bonus scales with your average reaction time", render: reaction },
  { id: "breakout", aliases: ["brick"], title: "Brick Breaker", ruleLine: "Clear the bricks with the paddle", rewardSpec: "bonus scales with bricks cleared", render: breakout },
  { id: "typing", title: "Typing Test", ruleLine: "Type the sentence as fast and accurately as you can", rewardSpec: "85%+ accuracy required for the WPM-scaled bonus", render: typingtest },
  { id: "stroop", aliases: ["colormatch"], title: "Color Match", ruleLine: "Tap the ink colour, not the word \u2014 30 seconds", rewardSpec: "bonus scales with score", render: stroop },
  { id: "aim", title: "Aim Trainer", ruleLine: "Click the targets as fast as you can \u2014 20 seconds", rewardSpec: "bonus scales with hits", render: aimtrainer },
  { id: "pig", title: "Pig (Dice)", ruleLine: "Press your luck to 50 vs the CPU", rewardSpec: "reach 50 first to unlock the bonus", render: pig },
  { id: "dice", title: "Dice Duel", ruleLine: "Best of 5 \u2014 higher total wins the round", rewardSpec: "win the best-of-5 to unlock the bonus", render: diceduel },
  { id: "oddone", aliases: ["colorpick"], title: "Odd One Out", ruleLine: "Spot the slightly different shade \u2014 gets harder each level", rewardSpec: "bonus scales with levels cleared", render: colorpick },
  { id: "maze", title: "Maze", ruleLine: "Find your way to the exit", rewardSpec: "escape the maze to unlock the bonus", render: maze },
  { id: "sokoban", title: "Sokoban", ruleLine: "Push every box onto a target", rewardSpec: "bonus scales with levels solved", render: sokoban },
  { id: "blockcascade", title: "Block Cascade", ruleLine: "Arrow keys \u2014 clear 10 falling lines to unlock Claim", rewardSpec: "clear 10 lines to unlock Claim; clearing 25 pays a bigger bonus tier", render: blockcascade },
  { id: "paddlebreak", title: "Paddle Breaker", ruleLine: "Mouse to move the paddle \u2014 clear 2 boards (speed ramps each one)", rewardSpec: "clear both boards to unlock Claim; a perfect run with no balls lost pays a bigger bonus", render: paddlebreak },
  { id: "gridtoggle", title: "Grid Toggle", ruleLine: "Tap a tile to flip it and its neighbours \u2014 solve within 25 moves", rewardSpec: "solve within 25 moves to unlock Claim \u2014 no reward for an unsolved or over-par board", render: gridtoggle },
  { id: "ladder", title: "Word Ladder", ruleLine: "Change one letter at a time (real words only) to reach the target", rewardSpec: "reach the target within the optimal step count + 2 to unlock Claim", render: ladder },
  { id: "reversi", title: "Reversi", ruleLine: "Flank the CPU\u2019s discs \u2014 most discs when the board fills wins", rewardSpec: "beat the CPU to unlock Claim; a dominant win pays a bigger bonus", render: reversi },
  { id: "dotsboxes", title: "Dots and Boxes", ruleLine: "Draw lines, complete boxes, avoid giving the CPU a free one", rewardSpec: "beat the CPU to unlock Claim; winning by a wide margin pays a bigger bonus", render: dotsboxes },
  // --- B13 expansion wave 2 (7 new games) ---
  { id: "nonogram", title: "Nonogram", ruleLine: "Fill the 8\xD78 grid to match the row and column clues", rewardSpec: "solve the picture to unlock Claim; a flawless clear (0 mistakes) pays a bigger bonus", render: nonogram },
  { id: "sudokumini", title: "Mini Sudoku", ruleLine: "Fill the 6\xD76 grid \u2014 1\u20136 in every row, column, and box", rewardSpec: "solve it to unlock Claim; solving without using a hint pays a bigger bonus", render: sudokumini },
  { id: "bullscows", title: "Bulls and Cows", ruleLine: "Crack the 4-digit code in 8 tries \xB7 \u25CF right spot \xB7 \u25CB right digit", rewardSpec: "crack the code to unlock Claim; cracking it in 5 guesses or fewer pays a bigger bonus", render: bullscows },
  { id: "anagrams", title: "Anagrams", ruleLine: "Find as many words as you can in the 6-letter rack \u2014 90 seconds", rewardSpec: "8+ words unlocks Claim; 12+ words pays a bigger bonus", render: anagrams },
  { id: "bankroll21", title: "Bankroll", ruleLine: "Beat the house across 3+ hands \u2014 dealer stands on 17, start with 20 chips", rewardSpec: "finish at least 3 hands up on the house bank to unlock Claim; a wide profit margin pays a bigger bonus", render: bankroll21 },
  { id: "pipes", title: "Pipes", ruleLine: "Rotate tiles to connect the source to the drain", rewardSpec: "connect the pipe within 40 rotations to unlock Claim", render: pipes },
  { id: "rhythmtaps", title: "Rhythm Taps", ruleLine: "Hit D F J K in time with the falling notes \u2014 45 seconds", rewardSpec: "80%+ hit accuracy unlocks Claim; 95%+ pays a bigger bonus", render: rhythmtaps },
  { id: "checkers", title: "Checkers", ruleLine: "8x8 draughts vs the CPU \u2014 forced captures, kings", rewardSpec: "reach 1 to unlock Claim", render: checkers },
  { id: "gomoku", title: "Gomoku", ruleLine: "Five in a row on the 12x12 board vs the CPU", rewardSpec: "reach 1 to unlock Claim", render: gomoku },
  { id: "gridseek", title: "Word Search", ruleLine: "Find all 8 hidden words in the 10x10 grid", rewardSpec: "reach 1 to unlock Claim", render: gridseek },
  { id: "twentyfour", title: "24", ruleLine: "Make 24 from 4 numbers \u2014 each used once", rewardSpec: "reach 1 to unlock Claim", render: twentyfour },
  { id: "lanehopper", title: "Lane Hopper", ruleLine: "Hop across scrolling lanes without getting hit", rewardSpec: "reach 1 to unlock Claim", render: lanehopper }
];
function matchGame(oppId) {
  const id = oppId.toLowerCase();
  for (const g of KIWI_GAMES) {
    if (id.includes(g.id) || (g.aliases ?? []).some((a) => id.includes(a))) {
      return g;
    }
  }
  return void 0;
}
export {
  KIWI_GAMES,
  matchGame
};
