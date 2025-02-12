const admin = require("firebase-admin");
const db = require("../config/firebase");
const { v4: uuidv4 } = require("uuid");

// Criar um novo API Token
exports.generate = async (req, res) => {
    const { appName } = req.body;
    if (!appName) return res.status(400).json({ error: "App Name is required" });

    const newToken = uuidv4(); // Gera um UUID como token
    await db.collection("api_tokens").doc(newToken).set({
        token: newToken,
        appName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        revoked: false,
    });

    res.json({ token: newToken });
};

// Listar API Tokens
exports.list = async (req, res) => {
    const snapshot = await db.collection("api_tokens").get();
    const tokens = snapshot.docs.map((doc) => doc.data());
    res.json(tokens);
};

// Revogar um Token
exports.revoke = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    await db.collection("api_tokens").doc(token).update({ revoked: true });
    res.json({ message: "Token revoked successfully" });
};
