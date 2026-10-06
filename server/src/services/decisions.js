// Records administrative and staff decisions with actor, timestamp and reason
// (FR10). A REVIEWS row targets exactly one user, project or document (the DB
// CHECK constraint enforces this); the audit log gets a matching entry.
const { Review, Introduction } = require('../models');
const audit = require('./audit');

async function recordDecision({ reviewerId, decision, reason = null, target, action, metadata = null }, transaction) {
  const targetKey = { user: 'subjectUserId', project: 'projectId', document: 'documentId' }[target.type];
  if (!targetKey) throw new Error(`Unknown review target ${target.type}`);
  await Review.create({ reviewerId, decision, reason, [targetKey]: target.id }, { transaction });
  await audit.record(
    { actorId: reviewerId, action, entityType: target.type, entityId: target.id, reason, metadata },
    { transaction }
  );
}

// Distinct investors whose investment both they and the graduate confirmed (FR13).
async function confirmedInvestorCount(projectId, transaction) {
  return Introduction.count({
    where: { projectId, investmentInvestorConfirmed: true, investmentGraduateConfirmed: true },
    distinct: true,
    col: 'investor_id',
    transaction,
  });
}

module.exports = { recordDecision, confirmedInvestorCount };
