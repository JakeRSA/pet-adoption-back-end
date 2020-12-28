const util = require("./util.js");

class Validator {
  isValidName(name) {
    if (name.length > 0) {
      return true;
    }
    return false;
  }

  isValidEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (re.test(email)) {
      return true;
    }
    return false;
  }

  isValidPhone(phone) {
    if (phone[0] === "+" && !isNaN(phone.slice(1, phone.length))) {
      return true;
    }
    return false;
  }

  isValidPassword(password) {
    if (
      password.length >= 6 &&
      /\d/.test(password) && //contains digits
      /[a-zA-Z]/g.test(password) //contains letters
    ) {
      return true;
    }
    return false;
  }
  passWordsMatch(a, b) {
    return a === b;
  }

  async isInvalidSignUp(form) {
    let invalid = {};
    if (!this.isValidName(form.firstName)) {
      invalid["firstName"] = "first name is empty";
    }
    if (!this.isValidName(form.lastName)) {
      invalid["lastName"] = "last name is empty";
    }
    if (!this.isValidEmail(form.email)) {
      invalid["email"] = "email is invalid";
    }
    if (!this.isValidPhone(form.phone)) {
      invalid["phone"] =
        "phone num is invalid - must be in format +ccnnnnnn where cc is country code and n are remaining digits";
    }
    if (!this.isValidPassword(form.password)) {
      invalid["password"] =
        "password must include a number, a letter and be at least 6 chars long eg. passw0rd";
    }
    if (!this.passWordsMatch(form.password, form.passwordConfirm)) {
      invalid["passwordConfirm"] = "passwords do not match";
    }
    if (Object.keys(invalid).length == 0) {
      if (await util.getUserByEmail(form.email)) {
        invalid["email"] = "email already exists";
      } else return false;
    }
    return invalid;
  }
}

module.exports = new Validator();
