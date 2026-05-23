// engine/graphEngine.js
class GraphEngine {
  constructor() {
    this.vertices = new Map();   // address -> index
    this.edges = [];             // { from, to, weight, rate, meta }
  }

  buildGraph(pairStates) {
    this.clear();
    for (const ps of pairStates) {
      if (!ps || !ps.tokenA || !ps.tokenB) continue;
      const addrA = this._getTokenAddress(ps.tokenA);
      const addrB = this._getTokenAddress(ps.tokenB);
      if (!addrA || !addrB) continue;

      // Aresta A -> B
      let rateAB = ps.priceAinB;
      if (!rateAB || rateAB <= 0) {
        rateAB = ps._simulate ? ps._simulate('AB', 1) : 1;
      }
      if (rateAB > 0) {
        this.addEdge(addrA, addrB, rateAB, {
          pair: ps,
          dex: ps.dex,
          from: ps.tokenA,
          to: ps.tokenB,
          direction: 'AB',
        });
      }

      // Aresta B -> A
      let rateBA = ps._simulate ? ps._simulate('BA', 1) : (rateAB ? 1 / rateAB : 0);
      if (rateBA > 0) {
        this.addEdge(addrB, addrA, rateBA, {
          pair: ps,
          dex: ps.dex,
          from: ps.tokenB,
          to: ps.tokenA,
          direction: 'BA',
        });
      }
    }
    return this;
  }

  addEdge(fromAddr, toAddr, rate, meta = {}) {
    if (!this.vertices.has(fromAddr)) this.vertices.set(fromAddr, this.vertices.size);
    if (!this.vertices.has(toAddr)) this.vertices.set(toAddr, this.vertices.size);
    this.edges.push({
      from: this.vertices.get(fromAddr),
      to: this.vertices.get(toAddr),
      weight: -Math.log2(rate),
      rate,
      meta,
    });
  }

  findCycles(graphInstance, maxHops = 4) {
    const cycles = [];
    for (const [addr, idx] of this.vertices) {
      const cycleMeta = this._findNegativeCycle(idx, maxHops);
      if (cycleMeta && cycleMeta.length > 0) {
        const path = [];
        const edges = [];
        let product = 1;
        for (const meta of cycleMeta) {
          path.push(meta.from);
          edges.push({
            pair: meta.pair,
            from: meta.from,
            to: meta.to,
            dex: meta.dex,
            direction: meta.direction,
          });
          product *= meta.rate;
        }
        path.push(cycleMeta[0].from);
        cycles.push({ path, edges, product });
      }
    }
    return cycles;
  }

  _findNegativeCycle(sourceIdx, maxHops) {
    const V = this.vertices.size;
    const dist = Array(V).fill(Infinity);
    const predecessor = Array(V).fill(null);
    const edgeUsed = Array(V).fill(null);
    dist[sourceIdx] = 0;

    for (let i = 1; i <= V - 1; i++) {
      for (const edge of this.edges) {
        if (dist[edge.from] + edge.weight < dist[edge.to] - 1e-12) {
          dist[edge.to] = dist[edge.from] + edge.weight;
          predecessor[edge.to] = edge.from;
          edgeUsed[edge.to] = edge;
        }
      }
    }

    for (const edge of this.edges) {
      if (dist[edge.from] + edge.weight < dist[edge.to] - 1e-12) {
        const cycleEdges = [];
        let current = edge.to;
        const visited = new Set();
        while (!visited.has(current)) {
          visited.add(current);
          if (edgeUsed[current]) {
            cycleEdges.push(edgeUsed[current]);
            current = predecessor[current];
          } else break;
        }
        if (cycleEdges.length > 0 && cycleEdges.length <= maxHops) {
          let profit = 1;
          for (const e of cycleEdges) profit *= e.rate;
          if (profit > 1) {
            return cycleEdges.map(e => e.meta);
          }
        }
      }
    }
    return null;
  }

  clear() {
    this.vertices.clear();
    this.edges = [];
  }

  _getTokenAddress(symbol) {
    const { CONFIG } = require('../config/config');
    const token = CONFIG.tokens[symbol];
    if (!token) return null;
    return token.type;
  }
}

module.exports = new GraphEngine();