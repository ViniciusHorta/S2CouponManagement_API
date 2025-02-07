const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Aqui você deve configurar um usuário de administração para simulação
const adminUser = {
  username: "admin",
  //password: "$2a$10$khJps0Yah80q46VtYgqv0O3dFC/O0w82fuYo9yqHlJzHTnt1Szmlu",
  password: "$2a$10$KRpkbHEtnJV4hRfuvx2ZjejmhuPeDBV6lF3po6LVvhjlwowfQubGu",
  role: "administrator",
  email: "admin@s2therapy.com"
  //password: "$2a$10$dF3oPUfFYR64L9E54Nn56eQqKP.R2PCDtiyITfpMpyPP6NUJLQ9si", // senha hashada "admin123"
};

// Função para gerar o JWT e o Refresh Token
function generateTokens(user) {
  const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' }); // Expira em 7 dias

  return { accessToken, refreshToken };
}

exports.login = (req, res) => {
  const { username, password } = req.body;

  // Verificar se o nome de usuário existe
  if (username !== adminUser.username) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  // Verificar a senha
  bcrypt.compare(password, adminUser.password, (err, isMatch) => {
    if (err) {
      return res.status(500).json({ error: "Server error" });
    }

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Gerar tokens
    const { accessToken, refreshToken } = generateTokens({id:username,  });

    // Armazenar o refresh token em um cookie seguro
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, // Não acessível via JS
      secure: process.env.NODE_ENV === "production", // Apenas envia o cookie via HTTPS
      sameSite: "Strict", // Protege contra CSRF
    });

    res.status(200).json({ message: "Login successful", token: accessToken, user: {name: adminUser.username, role: adminUser.role, email:adminUser.email} });
  });
};

exports.refreshToken = (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(403).json({ message: "No refresh token provided" });
  }

  // Verificar se o refresh token é válido
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired refresh token" });
    }

    // Gerar um novo access token
    const { accessToken } = generateTokens(decoded);
    res.json({ accessToken });
  });
}

exports.verifyToken = (req, res) => {
  // O middleware `verifyToken` irá decodificar o token e adicionar as informações no `req.user`
  res.json({
    message: "Token is valid",
    user: {name: adminUser.username, role: adminUser.role, email:adminUser.email}, // Aqui você pode retornar as informações do usuário ou qualquer outro dado relevante
  });
};
``