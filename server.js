require("dotenv").config();

const express = require("express");
const validator = require("./validation.js");
const util = require("./util.js");
const userAuth = require("./userAuth.json");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const cors = require("cors");

const port = 5000;
const app = express();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null)
    return res.sendStatus(401).send("access token not found in request header");
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403).send("access token not valid");
    req.user = user;
    next();
  });
};

app.use(express.json());

app.use(cors({ origin: true, credentials: true }));

app.post("/signup", (req, res) => {
  const form = req.body;
  const invalidForm = validator.isInvalidSignUp(form);
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
  const uid = util.getUidByEmail(form.email);
  if (!uid) {
    res.status(400).send({ email: "no such email in db" });
  } else {
    for (let user of userAuth) {
      if (user.id === uid) {
        bcrypt.compare(form.password, user.password, (err, result) => {
          if (result) {
            const userData = util.getUserById(uid);
            const accessToken = jwt.sign(
              userData.email,
              process.env.ACCESS_TOKEN_SECRET
            );
            res.json({ accessToken, user: userData.email });
          } else {
            res.status(400).send({ password: "incorrect password" });
          }
        });
      }
    }
  }
});

app.use(authenticateToken);
// EVERYTHING REQUIRING LOGIN MUST BE BELOW HERE

app.get("/currentuser", (req, res) => {
  console.log(req.headers);
  const user = util.getUserById(util.getUidByEmail(req.headers.user_email));
  if (user) {
    res.json(user);
  } else res.status(500);
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
