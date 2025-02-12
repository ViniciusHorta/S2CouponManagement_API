const express = require("express");
const router = express.Router();
const couponsController = require("../controllers/coupons.controller");

router.get("/validate/:code", couponsController.validateCoupon);
router.post("/redeem", couponsController.redeemCoupon);

module.exports = router; 