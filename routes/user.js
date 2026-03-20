const express = require("express");
const router = express.Router();
const upload = require("../config/multer");

router.post("/upload-profile", upload.single("image"), (req, res) => {

  const imagePath = req.file.filename;

  // guardar en base de datos
  const sql = "UPDATE usuarios SET foto = ? WHERE id = ?";
  db.query(sql, [imagePath, req.body.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err });
    }

    res.json({
      message: "Imagen guardada",
      image: imagePath
    });
  });

});

module.exports = router;