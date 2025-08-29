const jwt = require('jsonwebtoken');
const token = jwt.sign({ email: 'dev@local', role: 'admin' }, process.env.JWT_SECRET || 'rcm_secure_jwt_key_42550');
console.log(token);
