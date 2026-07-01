import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { getModelToken } from '@nestjs/mongoose';
import { Book } from '../books/book.schema';
import { User } from '../users/user.schema';
import { ReadingSessionsService } from '../reading-sessions/reading-sessions.service';

describe('StatsService', () => {
  let service: StatsService;
  let bookModelMock: any;
  let userModelMock: any;
  let sessionsServiceMock: any;

  beforeEach(async () => {
    bookModelMock = {
      aggregate: jest.fn(),
      find: jest.fn()
    };

    userModelMock = {
      findOne: jest.fn()
    };

    sessionsServiceMock = {
      calendarData: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        {
          provide: getModelToken(Book.name),
          useValue: bookModelMock
        },
        {
          provide: getModelToken(User.name),
          useValue: userModelMock
        },
        {
          provide: ReadingSessionsService,
          useValue: sessionsServiceMock
        }
      ]
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  describe('overview', () => {
    it('should aggregate statistics and return summary', async () => {
      bookModelMock.aggregate
        .mockResolvedValueOnce([
          {
            booksRead: 5,
            pagesRead: 1500,
            avgRating: 4.2,
            fiveStarCount: 2,
            r5: 2, r4_5: 1, r4: 1, r3_5: 1, r3: 0, r2_5: 0, r2: 0, r1_5: 0, r1: 0, r0_5: 0
          }
        ])
        .mockResolvedValueOnce([
          { _id: 2025, pages: 1500, books: 5 }
        ])
        .mockResolvedValueOnce([
          { _id: { year: 2025, month: 6 } },
          { _id: { year: 2025, month: 7 } }
        ]);

      bookModelMock.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: '123',
            title: 'Mock Book',
            authors: ['Author A'],
            format: 'physical',
            status: 'reading',
            finishedAt: new Date('2025-06-15T00:00:00Z'),
            genres: ['Sci-Fi']
          }
        ])
      });

      const result = await service.overview(2025);
      expect(result.totals.booksRead).toBe(5);
      expect(result.byYear).toEqual([{ year: 2025, pages: 1500, books: 5 }]);
      expect(result.currentlyReading[0].title).toBe('Mock Book');
      expect(result.recentFinished[0].title).toBe('Mock Book');
    });
  });

  describe('years', () => {
    it('should query all years count and pages', async () => {
      bookModelMock.aggregate.mockResolvedValue([
        { year: 2025, count: 5, pages: 1500 }
      ]);

      const result = await service.years();
      expect(result).toEqual([{ year: 2025, count: 5, pages: 1500 }]);
    });
  });

  describe('allTime', () => {
    it('should aggregate all-time stats', async () => {
      bookModelMock.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: '123',
            title: 'Mock Book',
            authors: ['Author A'],
            format: 'physical',
            status: 'read',
            pageCount: 300,
            startedAt: new Date('2025-06-01'),
            finishedAt: new Date('2025-06-05'),
            genres: ['Sci-Fi']
          }
        ])
      });

      bookModelMock.aggregate
        .mockResolvedValueOnce([{ totalBooks: 1, totalPages: 300, avgRating: 4.0 }]) // keyStats
        .mockResolvedValueOnce([{ year: 2025, count: 1, pages: 300 }]) // byYear
        .mockResolvedValueOnce([{ month: 6, count: 1, pages: 300 }]) // monthly
        .mockResolvedValueOnce([{ genre: 'Sci-Fi', count: 1 }]) // genreBreakdown
        .mockResolvedValueOnce([{ format: 'physical', count: 1 }]) // formatBreakdown
        .mockResolvedValueOnce([{ language: 'en', count: 1 }]) // languageBreakdown
        .mockResolvedValueOnce([{ decade: 2020, count: 1 }]); // decadeBreakdown

      const result = await service.allTime();
      expect(result.scope).toBe('all');
      expect(result.books[0].title).toBe('Mock Book');
      expect(result.keyStats.totalBooks).toBe(1);
      expect(result.monthly[0].dominantGenre).toBe('Sci-Fi');
    });
  });

  describe('year', () => {
    it('should aggregate specific year stats', async () => {
      bookModelMock.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: '123',
            title: 'Mock Book',
            authors: ['Author A'],
            format: 'physical',
            status: 'read',
            pageCount: 300,
            startedAt: new Date('2025-06-01'),
            finishedAt: new Date('2025-06-05'),
            genres: ['Sci-Fi']
          }
        ])
      });

      bookModelMock.aggregate
        .mockResolvedValueOnce([{ totalBooks: 1, totalPages: 300, avgRating: 4.0 }]) // keyStats
        .mockResolvedValueOnce([{ month: 6, count: 1, pages: 300 }]) // monthly
        .mockResolvedValueOnce([{ genre: 'Sci-Fi', count: 1 }]) // genreBreakdown
        .mockResolvedValueOnce([{ format: 'physical', count: 1 }]) // formatBreakdown
        .mockResolvedValueOnce([{ language: 'en', count: 1 }]) // languageBreakdown
        .mockResolvedValueOnce([{ decade: 2020, count: 1 }]); // decadeBreakdown

      userModelMock.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ settings: { yearlyGoal: 20 } })
      });

      const result = await service.year(2025);
      expect(result.year).toBe(2025);
      expect(result.goal.target).toBe(20);
      expect(result.books[0].title).toBe('Mock Book');
      expect(result.monthly[0].dominantGenre).toBe('Sci-Fi');
    });
  });

  describe('knowledge', () => {
    it('should calculate genre depth and page milestones', async () => {
      bookModelMock.aggregate
        .mockResolvedValueOnce([
          {
            _id: 'Sci-Fi',
            bookCount: 2,
            totalPages: 600,
            avgRating: 4.5,
            yearsActive: [2025],
            books: [
              { id: '1', title: 'SciFi Book 1', coverUrl: null, rating: 3 },
              { id: '2', title: 'SciFi Book 2', coverUrl: null, rating: 5 },
              { id: '3', title: 'SciFi Book 3', coverUrl: null, rating: null }
            ],
            authors: [['Author A'], ['Author B'], [null as any]]
          },
          {
            _id: 'Fantasy',
            bookCount: 1,
            totalPages: 200,
            avgRating: 4.0,
            yearsActive: [2024],
            books: [{ id: '4', title: 'Fantasy Book', coverUrl: null, rating: 4 }],
            authors: [['Author C']]
          }
        ])
        .mockResolvedValueOnce([{ total: 12000 }]);

      const result = await service.knowledge();
      expect(result.genres[0].genre).toBe('Sci-Fi');
      expect(result.genres[0].depthScore).toBe(100);
      expect(result.genres[0].notableBooks[0].title).toBe('SciFi Book 2'); // Highest rating first
      expect(result.genres[0].topAuthors[0].name).toBe('Author A');
      expect(result.pageMilestones).toContain(10000);
    });

    it('should handle zero maxDepth score safely', async () => {
      bookModelMock.aggregate
        .mockResolvedValueOnce([
          {
            _id: 'Unknown',
            bookCount: 0,
            totalPages: 0,
            avgRating: null,
            yearsActive: [],
            books: [],
            authors: []
          }
        ])
        .mockResolvedValueOnce([{ total: 0 }]);

      const result = await service.knowledge();
      expect(result.genres[0].depthScore).toBe(0);
    });
  });

  describe('streaks', () => {
    it('should calculate active streaks from session calendar data', async () => {
      const today = new Date();
      const format = (d: Date) => d.toISOString().slice(0, 10);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const dayBefore = new Date(today);
      dayBefore.setDate(dayBefore.getDate() - 2);

      sessionsServiceMock.calendarData.mockResolvedValue([
        { date: format(dayBefore), pagesRead: 30, sessions: 1 },
        { date: format(yesterday), pagesRead: 20, sessions: 1 },
        { date: format(today), pagesRead: 15, sessions: 1 }
      ]);

      const result = await service.streaks();
      expect(result.currentStreak).toBe(3);
      expect(result.longestStreak).toBe(3);
      expect(result.totalReadingDays).toBe(3);
      expect(result.totalPagesLogged).toBe(65);
    });

    it('should handle gaps in calendar data', async () => {
      const format = (d: Date) => d.toISOString().slice(0, 10);
      const today = new Date();
      
      const day3 = new Date(today);
      day3.setDate(day3.getDate() - 3);

      sessionsServiceMock.calendarData.mockResolvedValue([
        { date: format(day3), pagesRead: 30, sessions: 1 },
        { date: format(today), pagesRead: 15, sessions: 1 }
      ]);

      const result = await service.streaks();
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
      expect(result.totalReadingDays).toBe(2);
    });
  });
});
