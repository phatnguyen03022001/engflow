/* @lifecycle ACTIVE — RuleFileParser: parse .rules.md files into section-level AST (TASK-060) */

import * as fs from 'fs';
import * as path from 'path';
import { RuleSection, RuleFileAST } from '../ir/types';

export const STOP_WORDS = new Set([
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

export class RuleFileParser {
  parse(filePath: string): RuleFileAST {
    const content = fs.readFileSync(filePath, 'utf-8');
    const tags = this.extractTags(content);
    const stripped = this.stripMetadata(content);
    const sections = this.extractSections(stripped, filePath, tags);

    const relativePath = path.relative(
      path.resolve(__dirname, '..', '..', 'rules'),
      filePath,
    );

    return { file: relativePath, tags, sections };
  }

  private extractTags(content: string): string[] {
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      const match = trimmed.match(/^\/\*\s*@tags\s+(.+?)\s*\*\/\s*$/);
      if (match) {
        return match[1].split(',').map((t) => t.trim()).filter(Boolean);
      }
    }
    return [];
  }

  private stripMetadata(content: string): string {
    return content
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith('/* @lifecycle') && !t.startsWith('/* @tags');
      })
      .join('\n');
  }

  private extractSections(
    content: string,
    filePath: string,
    tags: string[],
  ): RuleSection[] {
    const lines = content.split('\n');
    const sections: RuleSection[] = [];

    const fileStem = path.basename(filePath, path.extname(filePath));

    // Find heading positions and their levels
    interface HeadingMarker {
      lineIndex: number;
      level: number;
      rawText: string;
    }

    const headings: HeadingMarker[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ') || line.startsWith('##\t')) {
        headings.push({
          lineIndex: i,
          level: 2,
          rawText: line.replace(/^##\s+/, ''),
        });
      } else if (line.startsWith('### ') || line.startsWith('###\t')) {
        headings.push({
          lineIndex: i,
          level: 3,
          rawText: line.replace(/^###\s+/, ''),
        });
      }
    }

    if (headings.length === 0) {
      const headerBody = lines.join('\n').trim();
      if (headerBody) {
        sections.push(this.makeSection(
          `${fileStem}.header`,
          filePath,
          'Document Header',
          1,
          headerBody,
          tags,
        ));
      }
      return sections;
    }

    const usedIds = new Set<string>();

    function uniqueId(base: string): string {
      let candidate = base;
      let counter = 2;
      while (usedIds.has(candidate)) {
        candidate = `${base}_${counter}`;
        counter++;
      }
      usedIds.add(candidate);
      return candidate;
    }

    // Content before first heading → document header
    const firstHeading = headings[0];
    if (firstHeading.lineIndex > 0) {
      const headerLines = lines.slice(0, firstHeading.lineIndex);
      const headerText = headerLines.join('\n').trim();
      if (headerText) {
        const id = uniqueId(`${fileStem}.header`);
        sections.push(this.makeSection(id, filePath, 'Document Header', 1, headerText, tags));
      }
    }

    // Process each heading
    for (let h = 0; h < headings.length; h++) {
      const heading = headings[h];
      const startLine = heading.lineIndex + 1;

      let endLine = lines.length;
      for (let n = h + 1; n < headings.length; n++) {
        if (headings[n].level <= heading.level) {
          endLine = headings[n].lineIndex;
          break;
        }
      }

      const bodyLines = lines.slice(startLine, endLine);
      const body = bodyLines.join('\n').trim();

      const cleanTitle = this.cleanTitle(heading.rawText);
      const headingNumber = this.extractHeadingNumber(heading.rawText);
      const slug = this.slugify(cleanTitle);
      const baseId = `${fileStem}.${slug}`;
      const id = uniqueId(baseId);

      sections.push(this.makeSection(id, filePath, cleanTitle, heading.level, body, tags, headingNumber));
    }

    return sections;
  }

  private makeSection(
    id: string,
    filePath: string,
    title: string,
    level: number,
    content: string,
    tags: string[],
    headingNumber?: string,
  ): RuleSection {
    const source = path.basename(filePath);
    return {
      id,
      source,
      title,
      headingNumber,
      level,
      content,
      tokensEst: Math.ceil(content.length / 4),
      tags,
      relevanceScore: 0,
      priority: 'medium',
    };
  }

  cleanTitle(raw: string): string {
    return raw
      .replace(/^\d+(?:\.\d+)*\s*[.\s]\s*/, '')
      .replace(/^[#\s]+/, '')
      .trim();
  }

  slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  extractHeadingNumber(raw: string): string | undefined {
    const match = raw.match(/^(\d+(?:\.\d+)*)/);
    return match ? match[1] : undefined;
  }

  extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return [...new Set(words.filter((w) => w.length > 2 && !STOP_WORDS.has(w)))];
  }
}
