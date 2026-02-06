/**
 * Semantic search engine for Smart Connections
 */
import type { SimilarNote, ConnectionGraph, NoteContent } from './types.js';
import type { SmartConnectionsLoader } from './smart-connections-loader.js';
import { OllamaClient } from './ollama-client.js';
export declare class SearchEngine {
    private loader;
    private embeddingModelKey;
    private ollamaClient;
    constructor(loader: SmartConnectionsLoader, ollamaClient?: OllamaClient);
    /**
     * Find similar notes to a given note path
     */
    getSimilarNotes(notePath: string, threshold?: number, limit?: number): SimilarNote[];
    /**
     * Get embedding neighbors for a given embedding vector
     */
    getEmbeddingNeighbors(embeddingVector: number[], k?: number, threshold?: number): SimilarNote[];
    /**
     * Build a connection graph starting from a note
     */
    getConnectionGraph(notePath: string, depth?: number, threshold?: number, maxPerLevel?: number): ConnectionGraph;
    /**
     * Search notes by content similarity
     * Now uses Ollama for semantic search with keyword fallback
     */
    searchByQuery(queryText: string, limit?: number, threshold?: number): Promise<SimilarNote[]>;
    /**
     * Semantic search using Ollama embeddings
     */
    private searchByEmbedding;
    /**
     * Keyword-based search (enhanced with token splitting)
     */
    private searchByKeyword;
    /**
     * Get note content with matched blocks highlighted
     */
    getNoteWithContext(notePath: string, includeBlocks?: string[]): NoteContent;
    /**
     * Get statistics about the knowledge base
     */
    getStats(): {
        totalNotes: number;
        totalBlocks: number;
        embeddingDimension: number;
        modelKey: string;
    };
}
//# sourceMappingURL=search-engine.d.ts.map