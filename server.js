const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = require("./app");
const http = require("http");
const socket = require("./socket");

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ DB connection error:", err.message);
  });

const PORT = process.env.PORT || 5002;

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);

    // Initialize socket.io ONLY ONCE
    socket.init(server);

    // Set io instance in app for controllers to access
    app.set('io', socket.getIO());

    server.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
      console.log(`📁 Uploads available at http://localhost:${port}/uploads/`);
      resolve(server);
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${port} is already in use. Trying another port...`);
        resolve(null); // Return null to indicate port was in use
      } else {
        reject(err);
      }
    });
  });
}

async function initializeServer() {
  let server = null;
  let currentPort = PORT;

  while (!server && currentPort < PORT + 10) {
    server = await startServer(currentPort);
    if (!server) {
      currentPort++;
    }
  }

  if (!server) {
    console.error(`❌ Could not find an available port between ${PORT} and ${PORT + 10}`);
    process.exit(1);
  }

  return server;
}

// Start the server
initializeServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});


// const mongoose = require("mongoose");
// const dotenv = require("dotenv");
// const app = require("./app");
// const http = require("http");
// const socket = require("./socket");

// dotenv.config();

// mongoose
//   .connect(process.env.MONGODB_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     serverSelectionTimeoutMS: 10000,
//   })
//   .then(() => console.log("✅ MongoDB connected"))
//   .catch((err) => {
//     console.error("❌ DB connection error:", err.message);
//   });

// const server = http.createServer(app);

// // Initialize socket.io
// socket.init(server);

// // Set io instance in app for controllers to access
// app.set('io', socket.getIO());

// const PORT = process.env.PORT || 5001;

// server.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
//   console.log(`📁 Uploads available at http://localhost:${PORT}/uploads/`);
// });