require("dotenv").config();

const bcrypt = require("bcrypt");
const fs = require("fs");
const { ObjectID, MongoClient } = require("mongodb");
const dbLocation = process.env.DB_CONNECTION_STRING;
const dbName = "pet_db";

class Util {
  async getUserTypeFromToken(token) {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace("-", "+").replace("_", "/");
    const ascii = Buffer.from(base64, "base64").toString("ascii");
    const type = JSON.parse(ascii).type;
    return type;
  }

  async getEmailFromToken(token) {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace("-", "+").replace("_", "/");
    const ascii = Buffer.from(base64, "base64").toString("ascii");
    const email = JSON.parse(ascii).user;
    return email;
  }

  async addNewUser(form) {
    const { firstName, lastName, email, phone, password } = form;
    const saltRounds = 10;
    bcrypt.hash(form.password, saltRounds, async (err, hash) => {
      if (err) throw err;
      const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
      await client.connect();
      const db = client.db(dbName);
      const users = db.collection("users");
      const newUser = {
        firstName,
        lastName,
        passwordHash: hash,
        email,
        phone,
        type: "member",
      };
      await users.insertOne(newUser);
      client.close();
    });
  }

  async changePassword(uid, newPassword) {
    const saltRounds = 10;
    await bcrypt.hash(newPassword, saltRounds, async (err, hash) => {
      if (err) throw err;
      const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
      await client.connect();
      const db = client.db(dbName);
      const users = db.collection("users");
      const filter = { _id: ObjectID(uid) };
      const updateDoc = {
        $set: {
          passwordHash: hash,
        },
      };
      const user = await users.findOneAndUpdate(filter, updateDoc);
    });
  }

  async addNewPet(form) {
    const {
      name,
      type,
      breed,
      birthdate,
      weight,
      height,
      color,
      hypoallergenic,
      imageFileName,
      diet,
      bio,
    } = form;
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const pets = db.collection("pets");
    const newPet = {
      name,
      type,
      breed,
      birthdate: new Date(birthdate).getTime(),
      weight: parseInt(weight),
      height: parseInt(height),
      color,
      hypoallergenic: JSON.parse(hypoallergenic),
      diet,
      bio,
      status: "available",
      imageFileName,
    };
    const newPetDoc = await pets.insertOne(newPet);
    client.close();
    return newPetDoc.insertedId;
  }

  async editPet(form, id) {
    const {
      name,
      type,
      breed,
      birthdate,
      weight,
      height,
      color,
      hypoallergenic,
      imageFileName,
      diet,
      bio,
    } = form;
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const pets = db.collection("pets");
    const filter = { _id: ObjectID(id) };
    const updateDoc = {
      $set: {
        name,
        type,
        breed,
        birthdate: new Date(birthdate).getTime(),
        weight: parseInt(weight),
        height: parseInt(height),
        color,
        hypoallergenic: JSON.parse(hypoallergenic),
        imageFileName,
        diet,
        bio,
      },
    };
    const result = await pets.updateOne(filter, updateDoc);
    client.close();
  }

  async getAnimalTypes() {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const configCol = db.collection("config");
    const config = await configCol.findOne();
    client.close();
    return config.animalTypes;
  }

  async searchAllPets(formQuery) {
    let dbQuery = {};
    if (formQuery.name) dbQuery.name = formQuery.name;
    if (formQuery.status) dbQuery.status = formQuery.status;
    if (formQuery.type) dbQuery.type = formQuery.type;
    if (formQuery.birthdate) {
      dbQuery.birthdate = new Date(formQuery.birthdate).getTime();
    }
    if (formQuery.minWeight || formQuery.maxWeight) {
      dbQuery.weight = {};
      if (formQuery.minWeight)
        dbQuery.weight.$gte = parseInt(formQuery.minWeight);
      if (formQuery.maxWeight)
        dbQuery.weight.$lte = parseInt(formQuery.maxWeight);
    }
    if (formQuery.minHeight || formQuery.maxHeight) {
      dbQuery.height = {};
      if (formQuery.minHeight)
        dbQuery.height.$gte = parseInt(formQuery.minHeight);
      if (formQuery.maxHeight)
        dbQuery.height.$lte = parseInt(formQuery.maxHeight);
    }
    if (formQuery.hypoallergenic) {
      dbQuery.hypoallergenic = JSON.parse(formQuery.hypoallergenic);
    }

    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const pets = db.collection("pets");
    const options = {
      sort: { name: 1 },
      projection: { name: 1, status: 1, imageFileName: 1 },
    };
    const result = await pets.find(dbQuery, options);
    const matches = await result.toArray();
    client.close();
    return matches;
  }

  async adoptPet(petId, userId, type) {
    if (!["foster", "adopt"].includes(type)) {
      return false;
    }

    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const pets = db.collection("pets");
    const filter = { _id: ObjectID(petId) };
    const updateDoc = {
      $set: {
        status: type === "foster" ? "foster" : "has owner",
        carerId: userId,
      },
    };
    const pet = await pets.findOneAndUpdate(filter, updateDoc);
    client.close();
    return pet.value;
  }

  async returnPet(petId, userId) {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const pets = db.collection("pets");
    const filter = { _id: ObjectID(petId), carerId: ObjectID(userId) };
    const updateDoc = {
      $set: {
        status: "available",
      },
      $unset: {
        carerId: "",
      },
    };
    const pet = await pets.findOneAndUpdate(filter, updateDoc);
    client.close();
    return pet.value;
  }

  async savePetToUser(petId, uid) {
    const pet = await this.getPetById(petId);
    if (!pet) return false;
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("users");
    const filter = {
      _id: ObjectID(uid),
      savedPetIds: { $nin: [ObjectID(petId)] },
    };
    const updateDoc = {
      $push: { savedPetIds: ObjectID(petId) },
    };
    const user = await users.findOneAndUpdate(filter, updateDoc);
    return user.value;
  }

  async removeSavedPet(petId, uid) {
    const pet = await this.getPetById(petId);
    if (!pet) return false;
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("users");
    const filter = {
      _id: ObjectID(uid),
      savedPetIds: { $in: [ObjectID(petId)] },
    };
    const updateDoc = {
      $pull: { savedPetIds: ObjectID(petId) },
    };
    const user = await users.findOneAndUpdate(filter, updateDoc);
    client.close();
    return user.value;
  }

  async editUserSettings(uid, form) {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("users");
    const filter = {
      _id: ObjectID(uid),
    };
    const updateDoc = {
      $set: {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        bio: form.bio,
      },
    };
    const user = await users.findOneAndUpdate(filter, updateDoc);
    client.close();
    return user.value;
  }

  async getUserById(uid) {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("users");
    try {
      const query = { _id: ObjectID(uid) };
      const user = await users.findOne(query);
      client.close();
      return user;
    } catch (e) {
      client.close();
    }
  }

  async getUserByEmail(email) {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("users");
    try {
      const query = { email: email };
      const user = await users.findOne(query);
      client.close();
      return user;
    } catch (e) {
      client.close();
    }
  }

  async getUsers() {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const usersCol = db.collection("users");
    const options = {
      sort: { firstName: 1 },
      projection: { firstName: 1, lastName: 1, email: 1, phone: 1, type: 1 },
    };
    const result = await usersCol.find({}, options);
    const users = await result.toArray();
    client.close();
    return users;
  }

  async getPetById(petId) {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const pets = db.collection("pets");
    try {
      const query = { _id: ObjectID(petId) };
      const pet = await pets.findOne(query);
      client.close();
      return pet;
    } catch (e) {
      return false;
    }
  }

  async getPetsByUserId(uid) {
    const user = await this.getUserById(uid);
    if (!user) return false;
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const petsCol = db.collection("pets");
    const query = { carerId: ObjectID(uid) };
    const result = await petsCol.find(query);
    const pets = await result.toArray();
    client.close();
    return pets;
  }

  async getSavedPetsByUserId(uid) {
    const user = await this.getUserById(uid);
    if (!user) return false;
    if (!user.savedPetIds || user.savedPetIds.length == 0) return [];
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const petsCol = db.collection("pets");
    const petIds = user.savedPetIds.map((id) => ObjectID(id));
    const query = { _id: { $in: petIds } };
    const result = await petsCol.find(query);
    const pets = await result.toArray();
    client.close();
    return pets;
  }

  async getImageFileNames() {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const petsCol = db.collection("pets");
    const options = { projection: { _id: 0, imageFileName: 1 } };
    const result = await petsCol.find({}, options);
    const fileNames = await result.toArray();
    client.close();
    return fileNames.map((fileNameObj) => fileNameObj.imageFileName);
  }

  async cleanUpImages() {
    const imagesPath = "./public/pet_images/";
    const dbFileNames = await this.getImageFileNames();
    fs.readdir(imagesPath, (err, files) => {
      if (err) throw err;
      files.forEach((file) => {
        if (!dbFileNames.includes(file)) {
          fs.unlink(imagesPath + file, (err) => {
            if (err) throw err;
          });
        }
      });
    });
  }
}

module.exports = new Util();
