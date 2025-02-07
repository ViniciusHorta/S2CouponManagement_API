const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth.middleware");
const adminController = require("../controllers/admin.controller");

// Proteger a rota de painel administrativo
router.get("/dashboard", verifyToken, adminController.dashboard);

module.exports = router;