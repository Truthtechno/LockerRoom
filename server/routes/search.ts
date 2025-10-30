import { z } from 'zod';
import { ilike, desc } from 'drizzle-orm';

const searchSchema = z.object({
  q: z.string().trim().min(2).max(50).regex(/[a-zA-Z0-9\s.'-]+/),
  limit: z.coerce.number().min(1).max(25).default(10),
});

app.get('/api/search/students', async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'validation_error', message: 'Search query required' } });
  }
  const { q, limit } = parsed.data;

  const results = await db.select({
      id: students.id,
      name: students.name,
      schoolId: students.schoolId
    })
    .from(students)
    .where(ilike(students.name, `%${q}%`))
    .limit(limit)
    .orderBy(desc(students.createdAt));

  return res.json(results);
});