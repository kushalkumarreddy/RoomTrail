const http = require('http');

function post(path, body, token) {
  return request('POST', path, body, token);
}

function get(path, token) {
  return request('GET', path, null, token);
}

function put(path, body, token) {
  return request('PUT', path, body, token);
}

function del(path, token) {
  return request('DELETE', path, null, token);
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: 8080,
      path: path,
      method: method,
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== Step 1: Admin and User Authentication ===');
  const adminLogin = await post('/api/auth/login', { username: 'admink', password: 'admink' });
  console.log('Admin login status:', adminLogin.status);
  const adminToken = adminLogin.data.token;
  if (!adminToken) throw new Error('Failed to get admin token: ' + JSON.stringify(adminLogin.data));

  const userLogin = await post('/api/auth/login', { username: 'alex_traveler', password: 'password123' });
  console.log('User login status:', userLogin.status);
  const userToken = userLogin.data.token;
  if (!userToken) throw new Error('Failed to get user token: ' + JSON.stringify(userLogin.data));

  console.log('\n=== Step 2: Access Control (Regular User -> Admin Endpoints) ===');
  const metricsUser = await get('/api/admin/metrics', userToken);
  console.log('User accessing /api/admin/metrics status:', metricsUser.status, '(expected 403)');
  const usersUser = await get('/api/admin/users', userToken);
  console.log('User accessing /api/admin/users status:', usersUser.status, '(expected 403)');
  if (metricsUser.status !== 403 || usersUser.status !== 403) {
    throw new Error('Security failure: Regular user did not receive 403 Forbidden!');
  }

  console.log('\n=== Step 3: Admin Metrics Schema & Zero PII ===');
  const metricsAdmin = await get('/api/admin/metrics', adminToken);
  console.log('Admin metrics status:', metricsAdmin.status);
  console.log('Admin metrics data:', JSON.stringify(metricsAdmin.data, null, 2));
  // Verify expected fields and NO personal data
  const mKeys = Object.keys(metricsAdmin.data);
  const forbiddenKeys = ['email', 'username', 'password', 'fullName', 'phone', 'route', 'notes'];
  for (const k of forbiddenKeys) {
    if (mKeys.includes(k)) throw new Error(`Forbidden key found in metrics: ${k}`);
  }

  console.log('\n=== Step 4: Admin Users List Schema & Zero PII ===');
  const usersAdmin = await get('/api/admin/users', adminToken);
  console.log('Admin users status:', usersAdmin.status, 'Total users count:', usersAdmin.data.length);
  console.log('Sample user record:', JSON.stringify(usersAdmin.data[0], null, 2));
  for (const u of usersAdmin.data) {
    const uKeys = Object.keys(u);
    for (const forbidden of ['email', 'username', 'password', 'fullName', 'phone', 'city', 'bio', 'homeLat', 'homeLng']) {
      if (uKeys.includes(forbidden)) {
        throw new Error(`CRITICAL PRIVACY VIOLATION: User list contains personal field '${forbidden}'!`);
      }
    }
  }
  console.log('PASS: User list is strictly sanitized and contains zero personal information.');

  console.log('\n=== Step 5: Self-Action Guard (Admin cannot deactivate/delete own account) ===');
  // Admin user id is 5 (admink)
  const selfDeactivate = await put('/api/admin/users/5/status', { status: 'DEACTIVATED' }, adminToken);
  console.log('Admin deactivating self status:', selfDeactivate.status, selfDeactivate.data.message);
  if (selfDeactivate.status !== 400) throw new Error('Expected 400 Bad Request on self-deactivation');

  const selfDelete = await del('/api/admin/users/5', adminToken);
  console.log('Admin deleting self status:', selfDelete.status, selfDelete.data.message);
  if (selfDelete.status !== 400) throw new Error('Expected 400 Bad Request on self-deletion');

  console.log('\n=== Step 6: Create Temporary Test User for Deactivation & Deletion Testing ===');
  const testUsername = 'test_mgmt_' + Date.now();
  const testEmail = `${testUsername}@example.com`;
  const registerRes = await post('/api/auth/register', {
    username: testUsername,
    email: testEmail,
    password: 'Password123!',
    fullName: 'Test Account'
  });
  console.log('Registered temporary user status:', registerRes.status);
  const testLogin = await post('/api/auth/login', { username: testUsername, password: 'Password123!' });
  console.log('Initial test user login status:', testLogin.status);
  const testUserId = testLogin.data.user.id;
  console.log('Test user ID:', testUserId);

  console.log('\n=== Step 7: Deactivate Test Account ===');
  const deactivateRes = await put(`/api/admin/users/${testUserId}/status`, { status: 'DEACTIVATED' }, adminToken);
  console.log('Deactivate response status:', deactivateRes.status, deactivateRes.data);
  if (deactivateRes.status !== 200) throw new Error('Failed to deactivate user');

  console.log('\n=== Step 8: Verify Deactivated User Login Is Blocked ===');
  const blockedLogin = await post('/api/auth/login', { username: testUsername, password: 'Password123!' });
  console.log('Blocked login HTTP status:', blockedLogin.status);
  console.log('Blocked login error body:', blockedLogin.data);
  if (blockedLogin.status !== 401) {
    throw new Error('Deactivated user was able to log in or received wrong status code!');
  }

  console.log('\n=== Step 9: Reactivate Test Account ===');
  const reactivateRes = await put(`/api/admin/users/${testUserId}/status`, { status: 'ACTIVE' }, adminToken);
  console.log('Reactivate response status:', reactivateRes.status, reactivateRes.data);
  if (reactivateRes.status !== 200) throw new Error('Failed to reactivate user');

  const reactivatedLogin = await post('/api/auth/login', { username: testUsername, password: 'Password123!' });
  console.log('Reactivated user login status:', reactivatedLogin.status);
  if (reactivatedLogin.status !== 200) throw new Error('Reactivated user could not log in!');

  console.log('\n=== Step 10: Platform Overview Endpoint ===');
  const overviewRes = await get('/api/admin/overview', adminToken);
  console.log('Overview status:', overviewRes.status);
  console.log('Overview data:', JSON.stringify(overviewRes.data, null, 2));

  console.log('\n=== Step 11: Cascade Deletion of Test User ===');
  const deleteRes = await del(`/api/admin/users/${testUserId}`, adminToken);
  console.log('Delete response status:', deleteRes.status, deleteRes.data);
  if (deleteRes.status !== 200) throw new Error('Failed to delete test user');

  // Verify user is gone
  const deletedLogin = await post('/api/auth/login', { username: testUsername, password: 'Password123!' });
  console.log('Login attempt after deletion status:', deletedLogin.status);
  if (deletedLogin.status !== 401) throw new Error('Deleted user still exists!');

  console.log('\n=== Step 12: Audit Logs Verification ===');
  const auditLogsRes = await get('/api/admin/audit-logs', adminToken);
  console.log('Audit logs status:', auditLogsRes.status, 'Total entries:', auditLogsRes.data.length);
  console.log('Latest audit logs:', JSON.stringify(auditLogsRes.data.slice(0, 3), null, 2));
  for (const log of auditLogsRes.data) {
    const lKeys = Object.keys(log);
    for (const forbidden of ['email', 'password', 'phone', 'fullName', 'coordinates']) {
      if (lKeys.includes(forbidden)) throw new Error('Audit log leaks personal data');
    }
  }

  console.log('\n=============================================');
  console.log('ALL ADMIN BACKEND TESTS PASSED SUCCESSFULLY!!');
  console.log('=============================================');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
