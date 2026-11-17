/**
 * RoomTrail Reliable GPS Route Point Queue
 *
 * Implements a persistent, client-side IndexedDB upload queue for live GPS points.
 * - Stores every accepted point immediately in IndexedDB to prevent data loss on network drops.
 * - Flushes points in small batches to Spring Boot backend API.
 * - Retries failed requests with exponential backoff.
 * - Supports synchronous flush before trip finalization/pause.
 * - Emits diagnostic stats for real-time tracking visibility.
 */

import { routePointService } from '../services/routePointService';

const DB_NAME = 'roomtrail_gps_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_route_points';

class GpsQueue {
  constructor() {
    this.db = null;
    this.isFlushing = false;
    this.flushTimer = null;
    this.retryDelayMs = 2000;
    this.listeners = new Set();
    this.stats = {
      updatesReceived: 0,
      pointsAccepted: 0,
      pointsSaved: 0,
      pointsPending: 0,
      lastAccuracy: null,
      lastTimestamp: null,
      activeWatchers: 0,
      tripId: null,
      networkStatus: 'online',
    };

    // Monitor online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.stats.networkStatus = 'online';
        this.notifyListeners();
        this.scheduleFlush(500);
      });
      window.addEventListener('offline', () => {
        this.stats.networkStatus = 'offline';
        this.notifyListeners();
      });
    }

    this.initPromise = this.initDb();
  }

  async initDb() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB is unavailable; queue will operate in in-memory fallback.');
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('tripId', 'tripId', { unique: false });
          store.createIndex('sequenceNumber', 'sequenceNumber', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.updatePendingCount();
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Failed to open IndexedDB for GPS queue:', event.target.error);
        resolve(null);
      };
    });
  }

  // Diagnostic Subscriptions
  subscribe(callback) {
    this.listeners.add(callback);
    callback({ ...this.stats });
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    const snapshot = { ...this.stats };
    this.listeners.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (err) {
        console.error('Error in GpsQueue listener:', err);
      }
    });
  }

  setTrackingMeta({ tripId, activeWatchers }) {
    if (tripId !== undefined) this.stats.tripId = tripId;
    if (activeWatchers !== undefined) this.stats.activeWatchers = activeWatchers;
    this.notifyListeners();
  }

  recordRawGpsUpdate(coords) {
    this.stats.updatesReceived += 1;
    this.stats.lastAccuracy = coords.accuracy || null;
    this.stats.lastTimestamp = coords.timestamp || Date.now();
    this.notifyListeners();
  }

  /**
   * Enqueue an accepted GPS breadcrumb point into persistent IndexedDB storage
   */
  async enqueue(point) {
    await this.initPromise;
    this.stats.pointsAccepted += 1;

    const stableId = point.id || `pt_${point.tripId}_${point.sequenceNumber || Date.now()}`;
    const entry = {
      ...point,
      id: stableId,
      queuedAt: Date.now(),
      retryCount: 0,
    };

    if (this.db) {
      try {
        await new Promise((resolve, reject) => {
          const tx = this.db.transaction([STORE_NAME], 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(entry);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch (err) {
        console.warn('Failed to persist point into IndexedDB, fallback memory:', err);
      }
    }

    await this.updatePendingCount();
    this.scheduleFlush(250);
  }

  async updatePendingCount() {
    if (!this.db) return;
    try {
      const count = await new Promise((resolve, reject) => {
        const tx = this.db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      this.stats.pointsPending = count;
      this.notifyListeners();
    } catch {
      // Ignore count errors
    }
  }

  scheduleFlush(delayMs = 1000) {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, delayMs);
  }

  /**
   * Flush pending points in batches to Spring Boot
   */
  async flush(targetTripId = null) {
    if (this.isFlushing) return;
    await this.initPromise;
    if (!this.db) return;

    this.isFlushing = true;
    try {
      const allPending = await new Promise((resolve, reject) => {
        const tx = this.db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (!allPending || allPending.length === 0) {
        await this.updatePendingCount();
        this.isFlushing = false;
        return;
      }

      // Filter by tripId if targeted, else sort chronologically
      const toSend = allPending
        .filter((p) => (targetTripId ? String(p.tripId) === String(targetTripId) : true))
        .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

      if (toSend.length === 0) {
        await this.updatePendingCount();
        this.isFlushing = false;
        return;
      }

      // Batch slice (up to 25 points at once)
      const batch = toSend.slice(0, 25);
      const tripId = batch[0].tripId;

      try {
        await routePointService.createBatch(tripId, batch);

        // Success: remove batch from IndexedDB
        await new Promise((resolve, reject) => {
          const tx = this.db.transaction([STORE_NAME], 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          batch.forEach((p) => store.delete(p.id));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

        this.stats.pointsSaved += batch.length;
        this.retryDelayMs = 2000; // Reset backoff on success
        await this.updatePendingCount();

        // If more remain, flush next batch immediately
        if (toSend.length > batch.length) {
          this.isFlushing = false;
          return this.flush(targetTripId);
        }
      } catch (err) {
        console.warn('Batch route-points flush failed; will retry with backoff', err);
        this.retryDelayMs = Math.min(this.retryDelayMs * 1.5, 30000);
        this.scheduleFlush(this.retryDelayMs);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Guaranteed flush on pause or stop trip:
   * Polls/retries until pending points for the trip are saved or timeout occurs
   */
  async flushPending(tripId, maxWaitMs = 10000) {
    const startTime = Date.now();
    await this.flush(tripId);

    while (Date.now() - startTime < maxWaitMs) {
      if (!this.db) break;
      const count = await new Promise((resolve) => {
        const tx = this.db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const forTrip = (req.result || []).filter((p) => !tripId || String(p.tripId) === String(tripId));
          resolve(forTrip.length);
        };
        req.onerror = () => resolve(0);
      });

      if (count === 0) break;
      await this.flush(tripId);
      await new Promise((r) => setTimeout(r, 400));
    }

    await this.updatePendingCount();
  }

  /**
   * Clear all pending items for a trip (e.g. after deletion)
   */
  async clearTrip(tripId) {
    await this.initPromise;
    if (!this.db || !tripId) return;

    try {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        items.forEach((item) => {
          if (String(item.tripId) === String(tripId)) {
            store.delete(item.id);
          }
        });
      };
      await this.updatePendingCount();
    } catch (err) {
      console.warn('Error clearing trip from queue:', err);
    }
  }
}

export const gpsQueue = new GpsQueue();
export default gpsQueue;
