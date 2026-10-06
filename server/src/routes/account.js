// The signed-in user's own account resources.
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { notFound } = require('../middleware/errors');
const { sendStoredFile } = require('../services/fileDelivery');

const router = express.Router();

// Own profile photo (header avatar). Photos are private: only the owner and
// administrators (/api/admin/users/:id/photo) can load them.
router.get('/photo', requireAuth, async (req, res) => {
  if (!req.user.photoKey) throw notFound('No profile photo.');
  await sendStoredFile(res, {
    storageKey: req.user.photoKey,
    mimeType: req.user.photoKey.endsWith('.png') ? 'image/png' : 'image/jpeg',
    filename: 'profile-photo',
  });
});

module.exports = router;
