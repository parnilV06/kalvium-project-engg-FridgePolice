const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// IN-MEMORY DATA STORES
let foods = [];
let requests = [];

// ==========================================
// SCENARIO 2: SPOILAGE / STALE STATE HANDLER
// ==========================================
// We'll define a helper to manually or implicitly expire requests.
// A request is "expired" if current time > expiresAt and status is "approved".
const checkExpirations = () => {
    const now = new Date();
    requests.forEach(req => {
        if (req.status === 'approved' && req.expiresAt && new Date(req.expiresAt) < now) {
            req.status = 'expired';
            // Return quantity to available pool
            const food = foods.find(f => f.id === req.foodItemId);
            if (food) {
                food.availableQuantity += req.quantity;
            }
        }
    });
};

// Middleware to implicitly check expirations on every request 
// (ensures stale state is not served).
app.use((req, res, next) => {
    checkExpirations();
    next();
});

// ==========================================
// API ENDPOINTS
// ==========================================

// --- FOODS REST ---

// Get all foods
app.get('/api/foods', (req, res) => {
    res.json(foods);
});

// Add a new food item (Scenario 3: Identical items handled securely via UUID)
app.post('/api/foods', (req, res) => {
    const { name, totalQuantity, owner } = req.body;
    
    if (!name || !totalQuantity || !owner) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    const newFood = {
        id: uuidv4(),
        name,
        totalQuantity: Number(totalQuantity),
        availableQuantity: Number(totalQuantity),
        owner,
        createdAt: new Date().toISOString(),
        status: 'active'
    };
    
    foods.push(newFood);
    res.status(201).json(newFood);
});

// Scenario 4: Reality Desync (Manual Correction)
app.post('/api/foods/:id/adjust', (req, res) => {
    const { id } = req.params;
    const { action, value } = req.body; // action: 'reduce' or 'discard'
    
    const foodItem = foods.find(f => f.id === id);
    if (!foodItem) return res.status(404).json({ error: 'Food not found' });

    if (action === 'discard') {
        foodItem.status = 'discarded';
        foodItem.availableQuantity = 0;
    } else if (action === 'reduce') {
        const reduceBy = Number(value);
        if (reduceBy < 0 || reduceBy > foodItem.availableQuantity) {
            return res.status(400).json({ error: 'Invalid reduction amount' });
        }
        // Adjust both total and available based on physical reality
        foodItem.availableQuantity -= reduceBy;
        foodItem.totalQuantity -= reduceBy; 
    } else {
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.json(foodItem);
});


// --- REQUESTS REST ---

// Get all requests
app.get('/api/requests', (req, res) => {
    res.json(requests);
});

// Create a new request for a portion
app.post('/api/requests', (req, res) => {
    const { foodItemId, requester, quantity } = req.body;

    const food = foods.find(f => f.id === foodItemId);
    if (!food) return res.status(404).json({ error: 'Food not found' });

    if (quantity > food.availableQuantity) {
        return res.status(400).json({ error: 'Requested quantity exceeds available quantity.' });
    }

    const newRequest = {
        id: uuidv4(),
        foodItemId,
        requester,
        quantity: Number(quantity),
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: null // Only set when approved
    };

    requests.push(newRequest);
    res.status(201).json(newRequest);
});

// Scenario 1: Concurrency Collision (Approval Logic)
app.post('/api/requests/:id/approve', (req, res) => {
    const { id } = req.params;
    const { expirationMinutes } = req.body; // Allow owner to specify how long they have

    const request = requests.find(r => r.id === id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be approved.' });

    const foodItem = foods.find(f => f.id === request.foodItemId);
    if (!foodItem) return res.status(404).json({ error: 'Associated food not found' });

    // ATOMIC VALIDATION: Re-check available quantity AT approval time
    if (request.quantity > foodItem.availableQuantity) {
        request.status = 'cancelled'; // Or rejected
        return res.status(409).json({ error: 'Concurrency collision: Insufficient quantity left. Request rejected.' });
    }

    // Safe Update
    foodItem.availableQuantity -= request.quantity;
    request.status = 'approved';
    
    // Set expiration
    const expiryMins = expirationMinutes || 24 * 60; // default 24 hrs
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + Number(expiryMins));
    request.expiresAt = expiresAt.toISOString();

    res.json(request);
});

// Consume the portion (Finalize the request)
app.post('/api/requests/:id/consume', (req, res) => {
    const { id } = req.params;
    
    const request = requests.find(r => r.id === id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (request.status !== 'approved') {
        return res.status(400).json({ error: 'Only approved (and non-expired) requests can be consumed.' });
    }

    request.status = 'consumed';
    res.json(request);
});

// Manual trigger to expire (For immediate testing or if owner revokes an expired request)
app.post('/api/requests/:id/expire', (req, res) => {
    const { id } = req.params;
    
    const request = requests.find(r => r.id === id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (request.status !== 'approved') {
        return res.status(400).json({ error: 'Only approved requests can be expired.' });
    }

    request.status = 'expired';
    const foodItem = foods.find(f => f.id === request.foodItemId);
    if (foodItem) {
        foodItem.availableQuantity += request.quantity;
    }

    res.json(request);
});

// Fallback logic for dropping all data (Helpful for test resets during frontend dev)
app.post('/api/reset', (req, res) => {
    foods = [];
    requests = [];
    res.json({ message: 'System reset' });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`FridgePolice Backend listening on port ${PORT}`);
});
