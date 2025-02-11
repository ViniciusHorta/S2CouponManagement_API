const express = require("express");
const cors = require("cors");
require("dotenv").config();
const verifyToken = require("./middlewares/auth.middleware"); // Importe o middleware


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rotas
const couponsRoutes = require("./routes/coupons.routes");

app.use("/coupons", verifyToken, couponsRoutes); // Rota para painel administrativo

// Iniciar o servidor
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});