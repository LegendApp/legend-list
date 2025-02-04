export class ConnectivityManager {
    private let connectedToAnchorElements: Set<number> = new Set();
    private let connections: Map<number, Set<number>> = new Map();

    constructor(anchorIndex: number) {
        this.connectedToAnchorElements.add(anchorIndex);
    }

    addConnection(index: number) {
      
    }
}