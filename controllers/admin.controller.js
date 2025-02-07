exports.dashboard = (req, res) => {
    res.status(200).json({
      message: "Welcome to the Admin Dashboard!",
      user: req.user, // Exibe os dados do usuário autenticado
    });
  };