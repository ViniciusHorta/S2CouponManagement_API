const express = require("express");
const router = express.Router();
const couponsController = require("../controllers/coupons.controller");

// Coupon CRUD routes
router.post("/", couponsController.createCoupon);
router.get("/", couponsController.listCoupons);
router.get("/stats", couponsController.getCouponsStats)
router.get("/validate/:code", couponsController.validateCoupon);
router.post("/redeem", couponsController.redeemCoupon);
router.get("/details/:code", couponsController.getCouponDetails);
router.get("/:code", couponsController.getCoupon);
router.put("/:code", couponsController.updateCoupon);
router.delete("/:code", couponsController.deleteCoupon);

module.exports = router; 