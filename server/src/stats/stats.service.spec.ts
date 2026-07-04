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
      const now = new Date();
      const thisY = now.getUTCFullYear();
      const thisM = now.getUTCMonth() + 1;
      const prevM = thisM === 1 ? 12 : thisM - 1;
      const prevY = thisM === 1 ? thisY - 1 : thisY;

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
          { _id: thisY, pages: 1500, books: 5 }
        ])
        .mockResolvedValueOnce([
          { _id: { year: prevY, month: prevM } },
          { _id: { year: thisY, month: thisM } }
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
            finishedAt: new Date(),
            genres: ['Sci-Fi']
          }
        ])
      });

      const result = await service.overview(thisY);
      expect(result.totals.booksRead).toBe(5);
      expect(result.byYear).toEqual([{ year: thisY, pages: 1500, books: 5 }]);
      expect(result.currentlyReading[0].title).toBe('Mock Book');
      expect(result.recentFinished[0].title).toBe('Mock Book');
      expect(result.currentStreak).toBe(2);
    });

    it('should calculate consecutive months across year boundaries', async () => {
      bookModelMock.aggregate
        .mockResolvedValueOnce([
          {
            booksRead: 1,
            pagesRead: 300,
            avgRating: 4.0,
            fiveStarCount: 0,
            r5: 0, r4_5: 0, r4: 0, r3_5: 0, r3: 0, r2_5: 0, r2: 0, r1_5: 0, r1: 0, r0_5: 0
          }
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { _id: { year: 2024, month: 12 } },
          { _id: { year: 2025, month: 1 } }
        ]);

      bookModelMock.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      });

      const result = await service.overview(2025);
      expect(result.longestStreak).toBe(2);
    });

    it('should handle zero checkMonth transition across year boundary when current month is January', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2025-01-15T12:00:00Z'));
      try {
        bookModelMock.aggregate
          .mockResolvedValueOnce([
            {
              booksRead: 1,
              pagesRead: 300,
              avgRating: 4.0,
              fiveStarCount: 0,
              r5: 0, r4_5: 0, r4: 0, r3_5: 0, r3: 0, r2_5: 0, r2: 0, r1_5: 0, r1: 0, r0_5: 0
            }
          ])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { _id: { year: 2024, month: 12 } },
            { _id: { year: 2025, month: 1 } }
          ]);

        bookModelMock.find.mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([])
        });

        const result = await service.overview(2025);
        expect(result.currentStreak).toBe(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should return empty totals if no book matched', async () => {
      bookModelMock.aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      bookModelMock.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      });

      const result = await service.overview(2025);
      expect(result.totals.booksRead).toBe(0);
      expect(result.longestStreak).toBe(0);
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
            title: 'Mock Book 1',
            authors: ['Author A'],
            format: 'physical',
            status: 'read',
            pageCount: 300,
            startedAt: new Date('2025-06-01'),
            finishedAt: new Date('2025-06-05'),
            genres: ['Sci-Fi', 'Sci-Fi', 'Fantasy']
          },
          {
            _id: '456',
            title: 'Mock Book 2',
            authors: ['Author B'],
            format: 'ebook',
            status: 'read',
            pageCount: 200,
            startedAt: new Date('2025-06-01'),
            finishedAt: new Date('2025-06-10'),
            genres: []
          },
          {
            _id: '789',
            title: 'Mock Book 3',
            authors: ['Author C'],
            status: 'read',
            finishedAt: null
          },
          {
            _id: 'abc',
            title: 'Mock Book 4',
            authors: ['Author D'],
            status: 'read',
            finishedAt: new Date('2025-06-05'),
            genres: null
          },
          {
            _id: 'def',
            title: 'Mock Book 5',
            authors: ['Author E'],
            status: 'read',
            finishedAt: new Date('2025-06-05'),
            genres: ['Sci-Fi']
          }
        ])
      });

      bookModelMock.aggregate
        .mockResolvedValueOnce([{ totalBooks: 2, totalPages: 500, avgRating: 4.0 }]) // keyStats
        .mockResolvedValueOnce([{ year: 2025, count: 2, pages: 500 }]) // byYear
        .mockResolvedValueOnce([{ month: 6, count: 2, pages: 500 }, { month: 7, count: 0, pages: 0 }]) // monthly
        .mockResolvedValueOnce([{ genre: 'Sci-Fi', count: 1 }]) // genreBreakdown
        .mockResolvedValueOnce([{ format: 'physical', count: 1 }]) // formatBreakdown
        .mockResolvedValueOnce([{ language: 'en', count: 1 }]) // languageBreakdown
        .mockResolvedValueOnce([{ decade: 2020, count: 1 }]); // decadeBreakdown

      const result = await service.allTime();
      expect(result.scope).toBe('all');
      expect(result.books[0].title).toBe('Mock Book 1');
      expect(result.keyStats.totalBooks).toBe(2);
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

    it('should fallback to empty keyStats if not found', async () => {
      bookModelMock.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      });

      bookModelMock.aggregate
        .mockResolvedValueOnce([]) // keyStats
        .mockResolvedValueOnce([]) // monthly
        .mockResolvedValueOnce([]) // genre
        .mockResolvedValueOnce([]) // format
        .mockResolvedValueOnce([]) // lang
        .mockResolvedValueOnce([]); // decade

      userModelMock.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null)
      });

      const result = await service.year(2025);
      expect(result.keyStats.totalBooks).toBe(0);
      expect(result.goal.target).toBe(30); // Default target goal settings fallback
    });
  });

  describe('knowledge', () => {
    it('should aggregate knowledge statistics and cover sorting/fallback branches', async () => {
      bookModelMock.aggregate
        .mockResolvedValueOnce([
          {
            _id: 'Sci-Fi',
            bookCount: 5,
            totalPages: 1500,
            avgRating: 4.5,
            yearsActive: [2025],
            books: [{ id: '123', title: 'B1', coverUrl: null, rating: null }],
            authors: [['Author A'], ['Author A'], ['Author B']]
          },
          {
            _id: 'Fantasy',
            bookCount: 2,
            totalPages: 600,
            avgRating: null,
            yearsActive: [2024],
            books: [
              { id: '456', title: 'B2', coverUrl: 'cover.jpg', rating: 4.0 },
              { id: '789', title: 'B3', coverUrl: null, rating: 5.0 }
            ],
            authors: [['Author C'], ['Author D'], ['Author D']]
          }
        ])
        .mockResolvedValueOnce([{ total: 2100 }]);

      const result = await service.knowledge();
      expect(result.genres.length).toBe(2);
      expect(result.genres[0].genre).toBe('Sci-Fi');
      expect(result.genres[0].depthScore).toBe(100);
      expect(result.genres[1].depthScore).toBeLessThan(100);
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

    it('should handle empty calendar data', async () => {
      sessionsServiceMock.calendarData.mockResolvedValue([]);
      const result = await service.streaks();
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.totalReadingDays).toBe(0);
    });
  });
});
