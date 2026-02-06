/**
 * Semantic search engine for Smart Connections
 */
import { findNearestNeighbors } from './embedding-utils.js';
export class SearchEngine {
    loader;
    embeddingModelKey;
    ollamaClient;
    constructor(loader, ollamaClient) {
        this.loader = loader;
        this.embeddingModelKey = loader.getEmbeddingModelKey();
        this.ollamaClient = ollamaClient || null;
    }
    /**
     * Find similar notes to a given note path
     */
    getSimilarNotes(notePath, threshold = 0.5, limit = 10) {
        const source = this.loader.getSource(notePath);
        if (!source) {
            throw new Error(`Note not found: ${notePath}`);
        }
        const embeddings = source.embeddings[this.embeddingModelKey];
        if (!embeddings || !embeddings.vec) {
            throw new Error(`No embeddings found for note: ${notePath}`);
        }
        // Build vector dataset from all sources
        const vectors = Array.from(this.loader.getSources().entries())
            .filter(([path]) => path !== notePath) // Exclude the query note itself
            .map(([path, src]) => {
            const emb = src.embeddings[this.embeddingModelKey];
            return {
                id: path,
                vec: emb?.vec || [],
                metadata: {
                    blocks: Object.keys(src.blocks || {}),
                    lastModified: src.last_import?.mtime || 0
                }
            };
        })
            .filter(item => item.vec.length > 0);
        // Find nearest neighbors
        const neighbors = findNearestNeighbors(embeddings.vec, vectors, limit, threshold);
        // Convert to SimilarNote format
        return neighbors.map(neighbor => ({
            path: neighbor.id,
            similarity: neighbor.similarity,
            blocks: neighbor.metadata.blocks
        }));
    }
    /**
     * Get embedding neighbors for a given embedding vector
     */
    getEmbeddingNeighbors(embeddingVector, k = 10, threshold = 0.5) {
        // Build vector dataset from all sources
        const vectors = Array.from(this.loader.getSources().entries())
            .map(([path, src]) => {
            const emb = src.embeddings[this.embeddingModelKey];
            return {
                id: path,
                vec: emb?.vec || [],
                metadata: {
                    blocks: Object.keys(src.blocks || {}),
                    lastModified: src.last_import?.mtime || 0
                }
            };
        })
            .filter(item => item.vec.length > 0);
        // Find nearest neighbors
        const neighbors = findNearestNeighbors(embeddingVector, vectors, k, threshold);
        // Convert to SimilarNote format
        return neighbors.map(neighbor => ({
            path: neighbor.id,
            similarity: neighbor.similarity,
            blocks: neighbor.metadata.blocks
        }));
    }
    /**
     * Build a connection graph starting from a note
     */
    getConnectionGraph(notePath, depth = 2, threshold = 0.6, maxPerLevel = 5) {
        const visited = new Set();
        const flatConnections = [];
        const buildGraph = (currentPath, currentDepth, parentSimilarity = 1.0) => {
            visited.add(currentPath);
            // Add to flat list (skip root at depth 0)
            if (currentDepth > 0) {
                flatConnections.push({
                    path: currentPath,
                    depth: currentDepth,
                    similarity: parentSimilarity
                });
            }
            // Stop if we've reached max depth
            if (currentDepth >= depth) {
                return;
            }
            // Find similar notes
            try {
                const similar = this.getSimilarNotes(currentPath, threshold, maxPerLevel);
                // Recursively build connections
                for (const sim of similar) {
                    // Skip already visited nodes to prevent cycles
                    if (!visited.has(sim.path)) {
                        buildGraph(sim.path, currentDepth + 1, sim.similarity);
                    }
                }
            }
            catch (error) {
                console.error(`Error building graph for ${currentPath}:`, error);
            }
        };
        buildGraph(notePath, 0);
        return {
            root: notePath,
            connections: flatConnections
        };
    }
    /**
     * Search notes by content similarity
     * Now uses Ollama for semantic search with keyword fallback
     */
    async searchByQuery(queryText, limit = 10, threshold = 0.5) {
        // Try semantic search first if Ollama is available
        if (this.ollamaClient) {
            try {
                const isHealthy = await this.ollamaClient.healthCheck();
                if (isHealthy) {
                    console.error('Using semantic search (Ollama)');
                    return await this.searchByEmbedding(queryText, limit, threshold);
                }
                else {
                    console.error('Ollama unhealthy, falling back to keyword search');
                }
            }
            catch (error) {
                console.error(`Semantic search failed: ${error}, falling back to keyword search`);
            }
        }
        // Fallback to keyword search
        console.error('Using keyword search (fallback)');
        return this.searchByKeyword(queryText, limit, threshold);
    }
    /**
     * Semantic search using Ollama embeddings
     */
    async searchByEmbedding(queryText, limit, threshold) {
        if (!this.ollamaClient) {
            throw new Error('Ollama client not initialized');
        }
        // Generate embedding for query
        const queryEmbedding = await this.ollamaClient.generateEmbedding(queryText);
        // Use existing embedding neighbor search
        return this.getEmbeddingNeighbors(queryEmbedding, limit, threshold);
    }
    /**
     * Keyword-based search (enhanced with token splitting)
     */
    searchByKeyword(queryText, limit, threshold) {
        const results = [];
        // Split query into tokens for better matching
        const tokens = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        if (tokens.length === 0) {
            return results;
        }
        for (const [path, source] of this.loader.getSources()) {
            try {
                const content = this.loader.readNoteContent(path).toLowerCase();
                // Score based on token matches
                let totalScore = 0;
                for (const token of tokens) {
                    const matches = (content.match(new RegExp(token, 'gi')) || []).length;
                    // Each token can contribute max 1.0 to the score
                    totalScore += Math.min(matches / 3, 1.0);
                }
                // Average score across all tokens
                const score = totalScore / tokens.length;
                if (score >= threshold) {
                    results.push({
                        path,
                        similarity: score,
                        blocks: Object.keys(source.blocks || {})
                    });
                }
            }
            catch (error) {
                // Skip notes that can't be read
                continue;
            }
        }
        // Sort by similarity and limit
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }
    /**
     * Get note content with matched blocks highlighted
     */
    getNoteWithContext(notePath, includeBlocks = []) {
        const content = this.loader.readNoteContent(notePath);
        const source = this.loader.getSource(notePath);
        const availableBlocks = source ? Object.keys(source.blocks || {}) : [];
        return {
            path: notePath,
            content,
            blocks: availableBlocks
        };
    }
    /**
     * Get statistics about the knowledge base
     */
    getStats() {
        const sources = this.loader.getSources();
        let totalBlocks = 0;
        let embeddingDim = 0;
        for (const source of sources.values()) {
            totalBlocks += Object.keys(source.blocks || {}).length;
            if (embeddingDim === 0) {
                const emb = source.embeddings[this.embeddingModelKey];
                if (emb?.vec) {
                    embeddingDim = emb.vec.length;
                }
            }
        }
        return {
            totalNotes: sources.size,
            totalBlocks,
            embeddingDimension: embeddingDim,
            modelKey: this.embeddingModelKey
        };
    }
}
//# sourceMappingURL=search-engine.js.map