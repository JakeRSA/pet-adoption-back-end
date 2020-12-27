const bcrypt = require("bcrypt");
const fs = require("fs");
const users = require("./users.json");
const userAuth = require("./userAuth.json");
const jwt = require("jsonwebtoken");
const { getMaxListeners } = require("process");

class Util {
  generateUserId(users) {
    const idArray = users.map((user) => {
      return user.id;
    });
    if (idArray.length > 0) {
      const max = idArray.reduce(function (a, b) {
        return Math.max(a, b);
      });
      return max + 1;
    }
    return 1;
  }

  storeEncryptedPassword(id, password) {
    const saltRounds = 10;
    bcrypt.hash(password, saltRounds, function (err, hash) {
      fs.readFile("./userAuth.json", (err, data) => {
        if (err) {
          console.log(err);
          throw err;
        }
        const passwords = JSON.parse(data);
        passwords.push({ id, password: hash });
        fs.writeFile("./userAuth.json", JSON.stringify(passwords), (err) => {
          if (err) {
            console.log(err);
            throw err;
          }
        });
      });
    });
  }

  addNewUser(form) {
    const userList = JSON.parse(fs.readFileSync("./users.json"));
    const { firstName, lastName, email, phone, password } = form;
    const id = this.generateUserId(userList);
    userList.push({
      id,
      firstName,
      lastName,
      email,
      phone,
      type: "member",
    });
    fs.writeFileSync("./users.json", JSON.stringify(userList), (err) => {
      if (err) {
        console.log(err);
        throw err;
      }
    });
    this.storeEncryptedPassword(id, password);
  }

  getUserById(uid) {
    for (let user of users) {
      if (uid === user.id) {
        return user;
      }
    }
  }

  getUidByEmail(email) {
    for (let user of users) {
      if (email === user.email) {
        return user.id;
      }
    }
  }
}

module.exports = new Util();
