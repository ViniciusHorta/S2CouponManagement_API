const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const verifyToken = require("./middlewares/auth.middleware"); // Importe o middleware


const app = express();
app.use(cors());
app.use(express.json());

// Rotas
const couponsRoutes = require("./routes/coupons.routes");

app.use("/coupons", verifyToken, couponsRoutes); // Rota para painel administrativo


// Exportando a API para o Firebase Functions
exports.api = functions.https.onRequest(app);
