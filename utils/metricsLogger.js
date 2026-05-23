// utils/metricsLogger.js
const fs = require('fs');

function logMetrics(opp) {
  const csvLine = [
    new Date().toISOString(),
    opp.pair,
    opp.route.map(r => r.dex).join('->'),
    opp.expectedProfit.toString(),
    opp.gasCost.toString(),
    (Number(opp.expectedProfit) / opp.gasCost).toFixed(6),
    opp.timeToDetectMs,
    opp.timeToExecuteMs,
    opp.success ? 1 : 0,
  ].join(',') + '\n';

  fs.appendFileSync('metrics.csv', csvLine);
}

module.exports = { logMetrics };