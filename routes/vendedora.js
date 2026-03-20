const express = require("express");
const router = express.Router();
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

router.put("/perfil/:id", async (req, res) => {

  const { id } = req.params;

  const {
    nombreNegocio,
    nombreVendedora,
    email,
    telefono,
    direccion,
    descripcion
  } = req.body;

  try {

    const sql = `
      UPDATE vendedoras
      SET 
        nombre_negocio = ?,
        nombre = ?,
        email = ?,
        telefono = ?,
        direccion_negocio = ?,
        descripcion_negocio = ?
      WHERE id = ?
    `;

    await db.promise().query(sql, [
      nombreNegocio,
      nombreVendedora,
      email,
      telefono,
      direccion,
      descripcion,
      id
    ]);

    res.json({
      mensaje: "Perfil actualizado correctamente 💜"
    });

  } catch (error) {

    console.log("ERROR UPDATE PERFIL:", error);

    res.status(500).json({
      error: "Error al actualizar perfil"
    });

  }

});

module.exports = router;