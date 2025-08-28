import express from 'express';

const router = express.Router();

router.post('/', (req, res) => {
  // Fire-and-forget audit sink; ignore payload for now
  res.status(204).end();
});

export default router;
