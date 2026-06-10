/* @lifecycle ACTIVE — SimilarityGraphBuilder: soft, undirected similarity graph for ranking boost (TASK-060) */

import { RuleSection, SimilarityGraph, SimilarityEdge, SimilarityStats } from '../ir/types';
import { SectionRegistry } from '../registry/SectionRegistry';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'of', 'to', 'in', 'with', 'on',
  'at', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
  'has', 'had', 'do', 'does', 'did', 'but', 'not', 'so', 'yet', 'about',
  'above', 'after', 'again', 'against', 'all', 'am', 'as', 'before',
  'between', 'both', 'each', 'few', 'from', 'further', 'here', 'how',
  'into', 'just', 'more', 'most', 'no', 'nor', 'now', 'once', 'only',
  'other', 'our', 'out', 'over', 'own', 'same', 'shall', 'should',
  'some', 'such', 'than', 'that', 'their', 'them', 'then', 'there',
  'these', 'they', 'this', 'through', 'too', 'under', 'until', 'very',
  'what', 'when', 'where', 'which', 'while', 'who', 'why', 'would',
]);

export class SimilarityGraphBuilder {
  private registry: SectionRegistry;
  private edges: Map<string, SimilarityEdge> = new Map();
  private tfVectors: Map<string, Map<string, number>> = new Map();
  private idf: Map<string, number> = new Map();

  constructor(registry: SectionRegistry) {
    this.registry = registry;
  }

  build(): SimilarityGraph {
    const sections = this.registry.getAll();

    this.computeTfIdf(sections);
    this.detectTitleKeywordEdges(sections);
    this.detectContentSimilarityEdges(sections);
    this.pruneEdges(sections);

    const allIds = sections.map(s => s.id);
    const finalEdges = Array.from(this.edges.values());
    const stats = this.computeStats(allIds);

    return {
      nodes: allIds,
      edges: finalEdges,
      stats,
    };
  }

  // ─── TF-IDF ────────────────────────────────────────────────────

  private computeTfIdf(sections: RuleSection[]): void {
    for (const section of sections) {
      this.tfVectors.set(section.id, this.buildTermFrequency(section.content));
    }

    const docCount = sections.length;
    const termDocFreq = new Map<string, number>();
    for (const section of sections) {
      const terms = new Set(this.tokenize(section.content));
      for (const term of terms) {
        termDocFreq.set(term, (termDocFreq.get(term) ?? 0) + 1);
      }
    }
    for (const [term, df] of termDocFreq) {
      this.idf.set(term, Math.log(docCount / (df + 1)) + 1);
    }
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  }

  private buildTermFrequency(text: string): Map<string, number> {
    const words = this.tokenize(text);
    const tf = new Map<string, number>();
    for (const word of words) {
      tf.set(word, (tf.get(word) ?? 0) + 1);
    }
    const total = words.length || 1;
    for (const [word, count] of tf) {
      tf.set(word, count / total);
    }
    return tf;
  }

  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    const allTerms = new Set([...a.keys(), ...b.keys()]);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (const term of allTerms) {
      const wa = (a.get(term) ?? 0) * (this.idf.get(term) ?? 0);
      const wb = (b.get(term) ?? 0) * (this.idf.get(term) ?? 0);
      dotProduct += wa * wb;
      normA += wa * wa;
      normB += wb * wb;
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ─── Edge helpers ──────────────────────────────────────────────

  private addEdge(sourceId: string, targetId: string, weight: number, method: SimilarityEdge['method']): void {
    if (sourceId === targetId) return;
    const key = `${sourceId}||${targetId}`;
    const existing = this.edges.get(key);
    if (!existing || weight > existing.weight) {
      this.edges.set(key, { sourceId, targetId, weight, method });
    }
  }

  // ─── Title keyword TF-IDF ──────────────────────────────────────

  private detectTitleKeywordEdges(sections: RuleSection[]): void {
    const totalSections = sections.length;
    const titleFreqThreshold = Math.max(1, Math.floor(totalSections * 0.15));

    const titleKeywords = new Map<string, Set<string>>();
    for (const section of sections) {
      const keywords = new Set(
        section.title.toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      );
      titleKeywords.set(section.id, keywords);
    }

    const titleKeywordDf = new Map<string, number>();
    for (const keywords of titleKeywords.values()) {
      for (const kw of keywords) {
        titleKeywordDf.set(kw, (titleKeywordDf.get(kw) ?? 0) + 1);
      }
    }

    for (const [kw, df] of titleKeywordDf) {
      if (df > titleFreqThreshold || df < 2) continue;

      const matchingIds: string[] = [];
      for (const [sid, keywords] of titleKeywords) {
        if (keywords.has(kw)) {
          matchingIds.push(sid);
        }
      }

      const idfRatio = 1 - (df - 1) / titleFreqThreshold;
      const weight = Math.min(0.8, Math.max(0.1, idfRatio * 0.8));

      for (let i = 0; i < matchingIds.length; i++) {
        for (let j = i + 1; j < matchingIds.length; j++) {
          this.addEdge(matchingIds[i], matchingIds[j], weight, 'title_keyword');
        }
      }
    }
  }

  // ─── Content TF-IDF similarity ─────────────────────────────────

  private detectContentSimilarityEdges(sections: RuleSection[]): void {
    const sectionIds = sections.map(s => s.id);

    const allScores: { sourceId: string; targetId: string; score: number }[] = [];

    for (let i = 0; i < sectionIds.length; i++) {
      const vecA = this.tfVectors.get(sectionIds[i]);
      if (!vecA || vecA.size === 0) continue;

      for (let j = i + 1; j < sectionIds.length; j++) {
        const vecB = this.tfVectors.get(sectionIds[j]);
        if (!vecB || vecB.size === 0) continue;

        const score = this.cosineSimilarity(vecA, vecB);
        if (score > 0.1) {
          allScores.push({ sourceId: sectionIds[i], targetId: sectionIds[j], score });
        }
      }
    }

    const perSource = new Map<string, { targetId: string; score: number }[]>();
    for (const { sourceId, targetId, score } of allScores) {
      const listA = perSource.get(sourceId) ?? [];
      listA.push({ targetId, score });
      perSource.set(sourceId, listA);

      const listB = perSource.get(targetId) ?? [];
      listB.push({ targetId: sourceId, score });
      perSource.set(targetId, listB);
    }

    for (const [sourceId, candidates] of perSource) {
      candidates.sort((a, b) => b.score - a.score);
      const top5 = candidates.slice(0, 5);
      for (const { targetId, score } of top5) {
        this.addEdge(sourceId, targetId, score, 'tfidf_similarity');
      }
    }
  }

  // ─── Pruning ───────────────────────────────────────────────────

  private pruneEdges(sections: RuleSection[]): void {
    const sectionFile = new Map<string, string>();
    for (const section of sections) {
      sectionFile.set(section.id, section.source);
    }

    const perSourceEdges = new Map<string, SimilarityEdge[]>();
    for (const edge of this.edges.values()) {
      if (sectionFile.get(edge.sourceId) === sectionFile.get(edge.targetId)) continue;
      if (edge.weight < 0.1) continue;

      const list = perSourceEdges.get(edge.sourceId) ?? [];
      list.push(edge);
      perSourceEdges.set(edge.sourceId, list);
    }

    this.edges.clear();
    for (const [, edges] of perSourceEdges) {
      edges.sort((a, b) => b.weight - a.weight);
      const topK = edges.slice(0, 8);
      for (const edge of topK) {
        this.addEdge(edge.sourceId, edge.targetId, edge.weight, edge.method);
      }
    }
  }

  // ─── Stats ─────────────────────────────────────────────────────

  private computeStats(nodes: string[]): SimilarityStats {
    const nodeCount = nodes.length;
    const edgeCount = this.edges.size;
    const maxEdges = nodeCount * (nodeCount - 1);
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;
    const avgEdgesPerNode = nodeCount > 0 ? edgeCount / nodeCount : 0;

    return {
      nodeCount,
      edgeCount,
      density,
      avgEdgesPerNode,
    };
  }
}
