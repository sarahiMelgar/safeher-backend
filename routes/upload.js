const express = require("express");
const router = express.Router();
const upload = require("../config/multer");
const db = require("../config/db");

router.post("/upload-profile", upload.single("image"), (req, res) => {

  const imagePath = req.file.filename;
  const userId = req.body.id;

  const sql = "UPDATE usuarios SET foto=? WHERE id=?";

  db.query(sql, [imagePath, userId], (err, result) => {

    if (err) {
      console.log(err);
      return res.status(500).json({ error: err });
    }

    res.json({
      message: "Imagen guardada",
      image: imagePath
    });

  });

});

module.exports = router;