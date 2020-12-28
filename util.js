require("dotenv").config();

const bcrypt = require("bcrypt");
const { ObjectID, MongoClient } = require("mongodb");
const dbLocation = process.env.DB_CONNECTION_STRING;
const dbName = "pet_db";

class Util {
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
        dateCreated: new Date().getTime(),
      };
      await users.insertOne(newUser);
      client.close();
    });
  }

  async getUserById(uid) {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("users");
    const query = { _id: ObjectID(uid) };
    const user = await users.findOne(query);
    return user;
  }

  async getUserByEmail(email) {
    const client = new MongoClient(dbLocation, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("users");
    const query = { email: email };
    const user = await users.findOne(query);
    return user;
  }
}

module.exports = new Util();
