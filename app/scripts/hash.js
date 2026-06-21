#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const pw = process.argv[2];
if (!pw) { console.error('Usage: npm run hash -- "your-password"'); process.exit(1); }
console.log(bcrypt.hashSync(pw, 10));
