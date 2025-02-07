const db = require("../config/firebase");
const dayjs = require('dayjs');


// Create a coupon
exports.createCoupon = async (req, res) => {
  try {
    const data = req.body;

    // Create a simple object for the coupon
    const newCoupon = {
      code: data.code,
      type: data.type,
      discount: data.discount,
      startDate: data.startDate,
      expirationDate: data.expirationDate,
      maxUsesGlobal: data.maxUsesGlobal,
      maxUsesPerUser: data.maxUsesPerUser,
      status: data.status,
      usersUsed: [],
    };

    // Save to Firestore
    await db.collection("coupons").doc(data.code).set(newCoupon);

    res.status(201).json({ message: "Coupon created successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// List all coupons
exports.listCoupons = async (req, res) => {
  try {
    const snapshot = await db.collection("coupons").get();
    const coupons = snapshot.docs.map((doc) => doc.data());

    res.status(200).json(coupons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a specific coupon
exports.getCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const doc = await db.collection("coupons").doc(code).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Coupon not found!" });
    }

    res.status(200).json(doc.data());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const data = req.body;

    const doc = await db.collection("coupons").doc(code).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Coupon not found!" });
    }

    await db.collection("coupons").doc(code).update(data);
    res.status(200).json({ message: "Coupon updated successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { code } = req.params;

    const doc = await db.collection("coupons").doc(code).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Coupon not found!" });
    }

    await db.collection("coupons").doc(code).delete();
    res.status(200).json({ message: "Coupon deleted successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const isValid = (coupon, userId) => {
  const now = new Date(new Date().toISOString().split("T")[0]);
  // Verificações:
  if (coupon.status !== "active") {
    return { valid: false, message: "Coupon is inactive.", status: 400 };
  }
  if (new Date(coupon.startDate) > now) {
    return { valid: false, message: "Coupon is not valid yet.", status: 400 };
  }
  if (coupon.expirationDate && new Date(coupon.expirationDate) < now) {
    return { valid: false, message: "Coupon has expired.", status: 400 };
  }

  // Verifica uso global
  if (coupon.maxUsesGlobal !== "" && coupon.usersUsed.length >= coupon.maxUsesGlobal) {
    return { valid: false, message: "Coupon usage limit reached.", status: 400 };
  }

  // Verifica uso pelo usuário
  const userUses = coupon.usersUsed.filter((entry) => entry === userId).length;
  if (coupon.maxUsesPerUser !== null && userUses >= coupon.maxUsesPerUser) {
    return { valid: false, message: "User has reached max usage limit for this coupon.", status: 400 };
  }

  return { valid: true, message: "Coupon is valid.", status: 200 }

}

// ✅ 1. Validar se um cupom é válido para um usuário
exports.validateCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const couponRef = db.collection("coupons").doc(code);
    const couponDoc = await couponRef.get();

    if (!couponDoc.exists) {
      return res.status(404).json({ message: "Coupon not found." });
    }

    const coupon = couponDoc.data();
    const { status, message, valid } = isValid(coupon, userId)
    return res.status(status).json({ message: message, valid: valid });

  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const updateCouponStats = async (userId, couponCode, discountValue) => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // "YYYY-MM"
  const statsRef = db.collection("couponStats").doc(yearMonth);

  await db.runTransaction(async (transaction) => {
    const statsDoc = await transaction.get(statsRef);

    if (!statsDoc.exists) {
      // Se não existir, criar um novo registro para o mês
      transaction.set(statsRef, {
        yearMonth,
        totalCouponsUsed: { [couponCode]: 1 },
        totalSavings: discountValue,
        uniqueUsersUsedCoupons: [userId]
      });
    } else {
      const data = statsDoc.data();
      const updatedCouponsUsed = data.totalCouponsUsed || {};
      updatedCouponsUsed[couponCode] = (updatedCouponsUsed[couponCode] || 0) + 1;

      const uniqueUsers = new Set(data.uniqueUsersUsedCoupons || []);
      uniqueUsers.add(userId);

      transaction.update(statsRef, {
        totalCouponsUsed: updatedCouponsUsed,
        totalSavings: (data.totalSavings || 0) + discountValue,
        uniqueUsersUsedCoupons: Array.from(uniqueUsers)
      });
    }
  });
}

// ✅ 2. Registrar o uso do cupom
exports.redeemCoupon = async (req, res) => {
  try {
    const { couponCode, userId, originalPrice } = req.body;

    // Buscar o cupom
    const couponRef = db.collection("coupons").doc(couponCode);
    const couponDoc = await couponRef.get();

    if (!couponDoc.exists) {
      return res.status(404).json({ message: "Coupon not found." });
    }

    const coupon = couponDoc.data();
    const { status, message, valid } = isValid(coupon, userId)
    if (!valid) {
      return res.status(status).json({ message: message });
    }

    // Adicionar o usuário ao registro de uso
    coupon.usersUsed.push(userId);
    await couponRef.update({ usersUsed: coupon.usersUsed });

    // Calcular o valor com o desconto
    let discount = 0;
    if (coupon.discount.type === "percentage") {
      discount = (originalPrice * coupon.discount.value) / 100;
    } else if (coupon.discount.type === "fixed") {
      discount = coupon.discount.value;
    }

    const valueAfterDiscount = originalPrice - discount;

    // Registrar o valor gasto
    await db.collection("coupon_usage").add({
      userId: userId,
      couponCode: couponCode,
      originalPrice: originalPrice,
      valueAfterDiscount: valueAfterDiscount,
      timestamp: new Date(),
    });

    await updateCouponStats(userId, couponCode, (originalPrice - discount));

    res.status(200).json({
      message: "Coupon redeemed successfully!",
      discount,
      valueAfterDiscount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obter as estatísticas para o dashboard
exports.getCouponsStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const couponStats = {
      couponsInactive: 0,
      couponsActive: 0,
      couponsActiveReachedLimit: 0,
      couponsActiveWithLimit: 0,
      couponsUsedByUser: [],
      sumOfValuesSpent: 0,
    };

    // Filtro de data
    const start = startDate ? new Date(startDate) : new Date("1970-01-01");
    const end = endDate ? new Date(endDate) : new Date();

    // Consultar todos os cupons
    const couponsRef = db.collection("coupons");
    const couponsSnapshot = await couponsRef.get();
    couponsSnapshot.forEach((doc) => {
      const coupon = doc.data();
      const expirationDate = new Date(coupon.expirationDate);
      const startDate = new Date(coupon.startDate);

      // Filtrando cupons por data de criação
      if (startDate >= start && expirationDate >= end) {
        // Cupons inativos
        if (coupon.status === "inactive") {
          couponStats.couponsInactive++;
        }

        // Cupons ativos
        if (coupon.status === "active") {
          couponStats.couponsActive++;

          // Cupons que atingiram o limite global
          if (coupon.maxUsesGlobal <= coupon.usersUsed.length) {
            couponStats.couponsActiveReachedLimit++;
          }

          // Cupons com limite por usuário
          if (coupon.maxUsesPerUser > 0) {
            couponStats.couponsActiveWithLimit++;
          }
        }
      }
    });

    // Consultar o uso de cupons por usuário
    const usageRef = db.collection("coupon_usage");
    const usageSnapshot = await usageRef.where("timestamp", ">=", start).where("timestamp", "<=", end).get();

    usageSnapshot.forEach((doc) => {
      const usage = doc.data();
      couponStats.sumOfValuesSpent += (usage.originalPrice - usage.valueAfterDiscount);

      // Top 100 usuários que mais usaram cupons
      const userIndex = couponStats.couponsUsedByUser.findIndex(user => user.userId === usage.userId);

      if (userIndex !== -1) {
        // Usuário já existe na lista, atualizar os dados
        couponStats.couponsUsedByUser[userIndex].couponCodes.push(usage.couponCode);
        couponStats.couponsUsedByUser[userIndex].spent += (usage.originalPrice - usage.valueAfterDiscount);
      } else {
        // Adicionar novo usuário se ainda há espaço na lista (top 100)
        if (couponStats.couponsUsedByUser.length < 100) {
          couponStats.couponsUsedByUser.push({
            userId: usage.userId,
            couponCodes: [usage.couponCode], // Array de cupons usados
            spent: (usage.originalPrice - usage.valueAfterDiscount), // Soma total de descontos
          });
        }
      }
    });

  const lastMonths = getLastMonths(7, end); // Obtém os últimos 7 meses apartir da data selecionada
  const statsPromises = lastMonths.map((month) => db.collection("couponStats").doc(month).get());

  const statsSnapshots = await Promise.all(statsPromises); // Aguarda todas as consultas

  const stats = statsSnapshots.map((doc, index) => ({
    month: lastMonths[index], // Nome do mês
    data: doc.exists ? doc.data() : { totalCouponsUsed: {}, totalSavings: 0, uniqueUsersUsedCoupons: [] }
  }));

    res.status(200).json({ ...couponStats, monthlyStats: stats});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function getLastMonths(qtdMonths, date) {
  return [...Array(qtdMonths)].map((_, i) => dayjs(date).subtract(i, 'month').format('YYYY-MM'));
}