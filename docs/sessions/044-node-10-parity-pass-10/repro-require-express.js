// Confirm `require('express')` works after npm install via our runtime.
var e = require('express');
console.log('express version:', require('express/package.json').version);
var app = e();
app.get('/health', function (req, res) { res.send('ok'); });
console.log('app constructed; routes:', app._router ? app._router.stack.length : '(express 5: no _router)');
console.log('typeof app.listen:', typeof app.listen);
console.log('SUCCESS');
