const customer = {
  ordersListener: null,
  trackListener: null,
  trackMap: null,
  trackMarker: null,

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
        ${order.status === 'in_transit' ? `<button class="btn btn-info btn-sm" onclick="customer.openTrackPage('${order.id}')">Live Track</button>` : ''}
      </div>
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

  openTrackPage(orderId) {
    if (this.trackListener) this.trackListener();
    if (this.trackMap) { this.trackMap.remove(); this.trackMap = null; }

    router.navigate('track', { orderId });

    setTimeout(() => this.initTrackMap(orderId), 200);
  },

  initTrackMap(orderId) {
    const mapEl = document.getElementById('trackMap');
    if (!mapEl) return;

    const map = L.map(mapEl, { zoomControl: true }).setView([0, 0], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([0, 0], {
      icon: L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      })
    }).addTo(map);

    this.trackMap = map;
    this.trackMarker = marker;

    this.trackListener = db.collection('orders').doc(orderId)
      .onSnapshot(doc => {
        const data = doc.data();
        if (!data) return;

        const statusLabels = {
          pending: 'Pending', accepted: 'Accepted', picked_up: 'Picked Up',
          in_transit: 'In Transit', delivered: 'Delivered', cancelled: 'Cancelled'
        };
        document.getElementById('trackOrderStatus').textContent = statusLabels[data.status] || data.status;
        document.getElementById('trackOrderStatus').className = 'status-badge status-' + data.status;

        document.getElementById('trackOrderInfo').innerHTML =
          `<strong>From:</strong> ${this.escHtml(data.pickup)}<br><strong>To:</strong> ${this.escHtml(data.dropoff)}`;

        document.getElementById('trackDriverInfo').innerHTML =
          data.traderName ? `<strong>Rider:</strong> ${this.escHtml(data.traderName)} ${data.traderPhone ? '- ' + this.escHtml(data.traderPhone) : ''}` : '';

        if (data.currentLocation) {
          const { lat, lng } = data.currentLocation;
          marker.setLatLng([lat, lng]);
          map.setView([lat, lng], 15);
        }
      });

    // Fix map rendering after becoming visible
    setTimeout(() => map.invalidateSize(), 300);
  }
};
