/**
 * Ollama API client for generating query embeddings
 * Supports disk-based caching for performance optimization
 */
import * as fs from 'fs';
import * as path from 'path';
export class OllamaClient {
    baseUrl;
    modelName;
    cache;
    cacheFile;
    isDirty = false;
    maxCacheSize = 1000;
    constructor(baseUrl, modelName, cacheDir) {
        this.baseUrl = baseUrl;
        this.modelName = modelName;
        this.cache = new Map();
        // Ensure cache directory exists
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        this.cacheFile = path.join(cacheDir, 'embeddings.json');
        this.loadCache();
        // Save cache on process exit
        process.on('SIGINT', () => {
            this.saveCache();
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            this.saveCache();
            process.exit(0);
        });
    }
    /**
     * Generate embedding for a text query
     * Uses cache if available, otherwise calls Ollama API
     */
    async generateEmbedding(text) {
        const cacheKey = text.toLowerCase().trim();
        // Check cache first
        if (this.cache.has(cacheKey)) {
            console.error(`✓ Cache hit for query: "${text.substring(0, 50)}..."`);
            return this.cache.get(cacheKey);
        }
        // Call Ollama API
        try {
            const response = await fetch(`${this.baseUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: text
                })
            });
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }
            const data = await response.json();
            // Store in cache
            this.cache.set(cacheKey, data.embedding);
            this.isDirty = true;
            // Periodic save (every 10 entries)
            if (this.cache.size % 10 === 0) {
                this.saveCache();
            }
            // LRU eviction if cache too large
            if (this.cache.size > this.maxCacheSize) {
                const firstKey = this.cache.keys().next().value;
                if (firstKey) {
                    this.cache.delete(firstKey);
                }
            }
            console.error(`✓ Generated embedding for query: "${text.substring(0, 50)}..." (dim: ${data.embedding.length})`);
            return data.embedding;
        }
        catch (error) {
            console.error(`Failed to generate embedding: ${error}`);
            throw error;
        }
    }
    /**
     * Check if Ollama is reachable
     */
    async healthCheck() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeout);
            return response.ok;
        }
        catch {
            return false;
        }
    }
    /**
     * Load cache from disk
     */
    loadCache() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
                // Invalidate cache if model changed
                if (data.model === this.modelName) {
                    this.cache = new Map(Object.entries(data.cache));
                    console.error(`✓ Loaded ${this.cache.size} cached embeddings`);
                }
                else {
                    console.error(`⚠ Cache invalidated due to model change: ${data.model} -> ${this.modelName}`);
                }
            }
        }
        catch (error) {
            console.error(`⚠ Failed to load cache: ${error}`);
        }
    }
    /**
     * Save cache to disk
     */
    saveCache() {
        if (!this.isDirty)
            return;
        try {
            const data = {
                version: '1.0',
                model: this.modelName,
                cache: Object.fromEntries(this.cache),
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
            this.isDirty = false;
            console.error(`✓ Saved ${this.cache.size} embeddings to cache`);
        }
        catch (error) {
            console.error(`⚠ Failed to save cache: ${error}`);
        }
    }
}
//# sourceMappingURL=ollama-client.js.map