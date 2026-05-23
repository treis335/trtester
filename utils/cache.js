// utils/cache.js
class Cache {
  constructor(ttlMs = 2000) {
    this.ttl = ttlMs;
    this.store = new Map();
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > this.ttl) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value) {
    this.store.set(key, { value, timestamp: Date.now() });
  }

  clear() {
    this.store.clear();
  }
}

module.exports = Cache;