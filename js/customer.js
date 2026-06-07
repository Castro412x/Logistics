const customer = {
  ordersListener: null,
  map: null,
  marker: null,

  init() {
    this.listenToOrders();
    document.getElementById('orderForm').onsubmit = (e) => this.createOrder(e);
  },

  async createOrder(e) {
    e.preventDefault();
    const user = auth.currentUser;
    const pickup = document.getElementById('pickupAddr').value.trim();
    const dropoff = document.getElementById('dropoffAddr').value.trim();
    const desc = document.getElementById('pkgDesc').value.trim();
    const phone = document.getElementById('contactPhone').value.trim();
    const errEl = document.getElementById('orderError');
    const successEl = document.getElementById('orderSuccess');

    errEl.textContent = '';
    successEl.textContent = '';

    if (!pickup || !dropoff || !desc || !phone) {
      errEl.textContent = 'Please fill in all fields.';
      return;
    }

    try {
      await db.collection('orders').add({
        customerId: user.uid,
        customerName: user.name,
        customerPhone: phone,
        pickup,
        dropoff,
        packageDescription: desc,
        status: 'pending',
        traderId: null,
        traderName: null,
        traderPhone: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        acceptedAt: null,
        currentLocation: null
      });
      successEl.textContent = 'Order placed!';
      document.getElementById('orderForm').reset();
    } catch (err) {
      errEl.textContent = err.message;
    }
  },

  listenToOrders() {
    if (this.ordersListener) this.ordersListener();
    const user = auth.currentUser;
    if (!user) return;

    this.ordersListener = db.collection('orders')
      .where('customerId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        const container = document.getElementById('customerOrders');
        const noOrders = document.getElementById('customerNoOrders');
        container.innerHTML = '';

        if (snapshot.empty) {
          noOrders.classList.remove('hidden');
          return;
        }
        noOrders.classList.add('hidden');

        snapshot.forEach(doc => {
          const order = { id: doc.id, ...doc.data() };
          container.appendChild(this.renderOrderCard(order));
        });
      }, err => {
        console.error('Orders listener error:', err);
      });
  },

  renderOrderCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card ' + (order.status || 'pending');

    const statusLabels = {
      pending: 'Pending',
      accepted: 'Accepted',
      picked_up: 'Picked Up',
      in_transit: 'In Transit',
      delivered: 'Delivered',
      cancelled: 'Cancelled'
    };

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <h3>${order.pickup} → ${order.dropoff}</h3>
        <span class="status-badge status-${order.status}">${statusLabels[order.status] || order.status}</span>
      </div>
      <p><strong>Package:</strong> ${order.packageDescription}</p>
      <p><strong>Contact:</strong> ${order.customerPhone}</p>
      ${order.traderName ? `<p><strong>Rider:</strong> ${order.traderName} ${order.traderPhone ? ' - ' + order.traderPhone : ''}</p>` : ''}
      <div class="order-actions">
        ${order.status === 'pending' ? `<button class="btn btn-danger btn-sm" onclick="customer.cancelOrder('${order.id}')">Cancel</button>` : ''}
        ${order.status === 'in_transit' && order.currentLocation ? `<button class="btn btn-info btn-sm" onclick="customer.showMap('${order.id}')">Live Map</button>` : ''}
      </div>
      ${order.status === 'in_transit' ? `<div id="map-container-${order.id}" class="hidden"><div id="map-${order.id}" style="height:250px;border-radius:8px;margin-top:0.5rem;"></div></div>` : ''}
    `;
    return card;
  },

  async cancelOrder(orderId) {
    if (!confirm('Cancel this order?')) return;
    try {
      await db.collection('orders').doc(orderId).update({ status: 'cancelled' });
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  showMap(orderId) {
    const container = document.getElementById('map-container-' + orderId);
    if (!container) return;
    const isHidden = container.classList.contains('hidden');
    container.classList.toggle('hidden');

    if (isHidden) {
      setTimeout(() => {
        const mapEl = document.getElementById('map-' + orderId);
        const map = L.map(mapEl).setView([0, 0], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);
        const marker = L.marker([0, 0]).addTo(map);

        const unsubscribe = db.collection('orders').doc(orderId)
          .onSnapshot(doc => {
            const data = doc.data();
            if (data.currentLocation) {
              const { lat, lng } = data.currentLocation;
              marker.setLatLng([lat, lng]);
              map.setView([lat, lng], 15);
            }
          });
        map._unsubscribe = unsubscribe;
      }, 100);
    } else {
      const mapEl = document.getElementById('map-' + orderId);
      if (mapEl && mapEl._unsubscribe) mapEl._unsubscribe();
    }
  }
};
