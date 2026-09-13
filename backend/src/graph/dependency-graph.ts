export interface GraphNode {
  id: string; // package name
  name: string;
  version: string;
  ecosystem: string;
  isDirect: boolean;
  depth: number;
}

export interface GraphEdge {
  source: string; // A in A -> B ("A depends on B")
  target: string; // B in A -> B
}

export interface PackageGraphMetrics {
  depth: number;
  inDegree: number;              // packages directly depending on this (incoming edges)
  outDegree: number;             // packages this depends on (outgoing edges)
  directDependents: string[];    // immediate consumers
  transitiveDependents: string[];// all ancestors that reach this package
  dependencies: string[];        // immediate children
  transitiveDependencies: string[]; // all downstream descendants
  downstreamPathsCount: number;  // number of distinct paths leading to this node
  blastRadiusScore: number;      // 0 - 100 normalized score
  centralityScore: number;       // betweenness / degree centrality
  reachableNodesCount: number;
}

export class DependencyGraph {
  private nodes: Map<string, GraphNode> = new Map();
  // Adjacency list: source -> Set of targets (A depends on B => edges.get(A).has(B))
  private outEdges: Map<string, Set<string>> = new Map();
  // Reverse adjacency list: target -> Set of sources (B is depended on by A => inEdges.get(B).has(A))
  private inEdges: Map<string, Set<string>> = new Map();
  public rootId: string = '';

  constructor(rootId = 'Application') {
    this.rootId = rootId;
    this.addNode({
      id: rootId,
      name: rootId,
      version: '1.0.0',
      ecosystem: 'root',
      isDirect: true,
      depth: 0,
    });
  }

  addNode(node: GraphNode): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, { ...node });
      if (!this.outEdges.has(node.id)) this.outEdges.set(node.id, new Set());
      if (!this.inEdges.has(node.id)) this.inEdges.set(node.id, new Set());
    } else {
      // Merge or update metadata if needed
      const existing = this.nodes.get(node.id)!;
      if (node.isDirect) existing.isDirect = true;
      if (node.version && node.version !== '0.0.0') existing.version = node.version;
    }
  }

  // A -> B: "A depends on B"
  addEdge(source: string, target: string): void {
    if (!this.nodes.has(source)) {
      this.addNode({ id: source, name: source, version: '1.0.0', ecosystem: 'unknown', isDirect: false, depth: 99 });
    }
    if (!this.nodes.has(target)) {
      this.addNode({ id: target, name: target, version: '1.0.0', ecosystem: 'unknown', isDirect: false, depth: 99 });
    }

    this.outEdges.get(source)!.add(target);
    this.inEdges.get(target)!.add(source);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): GraphEdge[] {
    const edges: GraphEdge[] = [];
    for (const [source, targets] of this.outEdges.entries()) {
      for (const target of targets) {
        edges.push({ source, target });
      }
    }
    return edges;
  }

  getDirectDependencies(nodeId: string): string[] {
    return Array.from(this.outEdges.get(nodeId) || []);
  }

  getDirectDependents(nodeId: string): string[] {
    return Array.from(this.inEdges.get(nodeId) || []);
  }

  // Calculate shortest path depth from root to all nodes using BFS
  calculateDepths(): void {
    const distances: Map<string, number> = new Map();
    for (const node of this.nodes.keys()) {
      distances.set(node, Infinity);
    }
    distances.set(this.rootId, 0);

    const queue: string[] = [this.rootId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDist = distances.get(current)!;
      const targets = this.outEdges.get(current) || new Set();

      for (const target of targets) {
        if (distances.get(target)! > currentDist + 1) {
          distances.set(target, currentDist + 1);
          queue.push(target);
        }
      }
    }

    for (const [nodeId, dist] of distances.entries()) {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.depth = dist === Infinity ? 99 : dist;
      }
    }
  }

  // Find all ancestor nodes that depend on nodeId (transitive dependents)
  getTransitiveDependents(nodeId: string): string[] {
    const visited = new Set<string>();
    const queue = [...this.getDirectDependents(nodeId)];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!visited.has(current)) {
        visited.add(current);
        const parents = this.getDirectDependents(current);
        for (const p of parents) {
          if (!visited.has(p)) queue.push(p);
        }
      }
    }
    return Array.from(visited);
  }

  // Find all descendant nodes that nodeId depends on (transitive dependencies)
  getTransitiveDependencies(nodeId: string): string[] {
    const visited = new Set<string>();
    const queue = [...this.getDirectDependencies(nodeId)];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!visited.has(current)) {
        visited.add(current);
        const children = this.getDirectDependencies(current);
        for (const c of children) {
          if (!visited.has(c)) queue.push(c);
        }
      }
    }
    return Array.from(visited);
  }

  // Count distinct paths from root to nodeId
  countPathsFromRoot(nodeId: string): number {
    if (nodeId === this.rootId) return 1;

    // DFS with memoization (handling DAG)
    const memo = new Map<string, number>();

    const dfs = (curr: string, visited: Set<string>): number => {
      if (curr === nodeId) return 1;
      if (visited.has(curr)) return 0; // Cycle safeguard
      if (memo.has(curr)) return memo.get(curr)!;

      visited.add(curr);
      let totalPaths = 0;
      const neighbors = this.outEdges.get(curr) || new Set();
      for (const next of neighbors) {
        totalPaths += dfs(next, new Set(visited));
      }

      memo.set(curr, totalPaths);
      return totalPaths;
    };

    return dfs(this.rootId, new Set());
  }

  // Compute betweenness centrality for all nodes
  calculateCentrality(): Map<string, number> {
    const centrality = new Map<string, number>();
    for (const node of this.nodes.keys()) {
      centrality.set(node, 0);
    }

    const nodeKeys = Array.from(this.nodes.keys());
    const totalNodes = nodeKeys.length;
    if (totalNodes <= 2) return centrality;

    // Degree centrality + betweenness approximation
    for (const node of nodeKeys) {
      const inDeg = (this.inEdges.get(node) || new Set()).size;
      const outDeg = (this.outEdges.get(node) || new Set()).size;
      // Normalized degree centrality
      const degCentrality = (inDeg + outDeg) / (2 * (totalNodes - 1));
      centrality.set(node, Math.round(degCentrality * 100) / 100);
    }

    return centrality;
  }

  // Calculate complete graph metrics for every package
  calculateAllMetrics(): Map<string, PackageGraphMetrics> {
    this.calculateDepths();
    const centralities = this.calculateCentrality();
    const metricsMap = new Map<string, PackageGraphMetrics>();

    const totalPackages = Math.max(1, this.nodes.size - 1); // Exclude root app

    for (const [nodeId, node] of this.nodes.entries()) {
      if (nodeId === this.rootId) continue;

      const directDependents = this.getDirectDependents(nodeId);
      const transitiveDependents = this.getTransitiveDependents(nodeId);
      const dependencies = this.getDirectDependencies(nodeId);
      const transitiveDependencies = this.getTransitiveDependencies(nodeId);
      const downstreamPathsCount = this.countPathsFromRoot(nodeId);
      const inDegree = directDependents.length;
      const outDegree = dependencies.length;
      const centralityScore = centralities.get(nodeId) || 0;

      // Blast radius formula:
      // Combines:
      // 1. Proportion of graph depending on this package (transitive dependents / total nodes) (0-40 pts)
      // 2. Direct dependents count (0-30 pts)
      // 3. Number of distinct paths reaching this package (0-20 pts)
      // 4. In-degree / centrality (0-10 pts)
      const depRatio = Math.min(1, transitiveDependents.length / totalPackages);
      const directFactor = Math.min(1, inDegree / 3);
      const pathFactor = Math.min(1, downstreamPathsCount / 3);
      const centFactor = Math.min(1, centralityScore * 2);

      const blastRadiusScore = Math.min(
        100,
        Math.round((depRatio * 40 + directFactor * 30 + pathFactor * 20 + centFactor * 10) * 10) / 10
      );

      metricsMap.set(nodeId, {
        depth: node.depth,
        inDegree,
        outDegree,
        directDependents,
        transitiveDependents,
        dependencies,
        transitiveDependencies,
        downstreamPathsCount,
        blastRadiusScore,
        centralityScore,
        reachableNodesCount: transitiveDependencies.length,
      });
    }

    return metricsMap;
  }
}
