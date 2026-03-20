const express = require("express");
const router = express.Router();
const db = require("../db");

// 🔹 Obtener todos los contactos
router.get("/", (req, res) => {
  db.query("SELECT * FROM contactos", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// ============================
// CREAR CONTACTO
// ============================
app.post("/contactos", verificarToken, (req, res) => {
  console.log("POST /contactos ejecutado 🔥");
  const { id } = req.usuario; // 👈 ID de la usuaria desde el token

  const {
    nombre,
    telefono,
    parentesco,
    email,
    direccion,
    notificacionesActivas,
    esPrincipal,
  } = req.body;

  const sql = `
    INSERT INTO contactos_confianza
    (usuaria_id, nombre, telefono, parentesco, email, direccion, notificaciones_activas, es_principal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      id,
      nombre,
      telefono,
      parentesco,
      email || null,
      direccion || null,
      notificacionesActivas ?? true,
      esPrincipal ?? false,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        message: "Contacto creado 💜",
        id: result.insertId,
      });
    },
  );
});

// ============================
// ACTUALIZAR CONTACTO (SEGURO)
// ============================
app.put("/contactos/:id", verificarToken, (req, res) => {
  const contactoId = req.params.id;
  const { id } = req.usuario;

  const {
    nombre,
    telefono,
    parentesco,
    email,
    direccion,
    notificacionesActivas,
    esPrincipal,
  } = req.body;

  const sql = `
    UPDATE contactos_confianza
    SET nombre=?, telefono=?, parentesco=?, email=?, direccion=?,
        notificaciones_activas=?, es_principal=?
    WHERE id=? AND usuaria_id=?
  `;

  db.query(
    sql,
    [
      nombre,
      telefono,
      parentesco,
      email || null,
      direccion || null,
      notificacionesActivas,
      esPrincipal,
      contactoId,
      id,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Contacto no encontrado" });
      }

      res.json({ message: "Contacto actualizado 💜" });
    },
  );
});


// ELIMINAR CONTACTO
// ============================
app.delete("/contactos/:id", verificarToken, (req, res) => {
  const contactoId = req.params.id;
  const { id } = req.usuario;

  const sql =
    "DELETE FROM contactos_confianza WHERE id = ? AND usuaria_id = ?";

  db.query(sql, [contactoId, id], (err, result) => {
    if (err) {
      console.log("ERROR DELETE CONTACTO:", err);
      return res.status(500).json({ error: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contacto no encontrado" });
    }

    res.json({
      message: "Contacto eliminado correctamente 💜",
    });
  });
});

module.exports = router;
0;
