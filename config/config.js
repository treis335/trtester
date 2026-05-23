// Date: 2025-04-08
// Reason: Increase RPC timeout and add retry logic to handle 500 errors from Spikey DEX

const CONFIG = {
  // ... existing config ...
  rpc: {
    timeout: 30000, // increased from 20000
    retry: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 5000
    }
  },
  // ... rest of existing config ...
};

// Ensure CONFIG.rpc exists before accessing it
if (!CONFIG.rpc) {
  CONFIG.rpc = {
    timeout: 30000,
    retry: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 5000
    }
  };
}

module.exports = { CONFIG };
