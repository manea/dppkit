import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

function makeError(message, code, statusCode) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

export function slugify(input, fallback = 'passport') {
  const cleaned = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function openDppDatabase(dataDir) {
  const resolvedDataDir = path.resolve(dataDir);
  fs.mkdirSync(resolvedDataDir, { recursive: true });

  const dbPath = path.join(resolvedDataDir, 'dppkit.sqlite');
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS dossiers (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      dossier_code TEXT UNIQUE,
      status TEXT NOT NULL,
      category TEXT NOT NULL,
      dossier_json TEXT NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dossiers_status ON dossiers(status);
    CREATE INDEX IF NOT EXISTS idx_dossiers_updated ON dossiers(updated_at DESC);

    CREATE TABLE IF NOT EXISTS operator_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_operator_profiles_updated ON operator_profiles(updated_at DESC);

    CREATE TABLE IF NOT EXISTS dossier_counters (
      year INTEGER PRIMARY KEY,
      last_seq INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dossier_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id TEXT NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dossier_events ON dossier_events(dossier_id, id DESC);
  `);

  function ensureUniqueSlug(desiredSlug, excludeId = null) {
    const base = slugify(desiredSlug, 'passport');
    let candidate = base;
    let suffix = 2;
    const checkStmt = db.prepare('SELECT id FROM dossiers WHERE slug = ?');
    while (true) {
      const existing = checkStmt.get(candidate);
      if (!existing || (excludeId && existing.id === excludeId)) {
        return candidate;
      }
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  function insertEvent(dossierId, eventType, actor, meta = {}, createdAt = new Date().toISOString()) {
    db.prepare(
      'INSERT INTO dossier_events (dossier_id, event_type, actor, meta_json, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(dossierId, eventType, actor, JSON.stringify(meta), createdAt);
  }

  function findDossierRowByKey(key) {
    return db
      .prepare('SELECT * FROM dossiers WHERE id = ? OR slug = ? OR dossier_code = ?')
      .get(key, key, key);
  }

  function hydrateBundle(row) {
    if (!row) return null;
    const dossier = parseJsonSafe(row.dossier_json, null);
    if (!dossier) return null;

    const events = db
      .prepare(
        'SELECT id, dossier_id, event_type, actor, meta_json, created_at FROM dossier_events WHERE dossier_id = ? ORDER BY id DESC LIMIT 30',
      )
      .all(dossier.id)
      .map((ev) => ({
        id: ev.id,
        dossierId: ev.dossier_id,
        eventType: ev.event_type,
        actor: ev.actor,
        meta: parseJsonSafe(ev.meta_json, {}),
        createdAt: ev.created_at,
      }));

    return {
      dossier,
      status: row.status,
      slug: row.slug,
      viewCount: Number(row.view_count || 0),
      dossierEvents: events,
    };
  }

  function getStats() {
    const totalRow = db.prepare('SELECT COUNT(*) AS cnt FROM dossiers').get();
    const byStatusRows = db.prepare('SELECT status, COUNT(*) AS cnt FROM dossiers GROUP BY status').all();
    const profRow = db.prepare('SELECT COUNT(*) AS cnt FROM operator_profiles').get();
    let draftDossiers = 0;
    let lockedDossiers = 0;
    for (const row of byStatusRows) {
      if (row.status === 'draft') draftDossiers = Number(row.cnt || 0);
      if (row.status === 'locked') lockedDossiers = Number(row.cnt || 0);
    }
    return {
      totalDossiers: Number(totalRow?.cnt || 0),
      draftDossiers,
      lockedDossiers,
      operatorProfilesCount: Number(profRow?.cnt || 0),
    };
  }

  function listDossiers() {
    const rows = db
      .prepare(
        'SELECT id, slug, dossier_code, status, category, dossier_json, view_count, created_at, updated_at FROM dossiers ORDER BY updated_at DESC',
      )
      .all();

    return rows
      .map((row) => {
        const dossier = parseJsonSafe(row.dossier_json, null);
        if (!dossier) return null;
        return {
          id: row.id,
          slug: row.slug,
          dossierCode: row.dossier_code ?? (dossier.dossierCode || null),
          status: row.status,
          category: row.category,
          viewCount: Number(row.view_count || 0),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          dossier,
        };
      })
      .filter((entry) => entry !== null);
  }

  function getDossierById(id) {
    const row = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(id);
    return hydrateBundle(row);
  }

  function getDossierBySlugOrCode(slugOrCode, { incrementView = false } = {}) {
    const row = db
      .prepare('SELECT * FROM dossiers WHERE slug = ? OR dossier_code = ? OR id = ?')
      .get(slugOrCode, slugOrCode, slugOrCode);
    if (!row) return null;
    if (incrementView) {
      db.prepare('UPDATE dossiers SET view_count = view_count + 1 WHERE id = ?').run(row.id);
      return getDossierById(row.id);
    }
    return hydrateBundle(row);
  }

  function createDossier(dossierInput, actor = 'engineering') {
    const now = dossierInput.createdAt || new Date().toISOString();
    const id = dossierInput.id || `dpp-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const uniqueSlug = ensureUniqueSlug(
      dossierInput.slug || dossierInput.battery?.modelIdentifier || dossierInput.battery?.modelName || id,
      id,
    );
    const category = dossierInput.battery?.category || 'ev';
    const dossier = {
      ...dossierInput,
      id,
      slug: uniqueSlug,
      status: 'draft',
      dossierCode: '',
      digestHex: '',
      sealedAtIso: '',
      createdAt: now,
      updatedAtIso: dossierInput.updatedAtIso || now,
    };

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `INSERT INTO dossiers
         (id, slug, dossier_code, status, category, dossier_json, view_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      ).run(
        dossier.id,
        dossier.slug,
        null,
        'draft',
        category,
        JSON.stringify(dossier),
        now,
        dossier.updatedAtIso,
      );

      insertEvent(
        dossier.id,
        'DOSSIER_CREATED',
        actor,
        {
          slug: dossier.slug,
          category,
          overallScore: dossier.summary?.overallScore ?? 0,
          readinessTier: dossier.summary?.readinessTier ?? 'blocked',
        },
        now,
      );
      db.exec('COMMIT');
      return getDossierById(dossier.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  function updateDossier(id, mutatorFn, actor = 'engineering', eventType = 'DOSSIER_UPDATED') {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = findDossierRowByKey(id);
      if (!row) {
        db.exec('ROLLBACK');
        return null;
      }
      const current = parseJsonSafe(row.dossier_json, null);
      if (!current) {
        db.exec('ROLLBACK');
        return null;
      }
      if (current.status === 'locked' || row.status === 'locked') {
        throw makeError(
          'Finalized battery passport dossier is sealed against mutation.',
          'DOSSIER_LOCKED',
          409,
        );
      }

      const next = mutatorFn(current);
      if (!next) {
        db.exec('ROLLBACK');
        return null;
      }

      const uniqueSlug = ensureUniqueSlug(next.slug || current.slug, current.id);
      const now = new Date().toISOString();
      const category = next.battery?.category || current.battery?.category || 'ev';
      const updated = {
        ...next,
        id: current.id,
        slug: uniqueSlug,
        status: 'draft',
        dossierCode: '',
        digestHex: '',
        sealedAtIso: '',
        createdAt: current.createdAt || row.created_at,
        updatedAtIso: now,
      };

      db.prepare('UPDATE dossiers SET slug = ?, category = ?, dossier_json = ?, updated_at = ? WHERE id = ?').run(
        updated.slug,
        category,
        JSON.stringify(updated),
        updated.updatedAtIso,
        current.id,
      );

      insertEvent(
        current.id,
        eventType,
        actor,
        {
          category,
          overallScore: updated.summary?.overallScore ?? 0,
          readinessTier: updated.summary?.readinessTier ?? 'blocked',
        },
        now,
      );
      db.exec('COMMIT');
      return getDossierById(current.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  function deleteDossier(id) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = findDossierRowByKey(id);
      if (!row) {
        db.exec('ROLLBACK');
        return { deleted: false };
      }
      if (row.status === 'locked') {
        throw makeError(
          'Locked battery passport dossier cannot be deleted; duplicate it into a new editable draft instead.',
          'DOSSIER_LOCKED',
          409,
        );
      }
      db.prepare('DELETE FROM dossiers WHERE id = ?').run(row.id);
      db.exec('COMMIT');
      return { deleted: true, id: row.id };
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  function duplicateDossier(id, actor = 'engineering') {
    const sourceBundle = getDossierById(id) || getDossierBySlugOrCode(id);
    if (!sourceBundle) return null;
    const src = sourceBundle.dossier;
    const now = new Date().toISOString();
    const suffix = crypto.randomBytes(2).toString('hex');
    const newId = `dpp-${Date.now().toString(36)}-${suffix}`;
    const cloned = {
      ...src,
      id: newId,
      slug: `${slugify(src.slug || src.battery?.modelIdentifier, 'passport')}-copy-${suffix}`,
      dossierCode: '',
      digestHex: '',
      sealedAtIso: '',
      battery: {
        ...src.battery,
        modelName: `${src.battery.modelName} (Copy)`,
      },
      status: 'draft',
      createdAt: now,
      updatedAtIso: now,
    };
    return createDossier(cloned, actor);
  }

  function finalizeDossier(id, buildCanonicalTextFn, actor = 'engineering') {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = findDossierRowByKey(id);
      if (!row) {
        db.exec('ROLLBACK');
        return null;
      }
      const current = parseJsonSafe(row.dossier_json, null);
      if (!current) {
        db.exec('ROLLBACK');
        return null;
      }
      if (current.status === 'locked' || row.status === 'locked') {
        throw makeError('Battery passport dossier is already finalized.', 'ALREADY_LOCKED', 409);
      }

      const now = new Date().toISOString();
      const year = new Date().getUTCFullYear();
      db.prepare(
        'INSERT INTO dossier_counters (year, last_seq) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1',
      ).run(year);
      const seqRow = db.prepare('SELECT last_seq FROM dossier_counters WHERE year = ?').get(year);
      const seq = Number(seqRow?.last_seq || 1);
      const dossierCode = `DPP-${year}-${String(seq).padStart(4, '0')}`;

      const preDigestDossier = {
        ...current,
        dossierCode,
      };
      const canonical = buildCanonicalTextFn(preDigestDossier);
      const digestHex = sha256Hex(canonical);

      const lockedDossier = {
        ...preDigestDossier,
        digestHex,
        status: 'locked',
        sealedAtIso: now,
        updatedAtIso: now,
      };

      db.prepare(
        'UPDATE dossiers SET dossier_code = ?, status = ?, dossier_json = ?, updated_at = ? WHERE id = ?',
      ).run(dossierCode, 'locked', JSON.stringify(lockedDossier), now, current.id);

      insertEvent(current.id, 'DOSSIER_FINALIZED', actor, { dossierCode, digestHex }, now);

      db.exec('COMMIT');
      return getDossierById(current.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  function listProfiles() {
    return db
      .prepare('SELECT id, name, profile_json, created_at, updated_at FROM operator_profiles ORDER BY updated_at DESC')
      .all()
      .map((row) => ({
        id: row.id,
        name: row.name,
        profile: parseJsonSafe(row.profile_json, {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  function saveProfile(profileInput) {
    const now = new Date().toISOString();
    const id = profileInput.id || `op-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const name = String(profileInput.name || profileInput.manufacturerName || 'EU Battery Operator').trim();
    const profile = {
      manufacturerName: String(profileInput.manufacturerName ?? '').trim(),
      euResponsibleOperator: String(profileInput.euResponsibleOperator ?? '').trim(),
      operatorEoriOrVat: String(profileInput.operatorEoriOrVat ?? '').trim(),
      manufacturingPlantLocation: String(profileInput.manufacturingPlantLocation ?? '').trim(),
      manufacturingCountry: String(profileInput.manufacturingCountry ?? '').trim(),
      gs1Domain: String(profileInput.gs1Domain ?? '').trim(),
      contactEmail: String(profileInput.contactEmail ?? '').trim(),
      declarationOfConformityRef: String(profileInput.declarationOfConformityRef ?? '').trim(),
      dueDiligenceReportUrl: String(profileInput.dueDiligenceReportUrl ?? '').trim(),
    };

    db.prepare(
      `INSERT INTO operator_profiles (id, name, profile_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, profile_json = excluded.profile_json, updated_at = excluded.updated_at`,
    ).run(id, name, JSON.stringify(profile), now, now);

    const row = db.prepare('SELECT id, name, profile_json, created_at, updated_at FROM operator_profiles WHERE id = ?').get(id);
    return {
      id: row.id,
      name: row.name,
      profile: parseJsonSafe(row.profile_json, profile),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function deleteProfile(id) {
    const info = db.prepare('DELETE FROM operator_profiles WHERE id = ?').run(id);
    return { deleted: info.changes > 0 };
  }

  return {
    dbPath,
    getStats,
    listDossiers,
    getDossierById,
    getDossierBySlugOrCode,
    createDossier,
    updateDossier,
    deleteDossier,
    duplicateDossier,
    finalizeDossier,
    listProfiles,
    saveProfile,
    deleteProfile,
    close: () => db.close(),
  };
}
