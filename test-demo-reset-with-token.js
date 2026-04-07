// Generate admin token for testing
const jwt = require('jsonwebtoken');

const SECRET = 'your-secret-key-12345678901234567890123456';
const EXPIRES_IN = '4h';

const payload = {
  userId: 'admin-123',
  role: 'admin',
  username: 'admin'
};

const token = jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
console.log('Generated admin token:', token);

// Test demo-reset endpoint
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testDemoReset() {
  const url = 'http://localhost:4000/api/v1/admin/demo-reset';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.status === 500) {
      console.error('500 error detected!');
    } else {
      console.log('Test completed successfully');
    }
  } catch (error) {
    console.error('Error testing demo-reset:', error);
  }
}

testDemoReset();