import { Router } from 'express';
import { prisma } from '../db/client.js';

export const projectsRouter = Router();

projectsRouter.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

projectsRouter.post('/', async (req, res) => {
  try {
    const { name, repoUrl, ecosystem } = req.body;
    if (!name || !ecosystem) {
      return res.status(400).json({ error: 'Name and ecosystem are required.' });
    }
    const project = await prisma.project.create({
      data: {
        name,
        repoUrl: repoUrl || '',
        ecosystem,
      },
    });
    res.status(201).json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
