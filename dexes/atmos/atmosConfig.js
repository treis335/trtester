const fs = require('fs');
const path = require('path');

function loadAtmosPools() {
    try {
        const filePath = path.join(__dirname, '..', '..', 'atmosPools.json');
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

const ATMOS_CONFIG = {
    moduleAddress: '0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234',
    pools: loadAtmosPools(),
};

module.exports = { ATMOS_CONFIG };