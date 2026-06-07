const customer = {
  ordersListener: null,
  mapInstances: {},

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
    const btn = document.querySelector('#orderForm .btn-primary');

    errEl.textContent = '';
    successEl.textContent = '';

    if (!pickup || !dropoff || !desc || !phone) {
      errEl.textContent = 'Please fill in all fields.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Placing order...';

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
      successEl.textContent = 'Order placed successfully!';
      document.getElementById('orderForm').reset();
      document.getElementById('customerOrders').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      errEl.textContent = auth.getFriendlyError(err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Place Order';
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

  formatTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
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
        <div>
          <h3 style="margin-bottom:0.25rem;">${this.escHtml(order.pickup)} → ${this.escHtml(order.dropoff)}</h3>
          <span style="font-size:0.8rem;color:#888;">${this.formatTime(order.createdAt)}</span>
        </div>
        <span class="status-badge status-${order.status}">${statusLabels[order.status] || order.status}</span>
      </div>
      <p style="margin-top:0.5rem;"><strong>Package:</strong> ${this.escHtml(order.packageDescription)}</p>
      <p><strong>Contact:</strong> ${this.escHtml(order.customerPhone)}</p>
      ${order.traderName ? `<p><strong>Rider:</strong> ${this.escHtml(order.traderName)}${order.traderPhone ? ' - ' + this.escHtml(order.traderPhone) : ''}</p>` : ''}
      ${order.acceptedAt ? `<p style="font-size:0.8rem;color:#888;">Accepted: ${this.formatTime(order.acceptedAt)}</p>` : ''}
      <div class="order-actions">
        ${order.status === 'pending' ? `<button class="btn btn-danger btn-sm" onclick="customer.cancelOrder('${order.id}')">Cancel</button>` : ''}
        ${order.status === 'in_transit' && order.currentLocation ? `<button class="btn btn-info btn-sm" onclick="customer.toggleMap('${order.id}')">${this.mapInstances[order.id] ? 'Hide Map' : 'Live Map'}</button>` : ''}
      </div>
      ${order.status === 'in_transit' ? `<div id="map-container-${order.id}" class="hidden" style="margin-top:0.75rem;"><div id="map-${order.id}" style="height:250px;border-radius:8px;"></div></div>` : ''}
    `;
    return card;
  },

  escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  async cancelOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      await db.collection('orders').doc(orderId).update({ status: 'cancelled' });
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  toggleMap(orderId) {
    const container = document.getElementById('map-container-' + orderId);
    if (!container) return;

    if (this.mapInstances[orderId]) {
      container.classList.add('hidden');
      this.mapInstances[orderId].unsubscribe();
      this.mapInstances[orderId].map.remove();
      delete this.mapInstances[orderId];
      return;
    }

    container.classList.remove('hidden');
    setTimeout(() => this.initMap(orderId), 100);
  },

  initMap(orderId) {
    const mapEl = document.getElementById('map-' + orderId);
    if (!mapEl || this.mapInstances[orderId]) return;

    const map = L.map(mapEl).setView([0, 0], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const marker = L.marker([0, 0]).addTo(map);

    const unsubscribe = db.collection('orders').doc(orderId)
      .onSnapshot(doc => {
        const data = doc.data();
        if (data && data.currentLocation) {
          const { lat, lng } = data.currentLocation;
          marker.setLatLng([lat, lng]);
          map.setView([lat, lng], 15);
        }
      });

    this.mapInstances[orderId] = { map, marker, unsubscribe };
  }
};
