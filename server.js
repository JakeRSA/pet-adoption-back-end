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
const petImagesDir = "public/pet_images";
const port = process.env.PORT || 5000;
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

app.use(express.static("public"));
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

app.post("/signup", async (req, res) => {
  const form = req.body;
  const invalidForm = await validator.isInvalidSignUp(form);
  if (invalidForm) {
    res.status(400).send(invalidForm);
  } else {
    await util.addNewUser(form);
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

app.get("/pet", async (req, res) => {
  const results = await util.searchAllPets(req.query);
  res.send(results);
});

app.get("/user/:id", async (req, res) => {
  const id = req.params.id;
  const user = await util.getUserById(id);
  if (!user) {
    res.sendStatus(400);
    return;
  }
  const partialUser = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    bio: user.bio,
  };
  res.send(partialUser);
});

app.get("/user/:id/full", async (req, res) => {
  const id = req.params.id;
  const user = await util.getUserById(id);
  if (!user) {
    res.sendStatus(400);
    return;
  }
  const { passwordHash, ...passwordlessUser } = user;
  res.send(passwordlessUser);
});

app.put("/user/:id/password", async (req, res) => {
  const id = req.params.id;
  const user = await util.getUserById(id);
  if (!user) {
    res.status(400).send("user id not found in database");
    return;
  }
  const form = req.body;
  const invalidForm = validator.isInvalidPasswordForm(form);
  if (invalidForm) {
    res.status(400).send(invalidForm);
    return;
  }
  bcrypt.compare(form.oldPassword, user.passwordHash, async (err, result) => {
    if (err) throw err;
    if (result) {
      util
        .changePassword(id, form.newPassword)
        .then(res.send("successfully changed password"));
    } else {
      res.status(400).send({ password: "old password is incorrect" });
    }
  });
});

app.get("/types", async (req, res) => {
  const types = await util.getAnimalTypes();
  res.json(types);
});

app.use(authenticateToken);

/*
EVERYTHING REQUIRING LOGIN MUST BE BELOW HERE
*/

app.get("/currentuser", async (req, res) => {
  const user = await util.getUserByEmail(req.headers.user_email);
  if (user) {
    res.json(user);
  } else res.status(500);
});

app.put("/pet/:id/adopt", async (req, res) => {
  const petId = req.params.id;
  if (!(await util.getPetById(petId))) {
    res.sendStatus(404);
  }
  const type = req.body.type;
  const userEmail = await util.getEmailFromToken(
    req.headers.authorization.split(" ")[1]
  );
  const user = await util.getUserByEmail(userEmail);
  const uid = user._id;
  const adopted = await util.adoptPet(petId, uid, type);
  if (!adopted) res.sendStatus(400);
  res.send(`pet with id ${petId} ${type}ed by user with id ${uid}`);
});

app.put("/pet/:id/return", async (req, res) => {
  const petId = req.params.id;
  if (!(await util.getPetById(petId))) {
    res.sendStatus(404);
  }
  const userEmail = await util.getEmailFromToken(
    req.headers.authorization.split(" ")[1]
  );
  const user = await util.getUserByEmail(userEmail);
  const uid = user._id;
  const returned = await util.returnPet(petId, uid);
  if (!returned) res.sendStatus(400);
  res.send(`pet with id ${petId} returned by user with id ${uid}`);
});

app.put("/pet/:id/save", async (req, res) => {
  const petId = req.params.id;
  if (!(await util.getPetById(petId))) {
    res.sendStatus(404);
    return;
  }
  const userEmail = await util.getEmailFromToken(
    req.headers.authorization.split(" ")[1]
  );
  const user = await util.getUserByEmail(userEmail);
  const uid = user._id;
  const updatedUser = await util.savePetToUser(petId, uid);
  if (!updatedUser) {
    res.sendStatus(400);
    return;
  }
  res.send(
    `saved pet with id ${petId} to saved pets list for user with id ${uid}`
  );
});

app.delete("/pet/:id/save", async (req, res) => {
  const petId = req.params.id;
  if (!(await util.getPetById(petId))) {
    res.sendStatus(404);
  }
  const userEmail = await util.getEmailFromToken(
    req.headers.authorization.split(" ")[1]
  );
  const user = await util.getUserByEmail(userEmail);
  const uid = user._id;
  const updatedUser = await util.removeSavedPet(petId, uid);
  if (!updatedUser) res.sendStatus(400);
  res.send(
    `removed pet with id ${petId} from saved pets list for user with id ${uid}`
  );
});

app.get("/pet/user/:id", async (req, res) => {
  const uid = req.params.id;
  const pets = await util.getPetsByUserId(uid);
  if (!pets) res.sendStatus(404);
  res.send(pets);
});

app.get("/saved/user/:id", async (req, res) => {
  const uid = req.params.id;
  const pets = await util.getSavedPetsByUserId(uid);
  if (!pets) {
    res.sendStatus(404);
    return;
  }
  res.send(pets);
});

app.put("/user/:id", async (req, res) => {
  const uid = req.params.id;
  const tokenEmail = await util.getEmailFromToken(
    req.headers.authorization.split(" ")[1]
  );
  const tokenUser = await util.getUserByEmail(tokenEmail);
  if (!tokenUser || uid != tokenUser._id) {
    res.sendStatus(400);
    return;
  }
  const form = req.body;
  const invalidForm = await validator.isInvalidUserUpdate(tokenEmail, form);
  if (invalidForm) {
    res.status(400).send(invalidForm);
    return;
  }
  const updatedUser = await util.editUserSettings(uid, form);
  if (!updatedUser) {
    res.sendStatus(500);
    return;
  }
  //need to send updated token if email was changed
  if (form.email != tokenEmail) {
    const accessToken = jwt.sign(
      { user: form.email, type: tokenUser.type },
      process.env.ACCESS_TOKEN_SECRET
    );
    res.send({ accessToken, user: form.email });
    return;
  }
  res.send("done");
});

app.use(adminOnly);

/*
EVERYTHING REQUIRING ADMIN RIGHTS MUST BE BELOW HERE
*/

const newPetFields = [{ name: "imageFile", maxCount: 1 }];

app.post("/pet", upload.fields(newPetFields), async (req, res) => {
  let imageFileName;
  try {
    imageFileName = req.files.imageFile[0].filename;
  } catch (e) {}
  const form = req.body;
  form.imageFileName = imageFileName;
  let invalidForm = await validator.isInvalidPet(form);
  if (invalidForm) {
    if (!imageFileName) invalidForm["imageFile"] = "must upload an image";
    else if (!["jpg", "jpeg", "png"].includes(imageFileName.split(".")[1]))
    invalidForm["imageFile"] = "image must be .jpg or .png";
    fs.unlink(`./${petImagesDir}/` + imageFileName, (err) => {
      if (err) return;
    });
    res.status(400).send(invalidForm);
  } else {
    const newPetId = await util.addNewPet(form);
    res.send(newPetId);
  }
});

app.put("/pet/:id", upload.fields(newPetFields), async (req, res) => {
  const form = req.body;
  if (Object.keys(req.files).length > 0) {
    const imageFileName = req.files.imageFile[0].filename;
    form.imageFileName = imageFileName;
  }
  let invalidForm = await validator.isInvalidPet(form);
  if (invalidForm) {
    if (![".jpg", ".jpeg", ".png"].includes(imageFileName.split(".")[1]))
      invalidForm["imageFile"] = "image must be .jpg or .png";
    fs.unlink(`./${petImagesDir}/` + imageFileName, (err) => {
      if (err) return;
    });
    res.status(400).send(invalidForm);
  } else {
    util.editPet(form, req.params.id);
    res.send("successfully edited pet details");
  }
});

app.get("/user", async (req, res) => {
  const users = await util.getUsers();
  res.send(users);
});

setInterval(()=> {
  util.cleanUpImages()
}, 1000 * 60 * 60 * 24)

app.listen(port, () => {
  console.log(`Listening`);
});
