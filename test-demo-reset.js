// Test script for demo-reset endpoint
const fetch = require('node-fetch');

async function testDemoReset() {
  const url = 'http://localhost:4000/api/v1/admin/demo-reset';
  
  // Use a test admin token
  const token = 'test-admin-token';
  
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