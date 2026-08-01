import StoredSolution from '@/lib/models/StoredSolution.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import {
  boolValue,
  intValue,
  optionalString,
  requireString,
  stringArray,
  validators,
} from '../lib/validation.js';

/** @returns {import('../types/index.js').StoredSolutionDTO} */
export function serializeSolution(doc) {
  return {
    id: String(doc._id),
    problemName: doc.problemName,
    problemUrl: doc.problemUrl,
    language: doc.language,
    sourceCode: doc.sourceCode,
    difficulty: doc.difficulty,
    tags: doc.tags || [],
    favorite: !!doc.favorite,
    notes: doc.notes || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Paginated, filterable list. Search matches problem name and tags.
 * @returns {Promise<{ items: object[], total: number, page: number, pageSize: number, pages: number }>}
 */
export async function listSolutions(username, query = {}) {
  const page = intValue(query.page, { min: 1, max: 100000, fallback: 1 });
  const pageSize = intValue(query.pageSize, { min: 1, max: 100, fallback: DEFAULT_PAGE_SIZE });

  const filter = { username };

  const search = optionalString(query.search, { max: 100 });
  if (search) {
    const re = new RegExp(escapeRegExp(search), 'i');
    filter.$or = [{ problemName: re }, { tags: re }];
  }
  if (query.language && query.language !== 'all') filter.language = query.language;
  if (query.difficulty && query.difficulty !== 'all') filter.difficulty = query.difficulty;
  if (query.tag) filter.tags = query.tag;
  if (query.favorite === 'true' || query.favorite === true) filter.favorite = true;

  const total = await StoredSolution.countDocuments(filter);
  const items = await StoredSolution.find(filter)
    .sort({ favorite: -1, updatedAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();

  return {
    items: items.map(serializeSolution),
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getSolution(username, id) {
  const doc = await StoredSolution.findOne({ _id: id, username });
  return doc ? serializeSolution(doc) : null;
}

function normalizeBody(body, { partial = false } = {}) {
  const out = {};
  if (!partial || 'problemName' in body) out.problemName = requireString(body.problemName, 'Problem name', { max: 300 });
  if (!partial || 'sourceCode' in body) out.sourceCode = requireString(body.sourceCode, 'Source code', { max: 100000, trim: false });
  if (!partial || 'problemUrl' in body) out.problemUrl = optionalString(body.problemUrl, { max: 500 });
  if (!partial || 'language' in body) out.language = validators.language(body.language);
  if (!partial || 'difficulty' in body) out.difficulty = validators.difficulty(body.difficulty);
  if (!partial || 'tags' in body) out.tags = stringArray(body.tags);
  if (!partial || 'favorite' in body) out.favorite = boolValue(body.favorite, false);
  if (!partial || 'notes' in body) out.notes = optionalString(body.notes, { max: 5000 });
  return out;
}

export async function createSolution(username, body) {
  const data = normalizeBody(body);
  const doc = await StoredSolution.create({ username, ...data });
  return serializeSolution(doc);
}

export async function updateSolution(username, id, body) {
  const data = normalizeBody(body, { partial: true });
  const doc = await StoredSolution.findOneAndUpdate(
    { _id: id, username },
    { $set: data },
    { new: true }
  );
  return doc ? serializeSolution(doc) : null;
}

export async function deleteSolution(username, id) {
  const res = await StoredSolution.deleteOne({ _id: id, username });
  return res.deletedCount > 0;
}

/**
 * Chooses the next solution to run given the rotation strategy.
 * @returns {Promise<{ solution: object | null, nextCursor: number }>}
 */
export async function pickNextSolution(username, settings) {
  if (settings.rotation === 'specific' && settings.specificSolutionId) {
    const doc = await StoredSolution.findOne({ _id: settings.specificSolutionId, username }).lean();
    return { solution: doc ? serializeSolution(doc) : null, nextCursor: settings.sequentialCursor || 0 };
  }

  const all = await StoredSolution.find({ username }).sort({ createdAt: 1 }).lean();
  if (!all.length) return { solution: null, nextCursor: 0 };

  if (settings.rotation === 'random') {
    const pick = all[Math.floor(Math.random() * all.length)];
    return { solution: serializeSolution(pick), nextCursor: settings.sequentialCursor || 0 };
  }

  // sequential
  const cursor = (settings.sequentialCursor || 0) % all.length;
  const pick = all[cursor];
  return { solution: serializeSolution(pick), nextCursor: (cursor + 1) % all.length };
}
