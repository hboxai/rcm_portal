const jwt = require('jsonwebtoken');
if (!process.env.JWT_SECRET) {
	console.error('JWT_SECRET is not set. Please export it or place it in your .env before generating a token.');
	process.exit(1);
}
const token = jwt.sign({ email: 'dev@local', role: 'admin' }, process.env.JWT_SECRET);
console.log(token);
