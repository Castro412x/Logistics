const trader = {
  pendingListener: null,
  activeListener: null,
  locationWatcher: null,
  currentTab: 'pending',

  init() {
    this.listenPending();
    this.listenActive();
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

        // Refresh history too
        this.loadHistory();
      }, err => {
        console.error('Active listener error:', err);
      });
  },

  async loadHistory() {
    const user = auth.currentUser;
    if (!user) return;

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
  },

  renderPendingCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card pending';

    card.innerHTML = `
      <h3>${order.pickup} → ${order.dropoff}</h3>
      <p><strong>Package:</strong> ${order.packageDescription}</p>
      <p><strong>Contact:</strong> ${order.customerPhone}</p>
      <p><strong>Customer:</strong> ${order.customerName}</p>
      <div class="order-actions">
        <button class="btn btn-success btn-sm" onclick="trader.acceptOrder('${order.id}')">Accept</button>
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

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <h3>${order.pickup} → ${order.dropoff}</h3>
        <span class="status-badge status-${order.status}">${statusLabels[order.status] || order.status}</span>
      </div>
      <p><strong>Package:</strong> ${order.packageDescription}</p>
      <p><strong>Customer:</strong> ${order.customerName} - ${order.customerPhone}</p>
      <div class="order-actions">
        ${nextStatus[order.status] ? `<button class="btn btn-primary btn-sm" onclick="trader.updateStatus('${order.id}', '${nextStatus[order.status]}')">${nextLabel[order.status]}</button>` : ''}
        ${order.status === 'in_transit' && !this.locationWatcher ? `<button class="btn btn-info btn-sm" onclick="trader.startSharingLocation('${order.id}')">Share Location</button>` : ''}
        ${order.status === 'in_transit' && this.locationWatcher ? `<button class="btn btn-danger btn-sm" onclick="trader.stopSharingLocation()">Stop Sharing</button>` : ''}
      </div>
    `;
    return card;
  },

  async acceptOrder(orderId) {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await db.runTransaction(async transaction => {
        const ref = db.collection('orders').doc(orderId);
        const doc = await transaction.get(ref);
        if (!doc.exists) throw new Error('Order not found.');
        if (doc.data().status !== 'pending') throw new Error('Order already accepted by another trader.');

        transaction.update(ref, {
          status: 'accepted',
          traderId: user.uid,
          traderName: user.name,
          traderPhone: user.phone,
          acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    } catch (err) {
      alert('Could not accept order: ' + err.message);
    }
  },

  async updateStatus(orderId, newStatus) {
    try {
      await db.collection('orders').doc(orderId).update({ status: newStatus });
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  },

  startSharingLocation(orderId) {
    if (!navigator.geolocation) {
      alert('Geolocation not supported.');
      return;
    }

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
        alert('Could not get location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  },

  stopSharingLocation() {
    if (this.locationWatcher) {
      navigator.geolocation.clearWatch(this.locationWatcher);
      this.locationWatcher = null;
    }
  }
};
