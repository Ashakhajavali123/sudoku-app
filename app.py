"""Sudoku backend (Flask).
Run with:  python app.py   then open http://127.0.0.1:5000
"""
import random
import uuid
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Remembers the solution of every game we hand out: game_id -> list of 81 numbers.
# (In memory only, so it resets when you stop the server. Fine for learning.)
games = {}


def candidates(board, i):
    """Numbers 1-9 that can legally go in cell i (cells are numbered 0-80)."""
    r, c = divmod(i, 9)
    br, bc = r // 3 * 3, c // 3 * 3
    used = {board[r * 9 + k] for k in range(9)}
    used |= {board[k * 9 + c] for k in range(9)}
    used |= {board[(br + k // 3) * 9 + bc + k % 3] for k in range(9)}
    return [v for v in range(1, 10) if v not in used]


def count_solutions(board, limit=2):
    """Count solutions, stopping at `limit`. Used to keep puzzles uniquely solvable."""
    best, best_options = -1, None
    for i in range(81):
        if board[i] == 0:
            options = candidates(board, i)
            if best_options is None or len(options) < len(best_options):
                best, best_options = i, options
                if len(options) < 2:
                    break
    if best == -1:
        return 1  # no empty cells left: one full solution found
    total = 0
    for v in best_options:
        board[best] = v
        total += count_solutions(board, limit - total)
        if total >= limit:
            break
    board[best] = 0
    return total


def fill_board(board):
    """Fill an empty board with a random valid solution (backtracking)."""
    if 0 not in board:
        return True
    i = board.index(0)
    options = candidates(board, i)
    random.shuffle(options)
    for v in options:
        board[i] = v
        if fill_board(board):
            return True
    board[i] = 0
    return False


def make_puzzle(blanks):
    """Return (puzzle, solution). `blanks` is how many cells to empty."""
    solution = [0] * 81
    fill_board(solution)
    puzzle = solution[:]
    removed = 0
    order = list(range(81))
    random.shuffle(order)
    for i in order:
        if removed >= blanks:
            break
        keep = puzzle[i]
        puzzle[i] = 0
        if count_solutions(puzzle[:]) == 1:
            removed += 1
        else:
            puzzle[i] = keep  # removing it made the puzzle ambiguous, so put it back
    return puzzle, solution


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/new")
def new_game():
    blanks = request.args.get("blanks", default=48, type=int)
    blanks = max(30, min(blanks, 56))
    puzzle, solution = make_puzzle(blanks)
    game_id = uuid.uuid4().hex
    games[game_id] = solution
    return jsonify({"id": game_id, "puzzle": puzzle})


@app.route("/api/check", methods=["POST"])
def check():
    data = request.get_json()
    solution = games.get(data.get("id"))
    if solution is None:
        return jsonify({"error": "Unknown game. Start a new one."}), 404
    grid = data["grid"]
    wrong = [i for i in range(81) if grid[i] != 0 and grid[i] != solution[i]]
    return jsonify({"wrong": wrong, "solved": grid == solution})


@app.route("/api/hint", methods=["POST"])
def hint():
    data = request.get_json()
    solution = games.get(data.get("id"))
    if solution is None:
        return jsonify({"error": "Unknown game. Start a new one."}), 404
    grid = data["grid"]
    index = data.get("index", -1)
    # Use the selected cell if it is not right yet; otherwise the first cell that is not right.
    if not (0 <= index < 81) or grid[index] == solution[index]:
        index = next((i for i in range(81) if grid[i] != solution[i]), -1)
    if index == -1:
        return jsonify({"index": -1, "value": 0})
    return jsonify({"index": index, "value": solution[index]})


if __name__ == "__main__":
    app.run(debug=True)