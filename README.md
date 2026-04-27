# FridgePolice 🚔

FridgePolice is a roommate food tracking prototype app designed to handle messy real-world scenarios realistically.

## Setup Instructions

This project consists of an Express Node.js backend (`/server`) and a React Vite frontend (`/client`).

1. **Start the Backend Server**
   - Open a terminal and navigate to the `server` directory:
     ```bash
     cd server
     npm install
     npm start
     ```
   - The backend runs on `http://localhost:3001`

2. **Start the Frontend App**
   - Open a separate terminal and navigate to the `client` directory:
     ```bash
     cd client
     npm install
     npm run dev
     ```
   - The frontend should be accessible locally, typically at `http://localhost:5173`. 
   *(Check your terminal for the exact Vite localhost address)*

## Testing the 4 Critical Scenarios

### 1. Concurrency Collision
- Create a food item (e.g. Milk, 100 units).
- Switch user to "Bob". Request 100 units.
- Switch user to "Charlie". Request 100 units.
- Switch user to "Alice". Try to approve BOTH requests. 
- *Expected*: The first approval succeeds. The second returns a Concurrency Collision error because the backend checks `availableQuantity` dynamically.

### 2. Spoilage / Stale State
- Approve a request for Bob.
- Notice the UI shows it expires in 1 minute.
- Wait > 1 minute, the app gracefully auto-fetches and moves the request to `Expired`, automatically refunding the `availableQuantity` to the item.
- Or click "Force Expire" as owner immediately to see it.

### 3. Identical Items (Identity)
- Create two food items named exactly "Ketchup" with Alice.
- *Expected*: Both show up distinctly, tracked by unique backend UUIDs (visualized as a 5-char slug next to names). Requests to one do not affect the other.

### 4. Reality Desync (Manual Correction)
- Someone ate half of the Milk without telling the app.
- As Alice (the owner), find the adjust UI under the food component.
- Click "Reduce" and type how much is missing, or click "Discard".
- *Expected*: Values update immediately reflecting reality, preventing over-requesting moving forward.

Kalium Project Enggnering track - Milestone 2 | Challenge 8 - Submission 
