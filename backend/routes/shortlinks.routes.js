'use strict';

const router = require('express').Router();
const shortlinks = require('../controllers/shortlink.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/shortlinks', requireAuth, shortlinks.list);
router.post('/shortlinks', requireAuth, shortlinks.create);
router.put('/shortlinks/:id', requireAuth, shortlinks.update);
router.delete('/shortlinks/:id', requireAuth, shortlinks.remove);

module.exports = router;
