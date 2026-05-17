const SPIKEY_CONFIG = {
  routerAddress: '0x3045d27b5fada1e30897a741fb184e48ef0bff3717aea23918ebc1e5c7153083',
  pairs: [
    // Basta indicar os símbolos. O engine calcula os endereços automaticamente.
    { tokenA: 'SUPRA', tokenB: 'DEXUSDC' },
    // Adiciona outros pares aqui...
  ],
};

module.exports = { SPIKEY_CONFIG };