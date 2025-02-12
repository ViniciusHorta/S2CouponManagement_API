const express = require("express");
const cors = require("cors");
require("dotenv").config();
const verifyToken = require("./middlewares/auth.middleware"); // Importe o middleware
const validateApiToken = require("./middlewares/apiToken.middleware");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rotas
const couponsRoutes = require("./routes/coupons.routes");
const tokensRoutes = require("./routes/tokens.routes");
const couponRoutes = require("./routes/coupon.routes");

app.use("/coupons", verifyToken, couponsRoutes); // Rota para painel administrativo
app.use("/tokens", verifyToken, tokensRoutes);
app.use("/coupon", validateApiToken, couponRoutes);

// Iniciar o servidor
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});