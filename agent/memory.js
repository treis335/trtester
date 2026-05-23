// agent/memory.js
const fs = require('fs');
const config = require('./config');

let memory = {};

function load() {
  try {
    if (fs.existsSync(config.memoryFile)) {
      memory = JSON.parse(fs.readFileSync(config.memoryFile, 'utf8'));
    }
  } catch (e) {
    memory = {};
  }
  return memory;
}

function save() {
  fs.writeFileSync(config.memoryFile, JSON.stringify(memory, null, 2));
}

function get(key) {
  return memory[key];
}

function set(key, value) {
  memory[key] = value;
  save();
}

function update(key, updates) {
  memory[key] = { ...memory[key], ...updates };
  save();
}

module.exports = { load, save, get, set, update };