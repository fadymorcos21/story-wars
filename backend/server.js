// backend/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Helpers
function makePin(length = 6) {
  return [...Array(length)]
    .map(() => Math.random().toString(36)[2].toUpperCase())
    .join("");
}

// In-memory store
const games = {};
// games[pin] = {
//   hostId: socket.id,
//   players: { socketId: { username, isHost } },
//   stories: { socketId: [story1,story2,story3,…] },
//   submissions: Set<socketId>,
//   currentRound: 0,
//   scores: { socketId: totalPoints },
// }

const app = express();
app.use(cors());
app.use(express.json());

app.post("/create", (req, res) => {
  let pin;
  do {
    pin = makePin();
  } while (games[pin]);
  games[pin] = {
    hostId: null,
    players: {},
    stories: {},
    submissions: new Set(),
    currentRound: 0,
    scores: {},
  };
  console.log(`Game ${pin} created`);
  res.json({ pin });
});

app.get("/health", (_, res) => res.send("OK"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // restrict in prod
});

io.on("connection", (socket) => {
  console.log("↔️ socket connected:", socket.id);

  socket.on("joinGame", ({ pin, username }) => {
    const game = games[pin];
    if (!game) {
      return socket.emit("errorMessage", "Game not found");
    }

    // first to join becomes host
    if (!game.hostId) game.hostId = socket.id;

    game.players[socket.id] = {
      username,
      isHost: socket.id === game.hostId,
    };
    game.scores[socket.id] = 0;
    socket.join(pin);

    // broadcast updated player list
    const playerList = Object.entries(game.players).map(([id, p]) => ({
      id,
      username: p.username,
      isHost: p.isHost,
    }));
    io.to(pin).emit("playersUpdate", playerList);
  });

  socket.on("submitStories", ({ pin, stories }) => {
    const game = games[pin];
    if (!game) return;
    game.stories[socket.id] = stories;
    game.submissions.add(socket.id);

    if (game.submissions.size === Object.keys(game.players).length) {
      io.to(pin).emit("storiesSubmitted");
    }
  });

  socket.on("startGame", (pin) => {
    const game = games[pin];
    if (!game || socket.id !== game.hostId) return;
    game.currentRound = 1;
    // pick the first story at random (example)
    const authors = Object.keys(game.stories);
    const randomAuthor = authors[Math.floor(Math.random() * authors.length)];
    const storyText = game.stories[randomAuthor][0]; // first story
    io.to(pin).emit("gameStarted", {
      round: game.currentRound,
      authorId: randomAuthor,
      text: storyText,
    });
  });

  socket.on("vote", ({ pin, choiceId }) => {
    const game = games[pin];
    if (!game) return;
    if (!game.votes) game.votes = {};
    game.votes[socket.id] = choiceId;

    // once all non-author have voted:
    const authorId = game.currentAuthor;
    const voters = Object.keys(game.players).filter((id) => id !== authorId);
    if (voters.every((id) => game.votes[id] !== undefined)) {
      // tally points (simple +1 correct guess, +# fooled for author)
      let correctCount = 0;
      voters.forEach((voter) => {
        if (game.votes[voter] === authorId) {
          game.scores[voter] += 1;
          correctCount++;
        }
      });
      game.scores[authorId] += voters.length - correctCount;

      io.to(pin).emit("voteResult", {
        votes: game.votes,
        scores: game.scores,
      });

      // prepare next round or end
      // …increment game.currentRound, pick next story, etc.
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ disconnected:", socket.id);
    // Clean up: remove from all games
    for (const [pin, game] of Object.entries(games)) {
      if (game.players[socket.id]) {
        delete game.players[socket.id];
        delete game.stories[socket.id];
        delete game.scores[socket.id];
        game.submissions.delete(socket.id);
        io.to(pin).emit(
          "playersUpdate",
          Object.entries(game.players).map(([id, p]) => ({
            id,
            username: p.username,
            isHost: id === game.hostId,
          }))
        );
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Backend listening on http://localhost:${PORT}`);
});
