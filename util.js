require("dotenv").config();

const bcrypt = require("bcrypt");
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
    await pets.insertOne(newPet);
    client.close();
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

  async searchAllPets(query) {
    if (query.birthdate) {
      query.birthdate = new Date(query.birthdate).getTime();
    }
    if (query.weight) {
      query.weight = parseInt(query.weight);
    }
    if (query.height) {
      query.height = parseInt(query.height);
    }
    if (query.hypoallergenic) {
      query.hypoallergenic = JSON.parse(query.hypoallergenic);
    }

    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const pets = db.collection("pets");
    const options = {
      sort: { name: 1 },
      projection: { name: 1, status: 1, imageFileName: 1 },
    };
    const result = await pets.find(query, options);
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
    const pet = await pets.updateOne(filter, updateDoc);
    client.close();
    return true;
  }

  async getUserById(uid) {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("users");
    const query = { _id: ObjectID(uid) };
    const user = await users.findOne(query);
    client.close();
    return user;
  }

  async getUserByEmail(email) {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("users");
    const query = { email: email };
    const user = await users.findOne(query);
    client.close();
    return user;
  }

  async getUsers() {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const usersDb = db.collection("users");
    const result = await usersDb.find();
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
}

module.exports = new Util();
