import React, { useState, useEffect } from 'react';
import './index.css';

const API_URL = 'http://localhost:3001/api';

function App() {
  const [foods, setFoods] = useState([]);
  const [requests, setRequests] = useState([]);
  const [currentUser, setCurrentUser] = useState('Alice'); // Mock user identity
  const [errorMsg, setErrorMsg] = useState('');

  const fetchState = async () => {
    try {
      const resFoods = await fetch(`${API_URL}/foods`);
      const dataFoods = await resFoods.json();
      setFoods(dataFoods);

      const resRequests = await fetch(`${API_URL}/requests`);
      const dataRequests = await resRequests.json();
      setRequests(dataRequests);
      setErrorMsg('');
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to connect to the server');
    }
  };

  useEffect(() => {
    fetchState();
    // basic polling for demo purposes regarding expiration
    const interval = setInterval(fetchState, 5000); 
    return () => clearInterval(interval);
  }, []);

  const handleAddFood = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get('name'),
      totalQuantity: fd.get('quantity'),
      owner: currentUser
    };

    const res = await fetch(`${API_URL}/foods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      e.target.reset();
      fetchState();
    }
  };

  const handleAdjustInventory = async (foodId, action, valueStr) => {
    const value = Number(valueStr);
    const res = await fetch(`${API_URL}/foods/${foodId}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, value })
    });
    if (!res.ok) {
      const data = await res.json();
      setErrorMsg(data.error || 'Failed to adjust inventory');
    }
    fetchState();
  };

  const handleRequestPortion = async (e, foodId) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      foodItemId: foodId,
      requester: currentUser,
      quantity: fd.get('reqQuantity')
    };
    
    const res = await fetch(`${API_URL}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json();
      setErrorMsg(data.error);
    } else {
      e.target.reset();
      setErrorMsg('');
    }
    fetchState();
  };

  const handleApprove = async (reqId) => {
    // 1-minute expiration for quick prototype testing
    const res = await fetch(`${API_URL}/requests/${reqId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expirationMinutes: 1 }) 
    });
    
    if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Approval failed (Possible concurrency collision)');
    }
    fetchState();
  };

  const handleConsume = async (reqId) => {
    const res = await fetch(`${API_URL}/requests/${reqId}/consume`, { method: 'POST' });
    if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error);
    }
    fetchState();
  };

  const handleExpire = async (reqId) => {
    const res = await fetch(`${API_URL}/requests/${reqId}/expire`, { method: 'POST' });
    if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error);
    }
    fetchState();
  };

  return (
    <div>
      <h1 className="title">FridgePolice 🚔</h1>
      
      <div className="glass-panel flex-between">
        <div>
          <span className="text-muted">Current User:</span> 
          <select value={currentUser} onChange={e => setCurrentUser(e.target.value)} style={{marginLeft: '10px'}}>
            <option value="Alice">Alice (Owner of most)</option>
            <option value="Bob">Bob (Roommate 1)</option>
            <option value="Charlie">Charlie (Roommate 2)</option>
          </select>
        </div>
        {errorMsg && <div style={{color: 'var(--danger)', fontWeight: 'bold'}}>{errorMsg}</div>}
      </div>

      <div className="grid">
        <div className="glass-panel flex-col">
          <h3>➕ Add Food</h3>
          <form onSubmit={handleAddFood} className="flex-col">
            <input name="name" placeholder="Food Name (e.g., Milk)" required />
            <input name="quantity" type="number" placeholder="Total Quantity e.g. 100(%)" required min="1" />
            <button type="submit" className="btn btn-success">Add to Fridge</button>
          </form>
        </div>
      </div>

      <h2>Available Food Inventory</h2>
      <div className="grid">
        {foods.filter(f => f.status === 'active').map(food => {
          const percent = (food.availableQuantity / food.totalQuantity) * 100;
          return (
            <div key={food.id} className="glass-panel food-card">
              <div>
                <div className="flex-between">
                  <h3 style={{marginBottom: 0}}>{food.name} <span style={{fontSize:'0.6em', color: '#888'}}>({food.id.slice(0,5)})</span></h3>
                  <span className="badge badge-pending">Owner: {food.owner}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width: `${percent}%`}}></div>
                </div>
                <p className="text-muted" style={{marginTop: '0.5rem'}}>
                  Available: {food.availableQuantity} / {food.totalQuantity}
                </p>
              </div>

              <div style={{marginTop: '1.5rem'}} className="flex-col">
                {currentUser !== food.owner && (
                  <form onSubmit={(e) => handleRequestPortion(e, food.id)} className="flex-row">
                    <input name="reqQuantity" type="number" placeholder="Req Qty" max={food.availableQuantity} min="1" required style={{flex: 1}} />
                    <button type="submit" className="btn">Request</button>
                  </form>
                )}

                {currentUser === food.owner && (
                  <div className="flex-row" style={{background: 'rgba(0,0,0,0.2)', padding:'0.5rem', borderRadius: '8px'}}>
                    <span className="text-muted" style={{fontSize: '0.8rem'}}>Adjust:</span>
                    <button className="btn btn-outline" onClick={() => handleAdjustInventory(food.id, 'reduce', prompt('Reduce quantity by:'))}>Reduce</button>
                    <button className="btn btn-danger" onClick={() => handleAdjustInventory(food.id, 'discard', null)}>Discard</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h2 style={{marginTop: '2rem'}}>Requests View</h2>
      <div className="glass-panel">
        {requests.length === 0 && <p className="text-muted">No requests yet.</p>}
        {requests.map(req => {
            const food = foods.find(f => f.id === req.foodItemId);
            const foodName = food ? food.name : 'Unknown Item';
            const owner = food ? food.owner : '';

            return (
              <div key={req.id} className="request-item flex-between">
                <div>
                  <strong>{req.requester}</strong> requested <strong>{req.quantity} units</strong> of {foodName}
                  <div style={{marginTop: '0.5rem'}}>
                    <span className={`badge badge-${req.status}`}>{req.status}</span>
                    {req.status === 'approved' && req.expiresAt && (
                      <span className="text-muted" style={{marginLeft: '10px'}}>
                        Expires: {new Date(req.expiresAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-row">
                  {req.status === 'pending' && currentUser === owner && (
                    <button className="btn btn-success" onClick={() => handleApprove(req.id)}>Approve</button>
                  )}
                  {req.status === 'approved' && currentUser === req.requester && (
                    <button className="btn" onClick={() => handleConsume(req.id)}>Consume (Done)</button>
                  )}
                  {req.status === 'approved' && currentUser === owner && (
                    <button className="btn btn-danger" onClick={() => handleExpire(req.id)}>Force Expire</button>
                  )}
                </div>
              </div>
            )
        })}
      </div>
    </div>
  );
}

export default App;
