const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const mysql = require("mysql2");
// Config storage
const storage = multer.diskStorage({
  destination: './uploads/videos/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "", // si tienes contraseña ponla aquí
  database: "safeher",
});
db.connect((err) => {
  if (err) {
    console.error("Error MySQL para videos:", err);
  } else {
    console.log("MySQL conectado para videos");
  }
});

const upload = multer({ storage });

// Subir video
// ✅ Subir video
router.post('/upload', upload.single('video'), (req, res) => {
  try {
    const userId = parseInt(req.body.user_id); 

    if (!userId) {
      return res.status(400).json({ error: "user_id es requerido" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo" });
    }

    // 🔥 guardar en DB
    db.query(
      "INSERT INTO videos_usuaria (usuaria_id, video_url, fecha_creacion) VALUES (?, ?,NOW())",
      [userId, req.file.filename],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: "Error al guardar en DB" });
        }
        console.log("Video subido correctamente")
        res.json({
          message: "Video subido correctamente",
          user_id: userId,
          path: `/uploads/videos/${req.file.filename}`
        });
      }
    );

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Obtener lista
router.get('/', (req, res) => {
    console.log('get video en server');
  // Primero podrías recibir el id del usuario vía query param
  const usuariaId = req.query.usuaria_id;
    console.log('id para get videos');
    console.log(usuariaId);
  if (!usuariaId) {
    return res.status(400).json({ error: "Falta el id de la usuaria" });
  }

  const sql = `
    SELECT id, usuaria_id, video_url, fecha_creacion
    FROM videos_usuaria
    WHERE usuaria_id = ?
    ORDER BY fecha_creacion DESC
  `;

  db.query(sql, [usuariaId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Error al obtener videos" });
    }
    
    // Devolver lista de videos
    return res.json(results);
  });
});


router.delete('/:id', (req, res) => {
  const videoId = parseInt(req.params.id);

  // 1️⃣ Primero obtenemos el registro para saber qué archivo eliminar
  db.query(
    'SELECT video_url FROM videos_usuaria WHERE id = ?',
    [videoId],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Error al buscar video" });
      if (results.length === 0)
        return res.status(404).json({ error: "Video no encontrado" });

      const videoFile = results[0].video_url;
      const filePath = path.join(__dirname, '../uploads/videos', videoFile);

      // 2️⃣ Borramos el archivo del sistema
      fs.unlink(filePath, (err) => {
        if (err) console.log("No se pudo eliminar el archivo:", err);
        // aunque falle, seguimos para borrar el registro

        // 3️⃣ Borramos el registro de la DB
        db.query(
          'DELETE FROM videos_usuaria WHERE id = ?',
          [videoId],
          (err2, result) => {
            if (err2) return res.status(500).json({ error: "No se pudo eliminar registro" });
            res.json({ message: "Video eliminado correctamente" });
          }
        );
      });
    }
  );
});

module.exports = router;