const admin = require("firebase-admin");

const verifyToken = async (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(403).json({ error: "No token, authorization denied" });
  }

  try {
    // Verificar se o token tem o formato correto
    const tokenParts = token.split(" ");
    if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
      return res.status(401).json({ error: "Token format is invalid" });
    }

    // Verificar o token com o Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(tokenParts[1]);

    // Adiciona as informações do usuário ao req para acessar em outras rotas
    req.user = decodedToken;
    next();  // Prossegue para a próxima função de middleware ou rota

  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Token is not valid" });
  }
};

module.exports = verifyToken;