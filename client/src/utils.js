import { useState, useEffect, useRef } from "react";

const DB_NAME = "TideDB";
const DB_VERSION = 1;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("userData")) {
        db.createObjectStore("userData", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("entries")) {
        const store = db.createObjectStore("entries", { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("userId", "userId", { unique: false });
      }
    };
  });
};

const saveToIndexedDB = async (storeName, data) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getFromIndexedDB = async (storeName, key) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getAllFromIndexedDB = async (storeName) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export { initDB, saveToIndexedDB, getFromIndexedDB, getAllFromIndexedDB };
