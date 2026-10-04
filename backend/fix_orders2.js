const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');
const searchBase64 = Buffer.from('fSk7CiAgICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjsgcmVzLmpzb24oZGF0YSk7CiAgICB9IGNhdGNoIChlcnIpIHsgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ+C5gOC4geC4tOC4lOC4guC5ieC4reC4nOC4tOC4lOC4nuC4peC4suC4lOC4oOC4suC4ouC5g+C4meC4o+C4sOC4muC4micgfSk7IH0KfSk7CgoKYXBwLnB1dCgnL2FwaS9vcmRlcnMvOmlkJywgYXN5bmMgKHJlcSwgcmVzKSA9PiB7', 'base64').toString('utf8');
const replaceBase64 = Buffer.from('fSk7CgoKYXBwLnB1dCgnL2FwaS9vcmRlcnMvOmlkJywgYXN5bmMgKHJlcSwgcmVzKSA9PiB7', 'base64').toString('utf8');
content = content.replace(searchBase64, replaceBase64);
fs.writeFileSync('server.js', content, 'utf8');
