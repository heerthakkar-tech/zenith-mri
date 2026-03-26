const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET || "zenith_secret_key";

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.userId;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
