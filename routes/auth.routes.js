const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

router.post("/login", authController.login);
router.post("/refresh-token", authController.refreshToken);
router.get("/verify", authController.verifyToken);

module.exports = router;