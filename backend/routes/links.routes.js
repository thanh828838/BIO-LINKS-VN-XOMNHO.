'use strict';

const router = require('express').Router();
const links = require('../controllers/links.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/links', requireAuth, links.list);
router.post('/links', requireAuth, links.create);
router.put('/links/order', requireAuth, links.reorder);
router.put('/links/:id', requireAuth, links.update);
router.delete('/links/:id', requireAuth, links.remove);

module.exports = router;
