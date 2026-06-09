// @lifecycle ACTIVE — Unit tests for AskIngestService
import { Test, TestingModule } from '@nestjs/testing';
import { AskIngestService } from '../services/ask-ingest.service';
import { RecommendationService } from '../services/recommendation.service';

describe('AskIngestService', () => {
  let service: AskIngestService;
  let recommendationService: { create: jest.Mock };

  const mockRecommendationService = {
    create: jest.fn(),
  };

  const validRecord = `---RECOMMENDATION-RECORD---
rec_id: REC-20260607-a1b2c3d4
mode: ADVISOR
decision_type: TC
decision_domain: queue-system
query_summary: "Should we use BullMQ?"
project_id: floweng
recommended_option: BullMQ
confidence_level: HIGH
confidence_score: 82
justification: BullMQ is mature and well-supported
weighted_score: 4.5
---END-RECORD---`;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AskIngestService,
        { provide: RecommendationService, useValue: mockRecommendationService },
      ],
    }).compile();

    service = module.get<AskIngestService>(AskIngestService);
    recommendationService = module.get(RecommendationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseStructuredRecord', () => {
    it('should parse a valid structured record', () => {
      const result = service.parseStructuredRecord(validRecord);

      expect(result).not.toBeNull();
      expect(result!['rec_id']).toBe('REC-20260607-a1b2c3d4');
      expect(result!['mode']).toBe('ADVISOR');
      expect(result!['decision_type']).toBe('TC');
      expect(result!['decision_domain']).toBe('queue-system');
      expect(result!['recommended_option']).toBe('BullMQ');
      expect(result!['confidence_level']).toBe('HIGH');
      expect(result!['confidence_score']).toBe('82');
    });

    it('should strip surrounding quotes from values', () => {
      const text = `---RECOMMENDATION-RECORD---
query_summary: "Should we use BullMQ?"
---END-RECORD---`;

      const result = service.parseStructuredRecord(text);

      expect(result).not.toBeNull();
      expect(result!['query_summary']).toBe('Should we use BullMQ?');
    });

    it('should return null when no RECOMMENDATION-RECORD is present', () => {
      const result = service.parseStructuredRecord('Just some random text without delimiters');

      expect(result).toBeNull();
    });

    it('should return null when text is empty', () => {
      const result = service.parseStructuredRecord('');

      expect(result).toBeNull();
    });

    it('should handle partial record with missing END-RECORD', () => {
      const text = `---RECOMMENDATION-RECORD---
rec_id: REC-001
mode: ADVISOR`;

      const result = service.parseStructuredRecord(text);

      expect(result).toBeNull();
    });

    it('should skip empty lines and lines without colon', () => {
      const text = `---RECOMMENDATION-RECORD---
rec_id: REC-001
mode: ADVISOR

no-colon-line
key_only:
---END-RECORD---`;

      const result = service.parseStructuredRecord(text);

      expect(result).not.toBeNull();
      expect(result!['rec_id']).toBe('REC-001');
      expect(result!['mode']).toBe('ADVISOR');
      // key_only with empty value should be present
      expect(result!['key_only']).toBe('');
    });

    it('should preserve extra whitespace around keys and values', () => {
      const text = `---RECOMMENDATION-RECORD---
  rec_id  :  REC-001  ---END-RECORD---`;

      const result = service.parseStructuredRecord(text);

      expect(result).not.toBeNull();
      expect(result!['rec_id']).toBe('REC-001');
    });
  });

  describe('fieldsToDto', () => {
    it('should convert valid fields to CreateRecommendationDto (without analytics)', () => {
      const fields: Record<string, string> = {
        rec_id: 'REC-001',
        mode: 'ADVISOR',
        decision_type: 'TC',
        decision_domain: 'database',
        query_summary: 'Which DB to use?',
        recommended_option: 'PostgreSQL',
        confidence_level: 'HIGH',
        confidence_score: '85',
        weighted_score: '4.2',
        score_margin: '0.5',
        justification: 'Best fit for structured data',
        project_id: 'floweng',
      };

      // Access private method via type cast
      const dto = (service as unknown as { fieldsToDto: (fields: Record<string, string>) => Record<string, unknown> | null }).fieldsToDto(fields);

      expect(dto).not.toBeNull();
      expect(dto!.recId).toBe('REC-001');
      expect(dto!.mode).toBe('ADVISOR');
      expect(dto!.decisionType).toBe('TC');
      // Analytics fields are NOT in the DTO
      expect(dto!.confidenceScore).toBeUndefined();
      expect(dto!.weightedScore).toBeUndefined();
      expect(dto!.scoreMargin).toBeUndefined();
    });

    it('should return null when required field is missing', () => {
      const fields: Record<string, string> = {
        rec_id: 'REC-001',
        mode: 'ADVISOR',
        // Missing decision_type
        decision_domain: 'database',
        query_summary: 'Which DB?',
        recommended_option: 'PostgreSQL',
        confidence_level: 'HIGH',
      };

      const dto = (service as unknown as { fieldsToDto: (fields: Record<string, string>) => Record<string, unknown> | null }).fieldsToDto(fields);

      expect(dto).toBeNull();
    });

    it('should handle optional fields with defaults', () => {
      const fields: Record<string, string> = {
        rec_id: 'REC-001',
        mode: 'ADVISOR',
        decision_type: 'TC',
        decision_domain: 'database',
        query_summary: 'Which DB?',
        recommended_option: 'PostgreSQL',
        confidence_level: 'HIGH',
      };

      const dto = (service as unknown as { fieldsToDto: (fields: Record<string, string>) => Record<string, unknown> | null }).fieldsToDto(fields);

      expect(dto).not.toBeNull();
      expect(dto!.constraints).toEqual([]); // default
      expect(dto!.sourcesConsulted).toEqual([]); // default
      expect(dto!.projectId).toBeUndefined();
    });

    it('should parse comma-separated constraints', () => {
      const fields: Record<string, string> = {
        rec_id: 'REC-001',
        mode: 'ADVISOR',
        decision_type: 'TC',
        decision_domain: 'database',
        query_summary: 'Which DB?',
        recommended_option: 'PostgreSQL',
        confidence_level: 'HIGH',
        constraints: 'cost, performance, scalability',
      };

      const dto = (service as unknown as { fieldsToDto: (fields: Record<string, string>) => Record<string, unknown> | null }).fieldsToDto(fields);

      expect(dto).not.toBeNull();
      expect((dto as Record<string, unknown>).constraints).toEqual(['cost', 'performance', 'scalability']);
    });

    it('should handle unknowns optional numeric fields', () => {
      const fields: Record<string, string> = {
        rec_id: 'REC-001',
        mode: 'ADVISOR',
        decision_type: 'TC',
        decision_domain: 'database',
        query_summary: 'Which DB?',
        recommended_option: 'PostgreSQL',
        confidence_level: 'HIGH',
        unknowns_count: '3',
        unknowns_critical: '1',
      };

      const dto = (service as unknown as { fieldsToDto: (fields: Record<string, string>) => Record<string, unknown> | null }).fieldsToDto(fields);

      expect(dto).not.toBeNull();
      expect((dto as Record<string, unknown>).unknownsCount).toBe(3);
      expect((dto as Record<string, unknown>).unknownsCritical).toBe(1);
    });
  });

  describe('buildAnalytics', () => {
    it('should build analytics from parsed fields', () => {
      const fields: Record<string, string> = {
        confidence_score: '85',
        weighted_score: '4.2',
        score_margin: '0.5',
        ecs: '70',
        sqs: '65',
        cs: '80',
      };

      const analytics = service.buildAnalytics(fields);

      expect(analytics.confidenceScore).toBe(85);
      expect(analytics.weightedScore).toBe(4.2);
      expect(analytics.scoreMargin).toBe(0.5);
      expect(analytics.ecs).toBe(70);
      expect(analytics.sqs).toBe(65);
      expect(analytics.cs).toBe(80);
    });

    it('should use defaults when optional analytics fields are missing', () => {
      const fields: Record<string, string> = {
        confidence_score: '85',
      };

      const analytics = service.buildAnalytics(fields);

      expect(analytics.confidenceScore).toBe(85);
      expect(analytics.weightedScore).toBe(3.0); // default
      expect(analytics.scoreMargin).toBe(0);     // default
      expect(analytics.ecs).toBeUndefined();
      expect(analytics.sqs).toBeUndefined();
      expect(analytics.cs).toBeUndefined();
    });

    it('should default confidenceScore to 0 when invalid', () => {
      const fields: Record<string, string> = {
        confidence_score: 'not-a-number',
      };

      const analytics = service.buildAnalytics(fields);

      expect(analytics.confidenceScore).toBe(0);
    });

    it('should handle missing fields gracefully', () => {
      const analytics = service.buildAnalytics({});

      expect(analytics.confidenceScore).toBe(0);
      expect(analytics.weightedScore).toBe(3.0);
      expect(analytics.scoreMargin).toBe(0);
      expect(analytics.ecs).toBeUndefined();
      expect(analytics.sqs).toBeUndefined();
      expect(analytics.cs).toBeUndefined();
    });
  });

  describe('ingestFromText', () => {
    const mockCreatedRecommendation = {
      id: 'rec-uuid-1',
      recId: 'REC-20260607-a1b2c3d4',
      mode: 'ADVISOR',
    };

    it('should successfully ingest a valid record', async () => {
      mockRecommendationService.create.mockResolvedValue(mockCreatedRecommendation);

      const result = await service.ingestFromText(validRecord);

      expect(result.success).toBe(true);
      expect(result.recommendation).toEqual(mockCreatedRecommendation);
      expect(mockRecommendationService.create).toHaveBeenCalledTimes(1);
      // Verify analytics is passed as second argument
      const [dto, analytics] = mockRecommendationService.create.mock.calls[0];
      expect(analytics).toBeDefined();
      expect(analytics.confidenceScore).toBe(82);
      expect(analytics.weightedScore).toBe(4.5);
    });

    it('should return error when no valid record found', async () => {
      const result = await service.ingestFromText('invalid text with no record');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid RECOMMENDATION-RECORD');
      expect(mockRecommendationService.create).not.toHaveBeenCalled();
    });

    it('should return error when fields cannot be converted to DTO', async () => {
      const incompleteRecord = `---RECOMMENDATION-RECORD---
rec_id: REC-001
mode: ADVISOR
---END-RECORD---`;

      const result = await service.ingestFromText(incompleteRecord);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to convert');
      expect(mockRecommendationService.create).not.toHaveBeenCalled();
    });

    it('should propagate RecommendationService errors', async () => {
      mockRecommendationService.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(service.ingestFromText(validRecord)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
