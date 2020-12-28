require("dotenv").config();

const express = require("express");
const validator = require("./validation.js");
const util = require("./util.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const port = 5000;
const app = express();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null)
    return res.status(401).send("access token not found in request header");
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.status(403).send("access token not valid");
    req.user = user;
    next();
  });
};

app.use(express.json());

app.use(cors({ origin: true, credentials: true }));

app.post("/signup", async (req, res) => {
  const form = req.body;
  const invalidForm = await validator.isInvalidSignUp(form);
  if (invalidForm) {
    res.status(400).send(invalidForm);
  } else {
    util.addNewUser(form);
    const accessToken = jwt.sign(
      { user: form.email },
      process.env.ACCESS_TOKEN_SECRET
    );
    res.json({ accessToken, user: form.email });
  }
});

app.post("/login", async (req, res) => {
  const form = req.body;
  const user = await util.getUserByEmail(form.email);
  if (!user) {
    res.status(400).send({ email: "no such email in db" });
  } else {
    bcrypt.compare(form.password, user.passwordHash, (err, result) => {
      if (err) throw err;
      if (result) {
        const accessToken = jwt.sign(
          user.email,
          process.env.ACCESS_TOKEN_SECRET
        );
        res.json({ accessToken, user: user.email });
      } else {
        res.status(400).send({ password: "incorrect password" });
      }
    });
  }
});

app.use(authenticateToken);
// EVERYTHING REQUIRING LOGIN MUST BE BELOW HERE

app.get("/currentuser", async (req, res) => {
  const user = await util.getUserByEmail(req.headers.user_email);
  if (user) {
    res.json(user);
  } else res.status(500);
});

app.get("/users", async (req, res) => {
  const users = await util.getUsers();
  res.send(users);
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
