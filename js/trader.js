const trader = {
  pendingListener: null,
  activeListener: null,
  locationWatcher: null,
  locationOrderId: null,
  currentTab: 'pending',
  acceptingSet: new Set(),

  init() {
    this.listenPending();
    this.listenActive();
  },

  escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  formatTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('[id^="tab-"]').forEach(t => t.classList.add('hidden'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
  },

  listenPending() {
    if (this.pendingListener) this.pendingListener();
    this.pendingListener = db.collection('orders')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        const container = document.getElementById('pendingOrders');
        const noOrders = document.getElementById('pendingNoOrders');
        container.innerHTML = '';

        if (snapshot.empty) {
          noOrders.classList.remove('hidden');
          return;
        }
        noOrders.classList.add('hidden');

        snapshot.forEach(doc => {
          const order = { id: doc.id, ...doc.data() };
          container.appendChild(this.renderPendingCard(order));
        });
      }, err => {
        console.error('Pending listener error:', err);
      });
  },

  listenActive() {
    if (this.activeListener) this.activeListener();
    const user = auth.currentUser;
    if (!user) return;

    this.activeListener = db.collection('orders')
      .where('traderId', '==', user.uid)
      .where('status', 'in', ['accepted', 'picked_up', 'in_transit'])
      .onSnapshot(snapshot => {
        const container = document.getElementById('activeOrders');
        const noOrders = document.getElementById('activeNoOrders');
        container.innerHTML = '';

        if (snapshot.empty) {
          noOrders.classList.remove('hidden');
          return;
        }
        noOrders.classList.add('hidden');

        snapshot.forEach(doc => {
          const order = { id: doc.id, ...doc.data() };
          container.appendChild(this.renderActiveCard(order));
        });

        this.loadHistory();
      }, err => {
        console.error('Active listener error:', err);
      });
  },

  async loadHistory() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const snap = await db.collection('orders')
        .where('traderId', '==', user.uid)
        .where('status', '==', 'delivered')
        .orderBy('createdAt', 'desc')
        .get();

      const container = document.getElementById('historyOrders');
      const noOrders = document.getElementById('historyNoOrders');
      container.innerHTML = '';

      if (snap.empty) {
        noOrders.classList.remove('hidden');
        return;
      }
      noOrders.classList.add('hidden');

      snap.forEach(doc => {
        const order = { id: doc.id, ...doc.data() };
        container.appendChild(this.renderActiveCard(order));
      });
    } catch (err) {
      console.error('History load error:', err);
    }
  },

  renderPendingCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card pending';

    card.innerHTML = `
      <h3>${this.escHtml(order.pickup)} → ${this.escHtml(order.dropoff)}</h3>
      <p style="font-size:0.8rem;color:#888;margin-bottom:0.5rem;">${this.formatTime(order.createdAt)}</p>
      <p><strong>Package:</strong> ${this.escHtml(order.packageDescription)}</p>
      <p><strong>Contact:</strong> ${this.escHtml(order.customerPhone)}</p>
      <p><strong>Customer:</strong> ${this.escHtml(order.customerName)}</p>
      <div class="order-actions">
        <button class="btn btn-success btn-sm" onclick="trader.acceptOrder('${order.id}', this)" ${this.acceptingSet.has(order.id) ? 'disabled' : ''}>
          ${this.acceptingSet.has(order.id) ? 'Accepting...' : 'Accept'}
        </button>
      </div>
    `;
    return card;
  },

  renderActiveCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card ' + (order.status || '');

    const statusLabels = {
      accepted: 'Accepted',
      picked_up: 'Picked Up',
      in_transit: 'In Transit',
      delivered: 'Delivered'
    };

    const nextStatus = {
      accepted: 'picked_up',
      picked_up: 'in_transit',
      in_transit: 'delivered'
    };

    const nextLabel = {
      accepted: 'Mark Picked Up',
      picked_up: 'Mark In Transit',
      in_transit: 'Mark Delivered'
    };

    const isSharing = this.locationWatcher && this.locationOrderId === order.id;

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div>
          <h3 style="margin-bottom:0.25rem;">${this.escHtml(order.pickup)} → ${this.escHtml(order.dropoff)}</h3>
          <span style="font-size:0.8rem;color:#888;">${this.formatTime(order.createdAt)}</span>
        </div>
        <span class="status-badge status-${order.status}">${statusLabels[order.status] || order.status}</span>
      </div>
      <p style="margin-top:0.5rem;"><strong>Package:</strong> ${this.escHtml(order.packageDescription)}</p>
      <p><strong>Customer:</strong> ${this.escHtml(order.customerName)} - ${this.escHtml(order.customerPhone)}</p>
      ${order.acceptedAt ? `<p style="font-size:0.8rem;color:#888;">Accepted: ${this.formatTime(order.acceptedAt)}</p>` : ''}
      <div class="order-actions">
        ${nextStatus[order.status] ? `<button class="btn btn-primary btn-sm" onclick="trader.updateStatus('${order.id}', '${nextStatus[order.status]}', this)">${nextLabel[order.status]}</button>` : ''}
        ${order.status === 'in_transit' && !isSharing ? `<button class="btn btn-info btn-sm" onclick="trader.startSharingLocation('${order.id}')">Share Location</button>` : ''}
        ${order.status === 'in_transit' && isSharing ? `<button class="btn btn-danger btn-sm" onclick="trader.stopSharingLocation()">Stop Sharing</button><span style="font-size:0.75rem;color:#10b981;margin-left:0.5rem;">● Live</span>` : ''}
      </div>
    `;
    return card;
  },

  async acceptOrder(orderId, btn) {
    const user = auth.currentUser;
    if (!user || this.acceptingSet.has(orderId)) return;

    this.acceptingSet.add(orderId);
    if (btn) { btn.disabled = true; btn.textContent = 'Accepting...'; }

    try {
      await db.runTransaction(async transaction => {
        const ref = db.collection('orders').doc(orderId);
        const doc = await transaction.get(ref);
        if (!doc.exists) throw new Error('Order not found.');
        if (doc.data().status !== 'pending') throw new Error('This order was just accepted by another trader.');

        transaction.update(ref, {
          status: 'accepted',
          traderId: user.uid,
          traderName: user.name,
          traderPhone: user.phone,
          acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    } catch (err) {
      alert(err.message);
    } finally {
      this.acceptingSet.delete(orderId);
    }
  },

  async updateStatus(orderId, newStatus, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }
    try {
      await db.collection('orders').doc(orderId).update({ status: newStatus });
    } catch (err) {
      alert('Error updating status: ' + err.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Retry'; }
    }
  },

  startSharingLocation(orderId) {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    this.locationOrderId = orderId;

    this.locationWatcher = navigator.geolocation.watchPosition(
      async position => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          await db.collection('orders').doc(orderId).update({
            currentLocation: { lat, lng }
          });
        } catch (err) {
          console.error('Location update error:', err);
        }
      },
      err => {
        console.error('Geolocation error:', err);
        alert('Could not access location: ' + err.message);
        this.stopSharingLocation();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  },

  stopSharingLocation() {
    if (this.locationWatcher) {
      navigator.geolocation.clearWatch(this.locationWatcher);
      this.locationWatcher = null;
    }
    this.locationOrderId = null;
  }
};
