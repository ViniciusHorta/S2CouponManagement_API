const admin = require("firebase-admin");

const validateApiToken = async (req, res, next) => {
  const token = req.header("x-api-key");

  if (!token) {
    return res.status(403).json({ error: "No API token provided" });
  }

  try {
    const doc = await admin.firestore().collection("api_tokens").doc(token).get();

    if (!doc.exists || doc.data().revoked) {
      return res.status(403).json({ error: "Invalid or revoked API token" });
    }

    req.apiUser = doc.data(); // Passa os dados do token para o req
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = validateApiToken;