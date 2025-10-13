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


