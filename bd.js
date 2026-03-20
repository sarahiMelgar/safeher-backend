const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "127.0.0.1", // 👈 ESTE ES EL CAMBIO IMPORTANTE
  user: "root",
  password: "",
  database: "safeher",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Verificar conexión
pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Error conectando a MySQL:", err);
  } else {
    console.log("✅ Conectado a MySQL");
    connection.release();
  }
});

module.exports = pool.promise();