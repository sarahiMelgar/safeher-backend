const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const multer = require("multer");
const path = require("path");

const app = express();
app.use("/uploads", express.static("uploads"));

// Middlewares
app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

const verificarToken = (req, res, next) => {
  const rawHeader = req.headers["authorization"];
  console.log("HEADER COMPLETO:", rawHeader);

  const token = rawHeader?.split(" ")[1];
  console.log("TOKEN EXTRAÍDO:", token);

  try {
    const decoded = jwt.verify(token, "secreto_safeher_2024");
    req.usuario = decoded;
    next();
  } catch (error) {
    console.log("ERROR VERIFY:", error);
    return res.status(401).json({ error: "Token inválido" });
  }
};

// Conexión MySQL
const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "", // si tienes contraseña ponla aquí
  database: "safeher",
});

db.connect((err) => {
  if (err) {
    console.error("Error MySQL:", err);
  } else {
    console.log("MySQL conectado 💜");
  }
});

// ============================
// SUBIR FOTO DE PERFIL
// ============================
app.post("/upload-profile", upload.single("image"), (req, res) => {
  const { id } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "No se subió ninguna imagen" });
  }

  const imagePath = req.file.filename;

  const sql = "UPDATE usuarias SET foto = ? WHERE id = ?";

  db.query(sql, [imagePath, id], (err, result) => {
    if (err) {
      console.log("ERROR MYSQL FOTO:", err);
      return res.status(500).json({ error: err.message });
    }

    res.json({
      message: "Foto guardada correctamente 💜",
      image: imagePath,
    });
  });
});

app.post("/alerta-emergencia", (req, res) => {

  const { id, latitud, longitud } = req.body;

  console.log("🚨 ALERTA RECIBIDA");

  const mensaje = `🚨 EMERGENCIA 🚨
Necesito ayuda.
Ubicación:
https://maps.google.com/?q=${latitud},${longitud}`;

  const sql = "SELECT telefono FROM contactos_confianza WHERE usuaria_id = ?";

  db.query(sql, [id], (err, contactos) => {

    if (err) {
      console.log("ERROR MYSQL:", err);
      return res.status(500).json({ error: "Error obteniendo contactos" });
    }

    if (contactos.length === 0) {
      return res.json({ success: false, message: "No hay contactos" });
    }

    const urls = contactos.map((c) => {

      const numero = c.telefono.replace(/\D/g, "");

      return `https://wa.me/52${numero}?text=${encodeURIComponent(mensaje)}`;

    });

    console.log("CONTACTOS:", urls);

    res.json({
      success: true,
      urls
    });

  });

});

app.post("/alerta", async (req, res) => {

  const { usuaria_id, latitud, longitud } = req.body;

  try {

    const [contactos] = await db.promise().query(
      "SELECT telefono FROM contactos_confianza WHERE usuaria_id = ?",
      [usuaria_id]
    );

    const link = `https://maps.google.com/?q=${latitud},${longitud}`;

    console.log("🚨 ALERTA");
    console.log("Ubicación:", link);

    contactos.forEach((c) => {
      console.log("Enviar alerta a:", c.telefono);
    });

    res.json({
      mensaje: "Alerta enviada con ubicación"
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      mensaje: "Error enviando alerta"
    });

  }

});

// ============================
// Rperfil vendedora
// ============================

app.get("/perfil/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.promise().query(
  `
  SELECT 
    nombre_negocio,
    nombre,
    email,
    telefono,
    direccion_negocio,
    descripcion_negocio,
    fecha_registro
  FROM vendedoras 
  WHERE id = ?
  `,
  [id]
);

    if (rows.length === 0) {
      return res.json({ mensaje: "Perfil no encontrado" });
    }

    res.json(rows[0]);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});

const vendedoraRoutes = require("./routes/vendedora");
app.use("/", vendedoraRoutes);


// ============================
// ACTUALIZAR PERFIL VENDEDORA
// ============================
app.put("/perfil/:id", async (req, res) => {

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

// ============================
// REGISTRO USUARIA
// ============================

app.post("/register", async (req, res) => {
  console.log("BODY RECIBIDO:", req.body);

  const {
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    email,
    telefono,
    password,
  } = req.body;

  try {
    // Verificar si el email ya existe
    const checkSql = "SELECT email FROM usuarias WHERE email = ?";
    db.query(checkSql, [email], async (checkErr, checkResult) => {
      if (checkErr) {
        return res.status(500).json({ error: checkErr.message });
      }

      if (checkResult.length > 0) {
        return res.status(400).json({ error: "El email ya está registrado" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const sql = `
        INSERT INTO usuarias
        (nombre, apellido_paterno, apellido_materno, email, telefono, password)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.query(
        sql,
        [
          nombre,
          apellidoPaterno,
          apellidoMaterno,
          email,
          telefono,
          hashedPassword,
        ],
        (err, result) => {
          if (err) {
            console.log("ERROR MYSQL:", err);
            return res.status(500).json({ error: err.message });
          }

          // Generar token JWT
          const token = jwt.sign(
            {
              id: result.insertId,
              email: email,
              rol: "usuaria",
            },
            "secreto_safeher_2024",
            { expiresIn: "7d" },
          );

          console.log("INSERT EXITOSO:", result);
          res.json({
            message: "Usuaria registrada correctamente 💜",
            token,
            usuario: {
              id: result.insertId,
              nombre,
              email,
              rol: "usuaria",
            },
          });
        },
      );
    });
  } catch (error) {
    console.log("ERROR GENERAL:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================
// REGISTRO VENDEDORA
// ============================

app.post("/register-vendedora", async (req, res) => {
  console.log("BODY VENDEDORA:", req.body);

  const {
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    email,
    telefono,
    password,
    nombreNegocio,
    tipoNegocio,
    descripcionNegocio,
    direccionNegocio,
    sitioWeb,
    redesSociales,
  } = req.body;

  try {
    // Verificar si el email ya existe
    const checkSql = "SELECT email FROM vendedoras WHERE email = ?";
    db.query(checkSql, [email], async (checkErr, checkResult) => {
      if (checkErr) {
        return res.status(500).json({ error: checkErr.message });
      }

      if (checkResult.length > 0) {
        return res.status(400).json({ error: "El email ya está registrado" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const sql = `
        INSERT INTO vendedoras
        (nombre, apellido_paterno, apellido_materno, email, telefono, password,
         nombre_negocio, tipo_negocio, descripcion_negocio, direccion_negocio,
         sitio_web, redes_sociales)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        sql,
        [
          nombre,
          apellidoPaterno,
          apellidoMaterno,
          email,
          telefono,
          hashedPassword,
          nombreNegocio,
          tipoNegocio,
          descripcionNegocio,
          direccionNegocio,
          sitioWeb,
          redesSociales,
        ],
        (err, result) => {
          if (err) {
            console.log("ERROR MYSQL VENDEDORA:", err);
            return res.status(500).json({ error: err.message });
          }

          // Generar token JWT
          const token = jwt.sign(
            {
              id: result.insertId,
              email: email,
              rol: "vendedora",
            },
            "secreto_safeher_2024",
            { expiresIn: "7d" },
          );

          console.log("VENDEDORA INSERTADA:", result);
          res.json({
            message: "Vendedora registrada correctamente 💜",
            token,
            usuario: {
              id: result.insertId,
              nombre,
              email,
              rol: "vendedora",
              negocio: {
                nombre: nombreNegocio,
                tipo: tipoNegocio,
              },
            },
          });
        },
      );
    });
  } catch (error) {
    console.log("ERROR GENERAL:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================
// LOGIN (para ambos roles)
// ============================

app.post("/login", async (req, res) => {
  console.log("LOGIN INTENTO:", req.body);

  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Email y contraseña son obligatorios" });
  }

  try {
    // Buscar primero en usuarias
    const sqlUsuaria = "SELECT * FROM usuarias WHERE email = ?";
    db.query(sqlUsuaria, [email], async (err, usuariaResult) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Si encontró en usuarias
      if (usuariaResult.length > 0) {
        const usuaria = usuariaResult[0];
        const passwordValida = await bcrypt.compare(password, usuaria.password);

        if (!passwordValida) {
          return res.status(401).json({ error: "Contraseña incorrecta" });
        }

        // Generar token
        const token = jwt.sign(
          {
            id: usuaria.id,
            email: usuaria.email,
            rol: "usuaria",
          },
          "secreto_safeher_2024",
          { expiresIn: "7d" },
        );

        return res.json({
          message: "Login exitoso",
          token,
          usuario: {
            id: usuaria.id,
            nombre: usuaria.nombre,
            apellidoPaterno: usuaria.apellido_paterno,
            apellidoMaterno: usuaria.apellido_materno,
            email: usuaria.email,
            telefono: usuaria.telefono,
            rol: "usuaria",
          },
        });
      }

      // Si no está en usuarias, buscar en vendedoras
      const sqlVendedora = "SELECT * FROM vendedoras WHERE email = ?";
      db.query(sqlVendedora, [email], async (err, vendedoraResult) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (vendedoraResult.length === 0) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const vendedora = vendedoraResult[0];
        const passwordValida = await bcrypt.compare(
          password,
          vendedora.password,
        );

        if (!passwordValida) {
          return res.status(401).json({ error: "Contraseña incorrecta" });
        }

        // Generar token
        const token = jwt.sign(
          {
            id: vendedora.id,
            email: vendedora.email,
            rol: "vendedora",
          },
          "secreto_safeher_2024",
          { expiresIn: "7d" },
        );

        res.json({
          message: "Login exitoso",
          token,
          usuario: {
            id: vendedora.id,
            nombre: vendedora.nombre,
            apellidoPaterno: vendedora.apellido_paterno,
            apellidoMaterno: vendedora.apellido_materno,
            email: vendedora.email,
            telefono: vendedora.telefono,
            rol: "vendedora",
            negocio: {
              nombre: vendedora.nombre_negocio,
              tipo: vendedora.tipo_negocio,
              descripcion: vendedora.descripcion_negocio,
              direccion: vendedora.direccion_negocio,
            },
          },
        });
      });
    });
  } catch (error) {
    console.log("ERROR LOGIN:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================
// VERIFICAR TOKEN (middleware)
// ============================
/*
const verificarToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  try {
    const decoded = jwt.verify(token, "secreto_safeher_2024");
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
};*/

// ============================
// OBTENER PERFIL (ruta protegida)
// ============================

app.get("/perfil", verificarToken, (req, res) => {
  const { id, rol } = req.usuario;

  if (rol === "usuaria") {
    const sql =
      "SELECT id, nombre, apellido_paterno, apellido_materno, email, telefono FROM usuarias WHERE id = ?";
    db.query(sql, [id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.length === 0)
        return res.status(404).json({ error: "Usuario no encontrado" });
      res.json({ usuario: result[0], rol });
    });
  } else {
    const sql =
      "SELECT id, nombre, apellido_paterno, apellido_materno, email, telefono, nombre_negocio, tipo_negocio, descripcion_negocio, direccion_negocio, sitio_web, redes_sociales FROM vendedoras WHERE id = ?";
    db.query(sql, [id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.length === 0)
        return res.status(404).json({ error: "Usuario no encontrado" });
      res.json({ usuario: result[0], rol });
    });
  }
});

// ============================
// CREAR CONTACTO
// ============================
app.post("/contactos", verificarToken, (req, res) => {
  console.log("POST /contactos ejecutado 🔥");

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
    INSERT INTO contactos_confianza
    (usuaria_id, nombre, telefono, parentesco, email, direccion,
     notificaciones_activas, es_principal)
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
      notificacionesActivas,
      esPrincipal,
    ],
    (err, result) => {
      if (err) {
        console.log("ERROR INSERT CONTACTO:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: "Contacto creado correctamente 💜",
        id: result.insertId,
      });
    },
  );
});

// ============================
// OBTENER CONTACTOS
// ============================
app.get("/contactos", verificarToken, (req, res) => {
  console.log("🔥 GET /contactos ejecutado");

  const { id } = req.usuario;

  const sql = "SELECT * FROM contactos_confianza WHERE usuaria_id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json(result);
  });
});
// ============================
// ACTUALIZAR CONTACTO
// ============================
app.put("/contactos/:id", verificarToken, (req, res) => {
  const contactoId = req.params.id;

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
    WHERE id=?
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
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ message: "Contacto actualizado 💜" });
    },
  );
});
// ============================
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
// ============================
// videos
// ============================
const videosRoutes = require('./routes/videos'); // ajusta la ruta si es necesario
app.use('/videos', videosRoutes);



// ============================
// SERVIDOR
// ============================
app.post("/test", (req, res) => {
  res.json({ ok: true });
});

app.get("/test-get", (req, res) => {
  res.json({ ok: true });
});
const http = require("http");
const { Server } = require("socket.io");

// Crear servidor HTTP para usar Socket.io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Cambia esto a la URL de tu app Expo en producción
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);
  socket.on("join_sala", (id_sala) => {
    socket.join(id_sala);
  });
  // Escuchar mensaje enviado
  socket.on("enviar_mensaje", ({ usuaria_id, mensaje, id_sala }) => {

  const sql = `
    INSERT INTO chat_mensajes (usuaria_id, mensaje, id_sala)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [usuaria_id, mensaje, id_sala], (err, result) => {
    if (err) return console.log("Error mensaje:", err);

    // 🔥 AQUÍ TRAEMOS LOS DATOS DE LA USUARIA
    db.query(
      "SELECT nombre, foto FROM usuarias WHERE id = ?",
      [usuaria_id],
      (err2, userResult) => {

        if (err2) return console.log("Error usuaria:", err2);

        const usuaria = userResult[0] || {};

        // 🔥 AQUÍ ARMAMOS LA URL COMPLETA DE LA FOTO
        const BASE_URL = process.env.BASE_URL || "http://192.168.1.67:3000";

const fotoUrl = usuaria.foto
  ? `${BASE_URL}/uploads/${usuaria.foto}`
  : null;

        // 🔥 ENVIAMOS TODO AL FRONT
        io.to(id_sala).emit("recibir_mensaje",{
          id: result.insertId,
          usuaria_id,
          nombre: usuaria.nombre,
          foto: fotoUrl,
          mensaje,
          id_sala,
          created_at: new Date()
        });

      }
    );
  });
});
  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id);
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} 💜`);
  console.log("Endpoints disponibles:");
  console.log("  POST /register - Registro usuaria");
  console.log("  POST /register-vendedora - Registro vendedora");
  console.log("  POST /login - Login (ambos roles)");
  console.log("  GET /perfil - Perfil (requiere token)");
  console.log("  GET /contactos - Contactos de confianza");
  console.log("  PUT /contactos/:id - Actualizar contacto");
});
app.get("/mensajes/:id_sala", (req, res) => {
  const { id_sala } = req.params;

  const sql = `
    SELECT 
      m.id,
      m.mensaje,
      m.usuaria_id,
      m.id_sala,
      m.created_at,
      u.nombre,
      u.foto
    FROM chat_mensajes m
    JOIN usuarias u ON m.usuaria_id = u.id
    WHERE m.id_sala = ?
    ORDER BY m.created_at ASC
  `;

  db.query(sql, [id_sala], (err, result) => {
    if (err) return res.status(500).json(err);

    const mensajes = result.map((m) => ({
      ...m,
      foto: m.foto
  ? `${process.env.BASE_URL || "http://192.168.1.67:3000"}/uploads/${m.foto}`
  : null,
    }));

    res.json(mensajes);
  });
 
});