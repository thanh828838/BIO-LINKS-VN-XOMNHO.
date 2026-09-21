'use strict';

const router = require('express').Router();
const auth = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.get('/me', auth.me);
router.post('/password', requireAuth, auth.changePassword);
router.post('/account/delete', requireAuth, auth.deleteAccount);
router.post('/sessions/revoke-all', requireAuth, auth.revokeAllSessions);
router.get('/export', requireAuth, auth.exportData);

module.exports = router;
