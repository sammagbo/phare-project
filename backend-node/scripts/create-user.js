#!/usr/bin/env node
// Creates a pHARe account. It is the only way to create one: the auth service has no sign-up route, so accounts are
// created by the administrator, in the server's terminal. The password comes from PHARE_PASSWORD, read without echo,
// so it shows neither on the screen nor in the shell history:
//
//   read -rs PHARE_PASSWORD && export PHARE_PASSWORD
//   node scripts/create-user.js prenom.nom@example.com
//   unset PHARE_PASSWORD
//
// The rules are those of the old sign-up: a valid email, not taken yet, and a password of 8 characters or more, with an
// upper and a lower case letter, a number and a symbol. The database is the service's (PHARE_DB_PATH, or
// backend-node/database.sqlite); on a brand-new one, the script creates the tables first.
require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const { newAccountRules } = require('../src/middleware/validationMiddleware');
const db = require('../src/db/database');
const UserModel = require('../src/models/userModel');

const SALT_ROUNDS = 10;

async function createUser() {
    const email = process.argv[2];
    const password = process.env.PHARE_PASSWORD;
    if (!email || !password) {
        console.error('usage: read -rs PHARE_PASSWORD && export PHARE_PASSWORD && node scripts/create-user.js <email>');
        return 2;
    }

    // the same rules as before, run on a request-like object; only the messages are printed, never the values
    const req = { body: { email, password } };
    for (const rule of newAccountRules) {
        await rule.run(req);
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        for (const error of errors.array()) console.error(`- ${error.msg}`);
        return 1;
    }

    // the email as the login normalizes it, so that the account can log in
    const normalized = req.body.email;
    if (await UserModel.findByEmail(normalized)) {
        console.error(`An account already exists for ${normalized}.`);
        return 1;
    }
    const id = await UserModel.create(normalized, await bcrypt.hash(password, SALT_ROUNDS));
    console.log(`Account created for ${normalized} (id ${id}).`);
    return 0;
}

createUser()
    .catch((err) => {
        console.error('Could not create the account:', err.message);
        return 1;
    })
    .then((code) => db.close(() => process.exit(code)));
