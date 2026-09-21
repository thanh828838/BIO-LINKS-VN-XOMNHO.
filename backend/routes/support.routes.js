'use strict';

const router = require('express').Router();
const support = require('../controllers/support.controller');
const qr = require('../controllers/qr.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.post('/bugs', support.reportBug);          // công khai — khách cũng báo lỗi được
router.get('/qr', requireAuth, qr.generate);      // render PNG

module.exports = router;
