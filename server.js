// ----------------------------
// server.js — Start Server + Socket.IO + MongoDB
// ----------------------------

const http = require("http");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = require("./app");
const socket = require("./socket");

dotenv.config();

// ----------------------------
// MongoDB Connection
// ----------------------------
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ DB connection error:", err.message));

// ----------------------------
// Start HTTP Server + Socket.IO
// ----------------------------
const PORT = process.env.PORT || 5001;
const server = http.createServer(app);

// Initialize Socket.IO once
socket.init(server);

// Make io available to controllers
app.set("io", socket.getIO());

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads available at http://localhost:${PORT}/uploads/`);
});

// Handle errors like port in use
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Please free it and restart.`);
  } else {
    console.error("❌ Server error:", err);
  }
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

// const PORT = process.env.PORT || 5002;

// function startServer(port) {
//   return new Promise((resolve, reject) => {
//     const server = http.createServer(app);

//     // Initialize socket.io ONLY ONCE
//     socket.init(server);

//     // Set io instance in app for controllers to access
//     app.set('io', socket.getIO());

//     server.listen(port, () => {
//       console.log(`🚀 Server running on http://localhost:${port}`);
//       console.log(`📁 Uploads available at http://localhost:${port}/uploads/`);
//       resolve(server);
//     });

//     server.on("error", (err) => {
//       if (err.code === "EADDRINUSE") {
//         console.error(`❌ Port ${port} is already in use. Trying another port...`);
//         resolve(null); // Return null to indicate port was in use
//       } else {
//         reject(err);
//       }
//     });
//   });
// }

// async function initializeServer() {
//   let server = null;
//   let currentPort = PORT;

//   while (!server && currentPort < PORT + 10) {
//     server = await startServer(currentPort);
//     if (!server) {
//       currentPort++;
//     }
//   }

//   if (!server) {
//     console.error(`❌ Could not find an available port between ${PORT} and ${PORT + 10}`);
//     process.exit(1);
//   }

//   return server;
// }

// // Start the server
// initializeServer().catch((error) => {
//   console.error("❌ Failed to start server:", error);
//   process.exit(1);
// });
