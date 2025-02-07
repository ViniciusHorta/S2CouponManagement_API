const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rotas
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const couponsRoutes = require("./routes/coupons.routes");

app.use("/auth", authRoutes);  // Rota para login
app.use("/admin", adminRoutes);  // Rota para painel administrativo
app.use("/coupons", couponsRoutes);  // Rota para painel administrativo


// Iniciar o servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});