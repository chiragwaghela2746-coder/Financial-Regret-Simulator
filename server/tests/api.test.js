const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');

// Use in-memory test DB
const MONGO_URI = 'mongodb://localhost:27017/frs_test_' + Date.now();

beforeAll(async () => {
  process.env.MONGO_URI = MONGO_URI;
  process.env.JWT_SECRET = 'test_secret';
  process.env.MOCK_AI = 'true';
  process.env.DEMO_MODE = 'true';
  await mongoose.connect(MONGO_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

let token;
let userId;
let simulationId;

describe('Auth Routes', () => {
  it('POST /api/auth/register - should register user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test@example.com');
    token = res.body.token;
    userId = res.body.user.id;
  });

  it('POST /api/auth/register - duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/login - valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('POST /api/auth/login - invalid password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me - returns user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
  });
});

describe('Profile Routes', () => {
  it('GET /api/profile - 404 when no profile', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('PUT /api/profile - creates/updates profile', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ monthlyIncome: 80000, monthlyExpenses: 40000, savings: 100000 });
    expect(res.status).toBe(200);
    expect(res.body.monthlyIncome).toBe(80000);
  });

  it('PUT /api/profile - validates negative income', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ monthlyIncome: -1000, monthlyExpenses: 40000, savings: 100000 });
    expect(res.status).toBe(422);
  });
});

describe('Goal Routes', () => {
  let goalId;

  it('POST /api/goals - creates goal', async () => {
    const res = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Emergency Fund', amount: 200000, targetMonths: 12 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Emergency Fund');
    goalId = res.body._id;
  });

  it('POST /api/goals - creates second goal', async () => {
    await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vacation', amount: 50000, targetMonths: 6 });
  });

  it('GET /api/goals - returns goals', async () => {
    const res = await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('PUT /api/goals/:id - updates goal', async () => {
    const res = await request(app)
      .put(`/api/goals/${goalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Emergency Fund Updated', amount: 250000, targetMonths: 15 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Emergency Fund Updated');
  });

  it('DELETE /api/goals/:id - deletes goal', async () => {
    const res = await request(app)
      .delete(`/api/goals/${goalId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Simulation Routes', () => {
  it('POST /api/simulations - runs simulation with MOCK_AI', async () => {
    const res = await request(app)
      .post('/api/simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        purchase: {
          name: 'iPhone 15',
          price: 90000,
          mode: 'full',
        },
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('result');
    expect(res.body.result).toHaveProperty('regretScore');
    expect(res.body.result).toHaveProperty('scenarios');
    expect(res.body.result).toHaveProperty('explanation');
    simulationId = res.body._id;
  });

  it('POST /api/simulations - EMI mode requires emiMonths', async () => {
    const res = await request(app)
      .post('/api/simulations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        purchase: {
          name: 'MacBook',
          price: 150000,
          mode: 'emi',
          // missing emiMonths and interestRate
        },
      });
    expect(res.status).toBe(422);
  });

  it('GET /api/simulations - lists simulations', async () => {
    const res = await request(app)
      .get('/api/simulations')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('simulations');
    expect(Array.isArray(res.body.simulations)).toBe(true);
  });

  it('GET /api/simulations/:id - gets simulation detail', async () => {
    const res = await request(app)
      .get(`/api/simulations/${simulationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(simulationId);
  });
});

describe('Feedback Routes (DEMO_MODE)', () => {
  it('POST /api/simulations/:id/feedback - submits feedback immediately in DEMO_MODE', async () => {
    const res = await request(app)
      .post(`/api/simulations/${simulationId}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ response: 'yes', note: 'I do regret it' });
    expect(res.status).toBe(200);
    expect(res.body.feedback.response).toBe('yes');
  });

  it('POST /api/simulations/:id/feedback - cannot submit feedback twice', async () => {
    const res = await request(app)
      .post(`/api/simulations/${simulationId}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ response: 'no' });
    expect(res.status).toBe(409);
  });
});

describe('Authorization', () => {
  it('GET /api/profile - 401 without token', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });

  it('GET /api/simulations - 401 without token', async () => {
    const res = await request(app).get('/api/simulations');
    expect(res.status).toBe(401);
  });
});
