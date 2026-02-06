# Testing Smart Connections MCP - Ollama Integration

## Status: Ready for Testing

**Branch**: `feat/support-custom-embedding-models`  
**Commits**: 
- `fc463f0` - feat: add Ollama integration for semantic search
- `00a82d9` - docs: update README with Ollama integration

## Prerequisites

✅ All completed:
- [x] Ollama installed and running on localhost:11434
- [x] Model `nomic-embed-text-v2-moe:latest` pulled
- [x] OpenCode configuration updated with environment variables
- [x] Smart Connections MCP built and deployed

## Required: OpenCode Restart

⚠️ **CRITICAL**: OpenCode MUST be restarted to load new environment variables.

```bash
# Exit OpenCode completely
# Then restart OpenCode CLI
```

## Test Plan

### Test 1: Verify Server Startup

**Expected**: Server should connect to Ollama successfully.

**How to verify**:
```bash
# Check OpenCode MCP logs
# Look for: "Ollama connected: http://localhost:11434"
```

**Success criteria**:
- ✅ No "Ollama unavailable" warning
- ✅ Log shows Ollama URL and model name

---

### Test 2: Semantic Search - Basic Query

**Objective**: Test that queries now use embeddings instead of keywords.

**Test case**:
```
@build search for notes about "OpenCode MCP"
```

**Expected results**:
- Should find `AGENTS.md` (contains MCP configuration context)
- Should find `.opencode/` related documentation
- Should NOT require exact keyword matches

**Success criteria**:
- ✅ Returns relevant notes even with different wording
- ✅ Similarity scores are meaningful (>0.6 for good matches)

---

### Test 3: Semantic Search - Conceptual Query

**Test case**:
```
@build search for notes about "Model Context Protocol"
```

**Expected results**:
- Should find notes related to MCP even if they don't contain "Model Context Protocol" phrase
- Should understand MCP ≈ OpenCode ≈ AI integration concepts

**Success criteria**:
- ✅ Finds conceptually related notes
- ✅ Higher quality results than pure keyword matching

---

### Test 4: Query Cache Performance

**Test case**:
```
# First run
@build search for "project management"

# Wait 2 seconds

# Second run (same query)
@build search for "project management"
```

**Expected results**:
- First run: ~500-800ms (Ollama API call)
- Second run: <50ms (cache hit)

**How to verify**:
```bash
# Check logs for:
# First: "Generated embedding for query: project management"
# Second: "Using cached embedding for query: project management"
```

**Success criteria**:
- ✅ Cache is created at `.smart-env/query-cache/embeddings.json`
- ✅ Dramatic performance improvement on second run
- ✅ Cache persists across sessions

---

### Test 5: Cache File Inspection

**Test case**:
```bash
cat /Users/jochen.witte/Data/Akasha/.smart-env/query-cache/embeddings.json
```

**Expected structure**:
```json
{
  "embeddings": [
    {
      "query": "project management",
      "embedding": [0.123, -0.456, ...],
      "timestamp": 1738800000000
    }
  ]
}
```

**Success criteria**:
- ✅ File exists after first query
- ✅ Contains embedding vectors (768 dimensions for nomic)
- ✅ Timestamp is recent
- ✅ Multiple queries are cached

---

### Test 6: Fallback Behavior

**Test case**:
```bash
# Stop Ollama
brew services stop ollama

# Then in OpenCode:
@build search for "project management"
```

**Expected results**:
- Server should NOT crash
- Should log: "Ollama unavailable, using keyword fallback"
- Should return results using improved keyword matching

**Success criteria**:
- ✅ Graceful degradation
- ✅ No errors or crashes
- ✅ Still returns reasonable results (though less accurate)

**Cleanup**:
```bash
# Restart Ollama
brew services start ollama
```

---

### Test 7: Multi-Query Session

**Test case**:
Run several different queries in sequence:
```
1. @build search for "OpenCode"
2. @build search for "meeting notes"
3. @build search for "project planning"
4. @build search for "OpenCode"  (repeat first query)
```

**Expected results**:
- All queries return relevant results
- Query #4 uses cache (very fast)
- Cache file grows to 4 entries

**Success criteria**:
- ✅ All queries work correctly
- ✅ Cache hit on repeated query
- ✅ No memory leaks or performance degradation

---

## Expected Log Output

### Successful Startup
```
[smart-connections] Loading Smart Connections data...
[smart-connections] Loaded 4866 notes, 70681 blocks
[smart-connections] Detected embedding model: nomic-embed-text-v2-moe (768 dimensions)
[smart-connections] Initializing Ollama client...
[smart-connections] Ollama connected: http://localhost:11434
[smart-connections] Using model: nomic-embed-text-v2-moe:latest
```

### First Query (Cache Miss)
```
[smart-connections] search_notes: query="OpenCode MCP", limit=10, threshold=0.5
[smart-connections] Generating embedding for query: OpenCode MCP
[smart-connections] Query embedding generated in 542ms
[smart-connections] Found 8 results above threshold 0.5
```

### Second Query (Cache Hit)
```
[smart-connections] search_notes: query="OpenCode MCP", limit=10, threshold=0.5
[smart-connections] Using cached embedding for query: OpenCode MCP
[smart-connections] Query completed in 12ms
[smart-connections] Found 8 results above threshold 0.5
```

### Ollama Unavailable (Fallback)
```
[smart-connections] search_notes: query="project management", limit=10, threshold=0.5
[smart-connections] Ollama unavailable, using keyword fallback
[smart-connections] Keyword search completed in 145ms
[smart-connections] Found 5 results
```

---

## Troubleshooting

### Issue: "Ollama unavailable" even though Ollama is running

**Check**:
```bash
# Verify Ollama is accessible
curl http://localhost:11434/api/tags

# Should return JSON with model list including nomic-embed-text-v2-moe
```

**Fix**: Ensure `OLLAMA_URL` in `opencode.jsonc` is correct.

---

### Issue: "Embedding dimension mismatch"

**Cause**: `OLLAMA_MODEL` doesn't match vault embeddings.

**Check**:
```bash
# Check vault's embedding model
cat /Users/jochen.witte/Data/Akasha/.smart-env/smart_env.json | grep embed_model
```

**Fix**: Update `OLLAMA_MODEL` in `opencode.jsonc` to match.

---

### Issue: Cache not persisting between sessions

**Check**:
```bash
# Verify cache directory exists and is writable
ls -la /Users/jochen.witte/Data/Akasha/.smart-env/query-cache/
```

**Fix**: Ensure `CACHE_DIR` in `opencode.jsonc` points to a valid, writable directory.

---

### Issue: Slow performance even with cache

**Check**:
```bash
# Verify cache file contains embeddings
cat /Users/jochen.witte/Data/Akasha/.smart-env/query-cache/embeddings.json | jq '.embeddings | length'
```

**Possible causes**:
- Cache file is being cleared (check permissions)
- Query strings are slightly different (cache is exact-match)
- LRU eviction removed the entry (max 1000 entries)

---

## Success Metrics

After testing, confirm:

- [ ] Server starts successfully with Ollama connection
- [ ] Semantic search returns relevant results
- [ ] Query cache improves performance significantly
- [ ] Fallback to keyword search works without errors
- [ ] Cache persists across OpenCode restarts
- [ ] No memory leaks during extended use
- [ ] Documentation is accurate and helpful

## Next Steps After Testing

1. If tests pass → Merge `feat/support-custom-embedding-models` to `main`
2. If issues found → Document in GitHub Issues and fix
3. Update main project `opencode.jsonc` with tested configuration
4. Consider upstream PR to original smart-connections-mcp repo

---

## Test Environment

- **Vault**: /Users/jochen.witte/Data/Akasha
- **Notes**: 4866 notes, 70681 blocks
- **Embedding Model**: nomic-embed-text-v2-moe:latest (768 dimensions)
- **Ollama**: localhost:11434
- **OpenCode**: Latest version with MCP support
- **Branch**: feat/support-custom-embedding-models
- **Commits**: fc463f0, 00a82d9
