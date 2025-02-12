const express = require("express");
const router = express.Router();
const tokensController = require("../controllers/tokens.controller");

router.get("/", tokensController.list);
router.post("/generate", tokensController.generate);
router.post("/revoke", tokensController.revoke);

module.exports = router; 