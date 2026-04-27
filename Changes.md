# Changes & Engineering Decisions 

Here is everything about how FridgePolice satisfies the brief.

## What the App Does
FridgePolice simulates a roommate environment: users can add food indicating they own it, and other users can ask for portions. The app aims to resolve common friction points: race conditions, ghosting on requests, overlapping naming, and reality drift.

## Approach to Scenarios

1. **Concurrency Control Logic** 
   - **Frontend**: Prevents requesting more than currently available.
   - **Backend**: Implements "Late Evaluation Validation" inside the `/api/requests/:id/approve` endpoint. Before updating state, the backend cross-references the targeted `FoodItem.availableQuantity`. Even if the frontend thought sufficient portions remained, the backend strictly rejects double-allocation.

2. **Expiration / Stale Handling**
   - **Mechanic**: Approvals aren't permanent. They are granted with an `expiresAt` timestamp (defaulted to 1 minute for demo prototype purposes). 
   - **Cron-less check**: Rather than spinning a costly `setInterval` loop in Node, we appended a middleware on *every* request `checkExpirations()`. It proactively invalidates stale requests before returning state, returning expired quantities implicitly.

3. **Identity Handling**
   - **No String Match**: The app uses `uuidv4()` generated identifiers to track items and request ownership chains. A user can add 5 "Eggs" and the app treats each as a distinct object.

4. **Manual Correction Handling**
   - **Adjust API**: An `adjust` endpoint exists letting owners manually dock points (if they consumed some and forgot to record) or declare reality "Discarded", immediately restricting future requests against the discrepancy.

## Key Engineering Decisions
- **In-Memory Store**: As requested, a JS-native array mapping architecture is used.
- **Polling (Frontend)**: To emulate push-websockets on expiring data without architectural bloat, the frontend implements a lightweight 5-second polling loop against the APIs. If an item spoils server-side, it natively updates via UI.
- **Mock User Context**: Instead of complex JWT auth for a prototype, a `<select>` dropdown simulates active users shifting state visually without logging out.

## Assumptions Made
- The server will stay alive. If it restarts, all Array data resets.
- We assume all participants using the app are "good actors" utilizing the application properly (mock select role switching implies an honor code implementation).
- Since it's a prototype, the concept of "volume" vs "count" vs "percentage" is abstracted as a generic `totalQuantity` integer.

## Trade-offs
- **No Persistence**: Rebooting process deletes database.
- **Simple Error Handling**: Throws raw error JSON to UI instead of complex toasts.
- **Broadcasting Mechanism**: The HTTP-polling approach is sufficient for `<100` DAU prototypes, but wouldn't securely scale over websockets on production.
