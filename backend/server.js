// backend/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const Redis = require("ioredis");

// Redis client (connecting to your Pi)
const redis = new Redis({
  host: process.env.REDIS_HOST || "192.168.2.138",
  port: 6379,
  // password: "your-redis-password-if-set"
});

// Helpers
function makePin(length = 6) {
  return [...Array(length)]
    .map(() => Math.random().toString(36)[2].toUpperCase())
    .join("");
}

const app = express();
app.use(cors());
app.use(express.json());

// Create a new game, store in Redis
app.post("/create", async (req, res) => {
  let pin;
  do {
    pin = makePin();
  } while (await redis.exists(`game:${pin}:host`));

  // initialize game keys
  await redis
    .multi()
    .set(`game:${pin}:host`, "")
    .del(`game:${pin}:players`)
    .del(`game:${pin}:stories`)
    .del(`game:${pin}:submissions`)
    .del(`game:${pin}:scores`)
    .exec();

  console.log(`Game ${pin} created`);
  res.json({ pin });
});

app.get("/health", (_, res) => res.send("OK"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("↔️ socket connected:", socket.id);

  socket.on("joinGame", async ({ pin, username }) => {
    // check game exists
    const exists = await redis.exists(`game:${pin}:host`);
    if (!exists) return socket.emit("errorMessage", "Game not found");

    // assign host if needed
    let hostId = await redis.get(`game:${pin}:host`);
    if (!hostId) {
      await redis.set(`game:${pin}:host`, socket.id);
      hostId = socket.id;
    }

    // add player to list
    await redis.hset(
      `game:${pin}:players`,
      socket.id,
      JSON.stringify({ username, isHost: socket.id === hostId })
    );
    await redis.hset(`game:${pin}:scores`, socket.id, 0);

    socket.join(pin);

    // fetch all players
    const playersRaw = await redis.hgetall(`game:${pin}:players`);
    const playerList = Object.entries(playersRaw).map(([id, str]) => {
      const p = JSON.parse(str);
      return { id, username: p.username, isHost: p.isHost };
    });
    io.to(pin).emit("playersUpdate", playerList);
  });

  socket.on("submitStories", async ({ pin, stories }) => {
    // store each user's stories as JSON array
    await redis.hset(`game:${pin}:stories`, socket.id, JSON.stringify(stories));
    await redis.sadd(`game:${pin}:submissions`, socket.id);

    const subCount = await redis.scard(`game:${pin}:submissions`);
    const totalPlayers = Object.keys(
      await redis.hgetall(`game:${pin}:players`)
    ).length;

    if (subCount === totalPlayers) {
      io.to(pin).emit("storiesSubmitted");
    }
  });

  socket.on("startGame", async (pin) => {
    const host = await redis.get(`game:${pin}:host`);
    if (socket.id !== host) return;

    // set current round
    await redis.set(`game:${pin}:currentRound`, 1);

    // pick random story example:
    const storiesRaw = await redis.hgetall(`game:${pin}:stories`);
    const authors = Object.keys(storiesRaw);
    const randomAuthor = authors[Math.floor(Math.random() * authors.length)];
    const firstStory = JSON.parse(storiesRaw[randomAuthor])[0];

    io.to(pin).emit("gameStarted", {
      round: 1,
      authorId: randomAuthor,
      text: firstStory,
    });
  });

  socket.on("vote", async ({ pin, choiceId }) => {
    await redis.hset(`game:${pin}:votes`, socket.id, choiceId);

    const votes = await redis.hgetall(`game:${pin}:votes`);
    const authorId = await redis.get(`game:${pin}:currentAuthor`);
    const playerIds = Object.keys(
      await redis.hgetall(`game:${pin}:players`)
    ).filter((id) => id !== authorId);

    if (playerIds.every((id) => votes[id])) {
      // tally
      let correctCount = 0;
      for (const voter of playerIds) {
        if (votes[voter] === authorId) {
          correctCount++;
          await redis.hincrby(`game:${pin}:scores`, voter, 1);
        }
      }
      await redis.hincrby(
        `game:${pin}:scores`,
        authorId,
        playerIds.length - correctCount
      );

      const scores = await redis.hgetall(`game:${pin}:scores`);
      io.to(pin).emit("voteResult", { votes, scores });
    }
  });

  socket.on("disconnect", async () => {
    // 1. Find which game this socket was in
    const keys = await redis.keys("game:*:players");
    for (const key of keys) {
      const pin = key.split(":")[1];
      if (!(await redis.hexists(key, socket.id))) continue;

      // 2. Remove the player immediately
      await Promise.all([
        redis.hdel(`game:${pin}:players`, socket.id),
        redis.hdel(`game:${pin}:stories`, socket.id),
        redis.hdel(`game:${pin}:scores`, socket.id),
        redis.srem(`game:${pin}:submissions`, socket.id),
      ]);

      // 3. Check if they were host
      const oldHost = await redis.get(`game:${pin}:host`);
      if (socket.id === oldHost) {
        // 4. Pick the first remaining player as new host (or empty)
        const remaining = await redis.hkeys(`game:${pin}:players`);
        const newHost = remaining[0] || "";
        await redis.set(`game:${pin}:host`, newHost);

        // 5. Update each player's isHost flag in Redis
        const playersRaw = await redis.hgetall(`game:${pin}:players`);
        for (let [id, str] of Object.entries(playersRaw)) {
          const p = JSON.parse(str);
          p.isHost = id === newHost;
          await redis.hset(`game:${pin}:players`, id, JSON.stringify(p));
        }
      }

      // 6. Broadcast the updated player list
      const updatedRaw = await redis.hgetall(`game:${pin}:players`);
      const updatedList = Object.entries(updatedRaw).map(([id, str]) =>
        JSON.parse(str)
      );
      io.to(pin).emit("playersUpdate", updatedList);

      break; // we found the game—no need to loop further
    }
  });

  //     socket.on("disconnect", async () => {
  //     console.log("❌ disconnected:", socket.id);
  //     // remove from all game hashes
  //     const keys = await redis.keys("game:*:players");
  //     for (const key of keys) {
  //       if (await redis.hexists(key, socket.id)) {
  //         const pin = key.split(":")[1];
  //         await Promise.all([
  //           redis.hdel(`game:${pin}:players`, socket.id),
  //           redis.hdel(`game:${pin}:stories`, socket.id),
  //           redis.hdel(`game:${pin}:scores`, socket.id),
  //           redis.srem(`game:${pin}:submissions`, socket.id),
  //         ]);
  //         // broadcast updated list
  //         const playersRaw = await redis.hgetall(`game:${pin}:players`);
  //         const playerList = Object.entries(playersRaw).map(([id, str]) =>
  //           JSON.parse(str)
  //         );
  //         io.to(pin).emit("playersUpdate", playerList);
  //       }
  //     }
  //   });
  // });
  socket.on("disconnect", async () => {
    console.log("❌ disconnected:", socket.id);
    // remove from all game hashes
    const keys = await redis.keys("game:*:players");
    for (const key of keys) {
      if (await redis.hexists(key, socket.id)) {
        const pin = key.split(":")[1];
        await Promise.all([
          redis.hdel(`game:${pin}:players`, socket.id),
          redis.hdel(`game:${pin}:stories`, socket.id),
          redis.hdel(`game:${pin}:scores`, socket.id),
          redis.srem(`game:${pin}:submissions`, socket.id),
        ]);
        // broadcast updated list
        const playersRaw = await redis.hgetall(`game:${pin}:players`);
        const playerList = Object.entries(playersRaw).map(([id, str]) =>
          JSON.parse(str)
        );
        io.to(pin).emit("playersUpdate", playerList);
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Backend listening on http://localhost:${PORT}`)
);
