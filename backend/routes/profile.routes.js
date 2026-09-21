'use strict';

const router = require('express').Router();
const profile = require('../controllers/profile.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/profile', requireAuth, profile.getMyProfile);
router.put('/profile', requireAuth, profile.updateMyProfile);
router.get('/preferences', requireAuth, profile.getPreferences);
router.put('/preferences', requireAuth, profile.updatePreferences);
router.get('/u/:username', profile.getPublicProfile);
router.post('/u/:username/clicks', profile.recordClick);

module.exports = router;
