const { truncate } = require("fs");
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

  async isValidAnimalType(animalType) {
    const animalTypes = await util.getAnimalTypes();
    if (animalTypes.includes(animalType)) {
      return true;
    }
    return false;
  }

  isValidBirthDate(birthDateString) {
    if (isNaN(new Date(birthDateString).getTime())) {
      return false;
    }
    return true;
  }

  isValidMeasure(measure) {
    const measureNum = parseInt(measure);
    if (typeof measureNum === "number" && measureNum > 0) {
      return true;
    }
    return false;
  }

  isBoolLike(bool) {
    if (JSON.parse(bool) === true || JSON.parse(bool) === false) {
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

  async isInvalidPet(form) {
    let invalid = {};
    if (!this.isValidName(form.name)) {
      invalid["name"] = "name is empty";
    }
    if (!(await this.isValidAnimalType(form.type))) {
      invalid["type"] = "animal type must be selected from dropdown";
    }
    if (!this.isValidName(form.breed)) {
      invalid[
        "breed"
      ] = `${form.type} must have a non-empty breed/species field`;
    }
    if (!this.isValidBirthDate(form.birthdate)) {
      invalid["birthdate"] =
        "birthdate string cannot be converted into Date object";
    }
    if (!this.isValidMeasure(form.weight)) {
      invalid["weight"] = "weight must be a number greater than 0";
    }
    if (!this.isValidMeasure(form.height)) {
      invalid["height"] = "height must be a number greater than 0";
    }
    if (!this.isValidName(form.color)) {
      invalid["color"] = "color is empty";
    }
    if (!this.isBoolLike(form.hypoallergenic)) {
      invalid["hypoallergenic"] = "must be a boolean";
    }
    if (Object.keys(invalid).length == 0) {
      return false;
    }

    return invalid;
  }

  async isInvalidUserUpdate(oldEmail, form) {
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
    if (form.email != oldEmail) {
      if (await util.getUserByEmail(form.email)) {
        invalid["email"] = "email already exists";
      }
    }
    if (Object.keys(invalid).length == 0) {
      return false
    }
    return invalid;
  }
}

module.exports = new Validator();
