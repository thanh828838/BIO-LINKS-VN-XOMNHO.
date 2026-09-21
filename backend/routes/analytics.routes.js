'use strict';

const router = require('express').Router();
const analytics = require('../controllers/analytics.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/analytics', requireAuth, analytics.overview);

module.exports = router;
