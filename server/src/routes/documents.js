// Private evidence is never served statically; each download is authorised
// per request for the uploader or an administrator (NFR03).
const express = require('express');
const { Document } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { notFound } = require('../middleware/errors');
const storage = require('../services/storage');
const audit = require('../services/audit');

const router = express.Router();

router.get('/:id/file', requireAuth, async (req, res) => {
  const document = await Document.findByPk(req.params.id);
  const allowed = document && (document.uploaderId === req.user.id || (req.user.role === 'admin' && req.user.status === 'active'));
  // Same response for "missing" and "not yours" so ids cannot be probed.
  if (!allowed) throw notFound('Document not found.');

  const buffer = await storage.get(document.storageKey);
  if (req.user.role === 'admin') {
    await audit.record({ actorId: req.user.id, action: 'document.viewed', entityType: 'document', entityId: document.id });
  }
  const safeName = document.originalName.replace(/[^\w.\- ]/g, '_');
  res.set({
    'Content-Type': document.mimeType,
    'Content-Length': buffer.length,
    'Content-Disposition': `inline; filename="${safeName}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(buffer);
});

module.exports = router;
