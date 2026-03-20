require("dotenv").config(); // ✨ Agregamos dotenv
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use("/uploads", express.static("uploads"));

// Middlewares
app.use(cors());
app.use(express.json());

// ============================
// MULTER - Subir imágenes
// ============================
const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ============================
// VERIFICAR TOKEN
// ============================
const verificarToken = (req, res, next) => {
  const rawHeader = req.headers["authorization"];
  const token = rawHeader?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Token no proporcionado" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secreto_safeher_2024");
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
};

// ============================
// CONEXIÓN MySQL REMOTA
// ============================
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

db.connect(err => {
  if (err) console.error("Error MySQL:", err);
  else console.log("MySQL conectado 💜");
});

// ============================
// ENDPOINTS
// ============================

// Test
app.get("/test-get", (req, res) => res.json({ ok: true }));

// Subir foto de perfil
app.post("/upload-profile", upload.single("image"), (req, res) => {
  const { id } = req.body;
  if (!req.file) return res.status(400).json({ error: "No se subió ninguna imagen" });

  const imagePath = req.file.filename;
  const sql = "UPDATE usuarias SET foto = ? WHERE id = ?";
  db.query(sql, [imagePath, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Foto guardada 💜", image: imagePath });
  });
});

// ===================================
// Socket.io
// ===================================
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("join_sala", (id_sala) => socket.join(id_sala));

  socket.on("enviar_mensaje", ({ usuaria_id, mensaje, id_sala }) => {
    const sql = `INSERT INTO chat_mensajes (usuaria_id, mensaje, id_sala) VALUES (?, ?, ?)`;
    db.query(sql, [usuaria_id, mensaje, id_sala], (err, result) => {
      if (err) return console.log("Error mensaje:", err);

      db.query("SELECT nombre, foto FROM usuarias WHERE id = ?", [usuaria_id], (err2, userResult) => {
        if (err2) return console.log("Error usuaria:", err2);

        const usuaria = userResult[0] || {};
        const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
        const fotoUrl = usuaria.foto ? `${BASE_URL}/uploads/${usuaria.foto}` : null;

        io.to(id_sala).emit("recibir_mensaje", {
          id: result.insertId,
          usuaria_id,
          nombre: usuaria.nombre,
          foto: fotoUrl,
          mensaje,
          id_sala,
          created_at: new Date()
        });
      });
    });
  });

  socket.on("disconnect", () => console.log("Usuario desconectado:", socket.id));
});

// ============================
// START SERVER
// ============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} 💜`);
});