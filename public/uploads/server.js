const fs = require("fs");
const path = require("path");

// Ensure uploads folder exists
const uploadsPath = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log("✅ Created uploads folder at:", uploadsPath);
}
