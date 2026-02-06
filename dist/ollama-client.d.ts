/**
 * Ollama API client for generating query embeddings
 * Supports disk-based caching for performance optimization
 */
export declare class OllamaClient {
    private baseUrl;
    private modelName;
    private cache;
    private cacheFile;
    private isDirty;
    private readonly maxCacheSize;
    constructor(baseUrl: string, modelName: string, cacheDir: string);
    /**
     * Generate embedding for a text query
     * Uses cache if available, otherwise calls Ollama API
     */
    generateEmbedding(text: string): Promise<number[]>;
    /**
     * Check if Ollama is reachable
     */
    healthCheck(): Promise<boolean>;
    /**
     * Load cache from disk
     */
    private loadCache;
    /**
     * Save cache to disk
     */
    private saveCache;
}
//# sourceMappingURL=ollama-client.d.ts.map