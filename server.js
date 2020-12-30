require("dotenv").config();

const express = require("express");
const validator = require("./validation.js");
const util = require("./util.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, petImagesDir + "/");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() +
        Math.floor(Math.random() * 1e3) +
        path.extname(file.originalname)
    );
  },
});
const upload = multer({ storage });
const petImagesDir = "pet_images";
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

const adminOnly = async (req, res, next) => {
  const userType = await util.getUserTypeFromToken(
    req.headers.authorization.split(" ")[1]
  );
  if (userType != "admin") {
    res.status(403).send("You require admin rights to access this endpoint");
  } else {
    next();
  }
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
      { user: form.email, type: "member" },
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
          { user: user.email, type: user.type },
          process.env.ACCESS_TOKEN_SECRET
        );
        res.json({ accessToken, user: user.email });
      } else {
        res.status(400).send({ password: "incorrect password" });
      }
    });
  }
});

app.get("/pet/:id", async (req, res) => {
  const id = req.params.id;
  const pet = await util.getPetById(id);
  if (pet) res.send(pet);
  else res.status(404).send(`No animal found with id ${id}`);
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
  const userType = await util.getUserTypeFromToken(
    req.headers.authorization.split(" ")[1]
  );
  if (userType != "admin") {
    res.status(403).send("You require admin rights to access this endpoint");
  } else {
    const users = await util.getUsers();
    res.send(users);
  }
});

app.use(adminOnly);
//EVERYTHING REQUIRING ADMIN RIGHTS MUST BE BELOW HERE

const newPetFields = [{ name: "imageFile", maxCount: 1 }];

app.post("/pet", upload.fields(newPetFields), async (req, res) => {
  const imageFileName = req.files.imageFile[0].filename;
  const form = req.body;
  form.imageFileName = imageFileName;
  let invalidForm = await validator.isInvalidPet(form);
  if (invalidForm) {
    if (!imageFileName) invalidForm["imageFile"] = "must upload an image";
    else if (![".jpg", ".jpeg", ".png"].includes(imageFileName.split(".")[1]))
      invalidForm["imageFile"] = "image must be .jpg or .png";
    fs.unlink(`./${petImagesDir}/` + imageFileName, (err) => {
      if (err) return;
    });
    res.status(400).send(invalidForm);
  } else {
    util.addNewPet(form);
    res.send("added new pet");
  }
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
