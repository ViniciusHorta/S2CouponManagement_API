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
      maxDiscount: data.maxDiscount, // Adicionando o limite máximo de desconto
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
    return { valid: false, message: "Coupon is inactive.", status: 200 };
  }
  if (new Date(coupon.startDate) > now) {
    return { valid: false, message: "Coupon is not valid yet.", status: 200 };
  }
  if (coupon.expirationDate && new Date(coupon.expirationDate) < now) {
    return { valid: false, message: "Coupon has expired.", status: 200 };
  }

  // Verifica uso global
  if (coupon.maxUsesGlobal !== "" && coupon.usersUsed.length >= coupon.maxUsesGlobal) {
    return { valid: false, message: "Coupon usage limit reached.", status: 200 };
  }

  // Verifica uso pelo usuário
  const userUses = coupon.usersUsed.filter((entry) => entry === userId).length;
  if (coupon.maxUsesPerUser !== null && userUses >= coupon.maxUsesPerUser) {
    return { valid: false, message: "User has reached max usage limit for this coupon.", status: 200 };
  }

  return { valid: true, message: "Coupon is valid.", status: 200 }
};

// ✅ 1. Validar se um cupom é válido para um usuário
exports.validateCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const { userId, orderTotal } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    if (!orderTotal) {
      return res.status(400).json({ message: "Order total is required for discount validation." });
    }

    const couponRef = db.collection("coupons").doc(code);
    const couponDoc = await couponRef.get();

    if (!couponDoc.exists) {
      return res.status(404).json({ message: "Coupon not found." });
    }

    const coupon = couponDoc.data();
    const { status, message, valid } = isValid(coupon, userId)

    // Se o cupom for válido, calcular o valor final do pedido com o desconto aplicado
    if (valid) {
      let finalTotal = parseFloat(orderTotal);
      if (coupon.discount.type === "percentage") {
        const discountValue = (finalTotal * coupon.discount.value) / 100;
        if (coupon.maxDiscount) {
          finalTotal = finalTotal - Math.min(discountValue, coupon.maxDiscount);
        } else {
          finalTotal -= discountValue;
        }
      } else if (coupon.discount.type === "fixed") {
        finalTotal -= parseFloat(coupon.discount.value);
      }

      return res.status(status).json({
        message: message,
        valid: valid,
        finalTotal: finalTotal.toFixed(2), // Retorna o total final após o desconto
      });
    }

    return res.status(status).json({ message: message, valid: valid });

  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const updateCouponStats = async (userId, couponCode, discountValue, spaceId) => {
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
        totalSpacesUsed: { [spaceId]: 1 },
        totalSavings: discountValue,
        uniqueUsersUsedCoupons: [userId]
      });
    } else {
      const data = statsDoc.data();
      const updatedCouponsUsed = data.totalCouponsUsed || {};
      updatedCouponsUsed[couponCode] = (updatedCouponsUsed[couponCode] || 0) + 1;

      const updatedSpacesUsed = data.totalSpacesUsed || {};
      updatedSpacesUsed[spaceId] = (updatedSpacesUsed[spaceId] || 0) + 1;

      const uniqueUsers = new Set(data.uniqueUsersUsedCoupons || []);
      uniqueUsers.add(userId);

      transaction.update(statsRef, {
        totalCouponsUsed: updatedCouponsUsed,
        totalSavings: (data.totalSavings || 0) + discountValue,
        uniqueUsersUsedCoupons: Array.from(uniqueUsers),
        totalSpacesUsed: updatedSpacesUsed,
      });
    }
  });
};

// ✅ 2. Registrar o uso do cupom
exports.redeemCoupon = async (req, res) => {
  try {
    const { couponCode, userId, originalPrice, appliedAt } = req.body; // Recebendo 'appliedAt'

    // Verificar se o "appliedAt" foi enviado, se não, retornar erro
    if (!appliedAt) {
      return res.status(400).json({ message: "Application space (appliedAt) is required." });
    }

    // Buscar o cupom
    const couponRef = db.collection("coupons").doc(couponCode);
    const couponDoc = await couponRef.get();

    if (!couponDoc.exists) {
      return res.status(404).json({ message: "Coupon not found." });
    }

    const coupon = couponDoc.data();
    const { status, message, valid } = isValid(coupon, userId, originalPrice);
    if (!valid) {
      return res.status(status).json({ message: message });
    }

    // Adicionar o usuário ao registro de uso
    coupon.usersUsed.push(userId);
    await couponRef.update({ usersUsed: coupon.usersUsed });

    // Calcular o valor com o desconto
    let discount = 0;
    if (coupon.discount.type === "percentage") {
      // Calcula o desconto baseado no percentual
      discount = (originalPrice * coupon.discount.value) / 100;

      // Verifica se o desconto excede o limite máximo
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;  // Limita o desconto ao valor máximo permitido
      }
    } else if (coupon.discount.type === "fixed") {
      // Desconto fixo
      discount = coupon.discount.value;
    }

    const valueAfterDiscount = originalPrice - discount;

    // Registrar o valor gasto, incluindo o espaço onde o cupom foi aplicado
    await db.collection("coupon_usage").add({
      userId: userId,
      couponCode: couponCode,
      originalPrice: originalPrice,
      valueAfterDiscount: valueAfterDiscount,
      appliedAt: appliedAt,  // Registrando o espaço onde o cupom foi aplicado
      timestamp: new Date(),
    });

    // Atualizar as estatísticas do cupom (se necessário)
    await updateCouponStats(userId, couponCode, (originalPrice - discount), appliedAt);

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
      totalUniqueUsers: new Set(),
      totalUniqueSpaces: new Set(),
      uniqueUsersPerDay: {},
      discountsPerDay: {},
      totalDiscounts: 0,
      totalCouponsUsed: 0,
      couponsUsedPerDay: {},
      monthlyStats: [],
      couponsPerSpaceByMonth: {}, // Adicionando estrutura para armazenar cupons por espaço e mês
      valueSpentPerSpaceByMonth: {}, // Adicionando estrutura para armazenar valores gastos por espaço e mês
      spacesUsedPerDay: {}, // Adicionando estrutura para contar espaços usados por dia
    };

    const start = startDate ? dayjs(startDate) : dayjs("1970-01-01");
    const end = endDate ? dayjs(endDate) : dayjs();

    // Criar uma lista de todas as datas no intervalo
    const allDates = [];
    let currentDate = start;
    while (currentDate.isBefore(end) || currentDate.isSame(end, "day")) {
      const formattedDate = currentDate.format("YYYY-MM-DD");
      allDates.push(formattedDate);

      // Inicializar valores com 0 para garantir que todas as datas apareçam
      couponStats.uniqueUsersPerDay[formattedDate] = 0;
      couponStats.discountsPerDay[formattedDate] = 0;
      couponStats.couponsUsedPerDay[formattedDate] = 0;
      couponStats.spacesUsedPerDay[formattedDate] = 0; // Iniciando o contador para espaços

      currentDate = currentDate.add(1, "day");
    }

    // Consultar todos os cupons
    const couponsRef = db.collection("coupons");
    const couponsSnapshot = await couponsRef.get();

    couponsSnapshot.forEach((doc) => {
      const coupon = doc.data();
      const expirationDate = dayjs(coupon.expirationDate);
      const couponStartDate = dayjs(coupon.startDate);

      if (couponStartDate.isAfter(start) && expirationDate.isAfter(end)) {
        if (coupon.status === "inactive") couponStats.couponsInactive++;
        if (coupon.status === "active") {
          couponStats.couponsActive++;

          if (coupon.maxUsesGlobal <= coupon.usersUsed.length) {
            couponStats.couponsActiveReachedLimit++;
          }
          if (coupon.maxUsesPerUser > 0) {
            couponStats.couponsActiveWithLimit++;
          }
        }
      }
    });

    // Consultar o uso de cupons por usuário
    const usageRef = db.collection("coupon_usage");
    const usageSnapshot = await usageRef
      .where("timestamp", ">=", start.toDate())
      .where("timestamp", "<=", end.add(1, "day").toDate())
      .get();

    // Criação de uma estrutura para armazenar o valor gasto por cada cupom em cada mês
    const couponsSpentByMonth = {};

    usageSnapshot.forEach((doc) => {
      const usage = doc.data();
      const usageDate = dayjs(usage.timestamp.toDate()).format("YYYY-MM-DD");
      const space = usage.appliedAt; // Capturando o espaço onde o cupom foi aplicado

      // Usuários únicos por dia
      if (!couponStats.uniqueUsersPerDay[usageDate]) {
        couponStats.uniqueUsersPerDay[usageDate] = 0;
      }
      couponStats.uniqueUsersPerDay[usageDate] += 1;
      couponStats.totalUniqueUsers.add(usage.userId);
      couponStats.totalUniqueSpaces.add(usage.appliedAt);


      // Valor gasto pelo usuário
      const discountValue = usage.originalPrice - usage.valueAfterDiscount;
      couponStats.sumOfValuesSpent += discountValue;

      // Valor gasto em descontos por dia
      if (!couponStats.discountsPerDay[usageDate]) {
        couponStats.discountsPerDay[usageDate] = 0;
      }
      couponStats.discountsPerDay[usageDate] += discountValue;

      // Total de descontos no período
      couponStats.totalDiscounts += discountValue;

      // Contagem de cupons usados por dia
      if (!couponStats.couponsUsedPerDay[usageDate]) {
        couponStats.couponsUsedPerDay[usageDate] = 0;
      }
      couponStats.couponsUsedPerDay[usageDate]++;

      // Total de cupons usados no período
      couponStats.totalCouponsUsed++;

      // Top 100 usuários que mais usaram cupons
      const userIndex = couponStats.couponsUsedByUser.findIndex(user => user.userId === usage.userId);
      if (userIndex !== -1) {
        couponStats.couponsUsedByUser[userIndex].couponCodes.push(usage.couponCode);
        couponStats.couponsUsedByUser[userIndex].spent += discountValue;
      } else if (couponStats.couponsUsedByUser.length < 100) {
        couponStats.couponsUsedByUser.push({
          userId: usage.userId,
          couponCodes: [usage.couponCode],
          spent: discountValue,
        });
      }

      couponStats.couponsUsedByUser = couponStats.couponsUsedByUser.sort((a, b) => b.spent - a.spent);

      // Atualizar o valor gasto por cupom por mês
      const couponCode = usage.couponCode;
      const month = dayjs(usage.timestamp.toDate()).format("YYYY-MM");
      if (!couponsSpentByMonth[month]) {
        couponsSpentByMonth[month] = {};
      }
      if (!couponsSpentByMonth[month][couponCode]) {
        couponsSpentByMonth[month][couponCode] = 0;
      }
      couponsSpentByMonth[month][couponCode] += discountValue;

      // Adicionando as métricas para o espaço
      if (!couponStats.couponsPerSpaceByMonth[month]) {
        couponStats.couponsPerSpaceByMonth[month] = {};
        couponStats.valueSpentPerSpaceByMonth[month] = {};
      }
      // Contando os cupons usados por espaço por mês
      if (!couponStats.couponsPerSpaceByMonth[month][space]) {
        couponStats.couponsPerSpaceByMonth[month][space] = 0;
        couponStats.valueSpentPerSpaceByMonth[month][space] = 0;
      }
      couponStats.couponsPerSpaceByMonth[month][space]++;
      couponStats.valueSpentPerSpaceByMonth[month][space] += discountValue;

      // Contando espaços únicos por dia
      if (!couponStats.spacesUsedPerDay[usageDate]) {
        couponStats.spacesUsedPerDay[usageDate] = new Set(); // Usando Set para garantir que contamos cada espaço apenas uma vez por dia
      }
      couponStats.spacesUsedPerDay[usageDate].add(space);
    });

    // Converter os Sets em números para as estatísticas de espaços por dia
    for (const date in couponStats.spacesUsedPerDay) {
      if (typeof (couponStats.spacesUsedPerDay[date]) === typeof (new Set())) {
        couponStats.spacesUsedPerDay[date] = couponStats.spacesUsedPerDay[date].size; // Quantidade de espaços distintos
      }
    }

    // Converter os Sets em números
    couponStats.totalUniqueUsers = couponStats.totalUniqueUsers.size;
    couponStats.totalUniqueSpaces = couponStats.totalUniqueSpaces.size;

    // Garantir que todas as datas tenham um valor válido (mesmo se não houver registros)
    allDates.forEach((date) => {
      couponStats.uniqueUsersPerDay[date] = couponStats.uniqueUsersPerDay[date] || 0;
      couponStats.discountsPerDay[date] = couponStats.discountsPerDay[date] || 0;
      couponStats.couponsUsedPerDay[date] = couponStats.couponsUsedPerDay[date] || 0;
    });

    // Obter estatísticas dos últimos 7 meses
    const lastMonths = getLastMonths(7, end);
    const statsPromises = lastMonths.map((month) => db.collection("couponStats").doc(month).get());
    const statsSnapshots = await Promise.all(statsPromises);

    const stats = statsSnapshots.map((doc, index) => {
      const month = lastMonths[index];
      const data = doc.exists ? doc.data() : { totalCouponsUsed: {}, totalSavings: 0, uniqueUsersUsedCoupons: [] };

      // Adicionar o valor gasto por cupom
      const monthlyData = { ...data, totalSpentByCoupon: couponsSpentByMonth[month] || {} };

      return {
        month: month,
        data: monthlyData,
      };
    });

    res.status(200).json({ ...couponStats, monthlyStats: stats });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function getLastMonths(qtdMonths, date) {
  return [...Array(qtdMonths)].map((_, i) => dayjs(date).subtract(i, 'month').format('YYYY-MM'));
}

exports.getCouponDetails = async (req, res) => {
  try {
    const { code } = req.params;

    // Buscar o cupom
    const couponRef = db.collection("coupons").doc(code);
    const couponDoc = await couponRef.get();

    if (!couponDoc.exists) {
      return res.status(404).json({ message: "Coupon not found." });
    }

    const coupon = couponDoc.data();
    const {
      discount,
      maxDiscount,
      maxUsesGlobal,
      maxUsesPerUser,
      status,
      startDate,
      expirationDate, } = coupon; // Nome, limite de valor, e data de validade

    // Consultar histórico de uso do cupom
    const usageRef = db.collection("coupon_usage").where("couponCode", "==", code);
    const usageSnapshot = await usageRef.get();

    const usageHistory = [];
    usageSnapshot.forEach((doc) => {
      const usage = doc.data();
      const usageDate = dayjs(usage.timestamp.toDate()).format("YYYY-MM-DD");
      const totalSpent = usage.originalPrice - usage.valueAfterDiscount;
      usageHistory.push({
        userId: usage.userId,
        usageDate: usageDate,
        totalSpent: totalSpent,
        spaceId: usage.appliedAt,
        valueAfterDiscount: usage.valueAfterDiscount,
      });
    });

    res.status(200).json({
      code,
      discount,
      maxDiscount,
      maxUsesGlobal,
      maxUsesPerUser,
      status,
      startDate: dayjs(startDate).format("YYYY-MM-DD"),
      expirationDate: dayjs(expirationDate).format("YYYY-MM-DD"),
      usageHistory: usageHistory,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};