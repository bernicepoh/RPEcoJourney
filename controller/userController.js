const db = require("../db");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

/* ======================================================
   LOGIN
====================================================== */
exports.login = async (req, res) => {
  const { userName, password } = req.body;

  try {
    const sql = `
      SELECT * FROM "user"
      WHERE userName = $1
      AND password = encode(digest($2, 'sha256'), 'hex')
    `;

    const result = await db.query(sql, [userName, password]);

    if (result.rows.length === 0) {
      return res.render("login", { error: "Invalid username or password" });
    }

    req.session.user = result.rows[0];
    res.redirect("/dashboard");

  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).send("Server error");
  }
};

/* ======================================================
   REGISTER
====================================================== */
exports.register = async (req, res) => {
  const { userName, email, password, contactNo } = req.body;

  try {
    const sql = `
      INSERT INTO "user" (userName, email, password, contactNo)
      VALUES ($1, $2, encode(digest($3, 'sha256'), 'hex'), $4)
    `;

    await db.query(sql, [userName, email, password, contactNo]);
    res.redirect("/login");

  } catch (err) {
    console.error("Register error:", err);
    res.status(500).send("Registration failed");
  }
};

/* ======================================================
   FORGOT PASSWORD (SEND TEMP PASSWORD)
====================================================== */
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const tempPassword = crypto.randomBytes(4).toString("hex");

  try {
    const updateSql = `
      UPDATE "user"
      SET password = encode(digest($1, 'sha256'), 'hex')
      WHERE email = $2
    `;

    const result = await db.query(updateSql, [tempPassword, email]);

    if (result.rowCount === 0) {
      return res.render("forgotPassword", { error: "Email not found" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      to: email,
      subject: "Password Reset",
      text: `Your temporary password is: ${tempPassword}`
    });

    res.render("forgotPassword", { success: "Temporary password sent!" });

  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).send("Server error");
  }
};

/* ======================================================
   RESET PASSWORD (VERIFY TEMP PASSWORD)
====================================================== */
exports.resetPassword = async (req, res) => {
  const { email, tempPassword, newPassword } = req.body;

  try {
    const checkSql = `
      SELECT * FROM "user"
      WHERE email = $1
      AND password = encode(digest($2, 'sha256'), 'hex')
    `;

    const userResult = await db.query(checkSql, [email, tempPassword]);

    if (userResult.rows.length === 0) {
      return res.render("resetPassword", { error: "Invalid temporary password" });
    }

    const updateSql = `
      UPDATE "user"
      SET password = encode(digest($1, 'sha256'), 'hex')
      WHERE email = $2
    `;

    await db.query(updateSql, [newPassword, email]);
    res.redirect("/login");

  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).send("Server error");
  }
};

/* ======================================================
   LOGOUT
====================================================== */
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
};