const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/vendedor/pedidos',
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body.substring(0, 500));
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.end();
