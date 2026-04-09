import { useState, useCallback } from "react";

const WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function calcWinner(squares) {
  for (const [a, b, c] of WINNING_LINES) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], line: [a, b, c] };
    }
  }
  return null;
}

export default function TicTacToePage() {
  const [squares, setSquares] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [score, setScore] = useState({ X: 0, O: 0, draws: 0 });

  const result = calcWinner(squares);
  const winner = result?.winner;
  const winLine = result?.line ?? [];
  const isDraw = !winner && squares.every(Boolean);

  const handleClick = useCallback((i) => {
    if (squares[i] || winner || isDraw) return;
    const next = squares.slice();
    next[i] = xIsNext ? "X" : "O";
    setSquares(next);
    setXIsNext(!xIsNext);

    const res = calcWinner(next);
    if (res) {
      setScore((s) => ({ ...s, [res.winner]: s[res.winner] + 1 }));
    } else if (next.every(Boolean)) {
      setScore((s) => ({ ...s, draws: s.draws + 1 }));
    }
  }, [squares, xIsNext, winner, isDraw]);

  const reset = () => {
    setSquares(Array(9).fill(null));
    setXIsNext(true);
  };

  let status;
  if (winner) status = `Player ${winner} wins! 🎉`;
  else if (isDraw) status = "It's a draw!";
  else status = `Player ${xIsNext ? "X" : "O"}'s turn`;

  return (
    <main className="ttt-page section-gap">
      <div className="section-label" style={{ justifyContent: "center" }}>Game</div>
      <h1 className="section-title" style={{ textAlign: "center" }}>Tic-Tac-Toe</h1>

      {/* Score */}
      <div className="ttt-score">
        <div className="ttt-score-item">
          <div className="ttt-score-val" style={{ color: "var(--accent-light)" }}>{score.X}</div>
          <div className="ttt-score-label">X</div>
        </div>
        <div className="ttt-score-item">
          <div className="ttt-score-val" style={{ color: "var(--text-muted)" }}>{score.draws}</div>
          <div className="ttt-score-label">Draws</div>
        </div>
        <div className="ttt-score-item">
          <div className="ttt-score-val" style={{ color: "var(--cyan)" }}>{score.O}</div>
          <div className="ttt-score-label">O</div>
        </div>
      </div>

      {/* Status */}
      <p className="ttt-status">{status}</p>

      {/* Board */}
      <div className="ttt-board">
        {squares.map((val, i) => (
          <button
            key={i}
            className={`ttt-cell${val ? ` ${val.toLowerCase()}` : ""}${winLine.includes(i) ? " winning" : ""}`}
            onClick={() => handleClick(i)}
            disabled={!!val || !!winner || isDraw}
          >
            {val}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "1rem" }}>
        <button className="btn-primary" onClick={reset}>
          <i className="fa-solid fa-rotate" /> New Game
        </button>
        <button
          className="btn-secondary"
          onClick={() => { reset(); setScore({ X: 0, O: 0, draws: 0 }); }}
        >
          Reset Scores
        </button>
      </div>
    </main>
  );
}
