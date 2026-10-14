<?php
declare(strict_types=1);

// Multi-office permit pipeline: permit_types + permit_pipeline_steps (template,
// from migration 008) drive application_pipeline_progress (per-application state,
// from migration 009). See BREAKING_CHANGES.md before changing anything here.

/** Every active permit type, with its base pipeline steps, branch questions, and required documents. */
function permit_types_catalog(): array
{
    $types = db()->query('SELECT * FROM permit_types WHERE is_active = 1 ORDER BY track, name')->fetchAll();
    $steps = db()->query('SELECT * FROM permit_pipeline_steps ORDER BY permit_type_id, step_order')->fetchAll();
    $docs = db()->query('SELECT * FROM permit_type_documents ORDER BY permit_type_id, sort_order')->fetchAll();

    $stepsByType = [];
    foreach ($steps as $step) {
        $stepsByType[(int)$step['permit_type_id']][] = $step;
    }
    $docsByType = [];
    foreach ($docs as $doc) {
        $docsByType[(int)$doc['permit_type_id']][] = $doc['doc_name'];
    }
    // Keep the handler alongside, so the catalogue can say who reviews what.
    $docDetailByType = [];
    foreach ($docs as $doc) {
        $docDetailByType[(int)$doc['permit_type_id']][] = ['name' => $doc['doc_name'], 'office_code' => $doc['office_code']];
    }

    // Display names for the offices, so a route can be read without knowing the codes. BARANGAY is
    // resolved per applicant at submission, so here it is simply "your barangay".
    $officeNames = ['BARANGAY' => 'Your barangay'];
    foreach (db()->query('SELECT code, name FROM departments WHERE barangay_id IS NULL') as $d) {
        $officeNames[$d['code']] = $d['name'];
    }

    foreach ($types as &$type) {
        $typeSteps = $stepsByType[(int)$type['id']] ?? [];
        $type['questions'] = array_values(array_map(
            fn($s) => ['condition_key' => $s['condition_key'], 'label' => $s['condition_label']],
            array_filter($typeSteps, fn($s) => $s['condition_key'] !== null)
        ));
        $type['required_documents'] = $docsByType[(int)$type['id']] ?? [];
        $type['documents'] = array_map(
            fn($d) => ['name' => $d['name'], 'office' => $officeNames[$d['office_code']] ?? $d['office_code']],
            $docDetailByType[(int)$type['id']] ?? []
        );

        // The route, so the catalogue can show what the process actually is rather than just how
        // many steps it has. Conditional steps are marked: they only appear if the branch question
        // is answered yes, so the real length varies.
        $type['route'] = array_values(array_map(fn($s) => [
            'office_code'   => $s['office_code'],
            'office'        => $officeNames[$s['office_code']] ?? $s['office_code'],
            'step_label'    => $s['step_label'],
            'conditional'   => $s['condition_key'] !== null,
            // Which question adds this step, so the form can show the route your answers produce
            'condition_key' => $s['condition_key'],
        ], $typeSteps));
        $type['base_steps'] = count(array_filter($typeSteps, fn($s) => $s['condition_key'] === null));

        // Data-only quick questions (migration 038) — same Yes/No card UI as the routing
        // questions above, but answering one never changes the route, only a document
        // requirement and/or the fee charged at payment time.
        $type['quick_questions'] = array_map(fn($q) => [
            'condition_key'     => $q['condition_key'],
            'label'             => $q['question_label'],
            'yes_label'         => $q['yes_label'],
            'no_label'          => $q['no_label'],
            'requires_document' => $q['requires_document'],
        ], quick_conditions_for_type((int)$type['id']));
    }
    unset($type);

    return $types;
}

/** Permit types the given user/business context is eligible to file, with branch questions attached. */
function eligible_permit_types(array $user, array $businesses): array
{
    $isResident = in_array('Resident', $user['levels'], true);
    $isBusiness = count($businesses) > 0;

    $out = [];
    foreach (permit_types_catalog() as $type) {
        $asResident = (bool)$type['resident_eligible'] && $isResident;
        $asBusiness = (bool)$type['business_eligible'] && $isBusiness;
        if (!$asResident && !$asBusiness) {
            continue;
        }
        $type['as_resident'] = $asResident;
        $type['as_business'] = $asBusiness;
        // Standalone barangay items are resident-only even if the account also has a business,
        // per spec: "standalone barangay permits are Resident-account only."
        if ($type['track'] === 'barangay_standalone') {
            $type['as_business'] = false;
        }
        $out[] = $type;
    }
    return $out;
}

/** Required document names for one permit type, in display order (permit_type_documents, migration 011).
 * $conditions (condition_key => bool) adds any quick-question document that applies — e.g. a
 * Senior Citizen ID once 'senior_citizen' is answered yes (permit_type_conditions, migration 038).
 */
function required_documents_for_type(int $permitTypeId, array $conditions = []): array
{
    $stmt = db()->prepare('SELECT doc_name FROM permit_type_documents WHERE permit_type_id = ? ORDER BY sort_order');
    $stmt->execute([$permitTypeId]);
    $docs = array_column($stmt->fetchAll(), 'doc_name');

    foreach (quick_conditions_for_type($permitTypeId) as $q) {
        if ($q['requires_document'] && !empty($conditions[$q['condition_key']]) && !in_array($q['requires_document'], $docs, true)) {
            $docs[] = $q['requires_document'];
        }
    }
    return $docs;
}

/**
 * Pure data-collection quick questions for a permit type (permit_type_conditions, migration 038) —
 * "Are you a senior citizen?" / "Are you a first-time job seeker?". Unlike permit_pipeline_steps'
 * branch questions, answering these never adds or removes an office from the route; they only ever
 * gate a required document and/or the fee charged at payment time.
 */
function quick_conditions_for_type(int $permitTypeId): array
{
    $stmt = db()->prepare('SELECT * FROM permit_type_conditions WHERE permit_type_id = ? ORDER BY sort_order');
    $stmt->execute([$permitTypeId]);
    return $stmt->fetchAll();
}

/**
 * Resolves a pipeline step's office_code to a concrete department id.
 * 'BARANGAY' is a sentinel: it means "whichever barangay this application belongs to",
 * not a single department row — resolved via barangay_id, not office_code.
 */
function resolve_office_department(string $officeCode, ?int $barangayId): ?int
{
    if ($officeCode === 'BARANGAY') {
        if ($barangayId === null) {
            return null;
        }
        $stmt = db()->prepare('SELECT id FROM departments WHERE barangay_id = ? LIMIT 1');
        $stmt->execute([$barangayId]);
        $row = $stmt->fetch();
        return $row ? (int)$row['id'] : null;
    }
    $stmt = db()->prepare('SELECT id FROM departments WHERE code = ? LIMIT 1');
    $stmt->execute([$officeCode]);
    $row = $stmt->fetch();
    return $row ? (int)$row['id'] : null;
}

/**
 * Builds the concrete pipeline for a newly-submitted application: every base step, plus every
 * branch step whose condition was answered true. Every branch question for this permit type MUST
 * have an answer in $conditions (forced at submission, per spec) — missing one is a hard failure,
 * not a silent skip.
 *
 * @param array<string,bool> $conditions condition_key => answer
 * @return array{application_id:int} on success; throws RuntimeException with a user-facing message on failure
 */
function instantiate_pipeline(int $applicationId, int $permitTypeId, array $conditions, ?int $barangayId): void
{
    $pdo = db();
    $stepsStmt = $pdo->prepare('SELECT * FROM permit_pipeline_steps WHERE permit_type_id = ? ORDER BY step_order');
    $stepsStmt->execute([$permitTypeId]);
    $templateSteps = $stepsStmt->fetchAll();

    if (!$templateSteps) {
        throw new RuntimeException('This permit type has no defined pipeline yet.');
    }

    $resolvedSteps = [];
    foreach ($templateSteps as $step) {
        if ($step['condition_key'] !== null) {
            if (!array_key_exists($step['condition_key'], $conditions)) {
                throw new RuntimeException(
                    'Please answer: "' . $step['condition_label'] . '" before submitting.'
                );
            }
            if (!$conditions[$step['condition_key']]) {
                continue; // declared "no" — this branch node is not part of the pipeline
            }
        }
        $resolvedSteps[] = $step;
    }

    $conditionInsert = $pdo->prepare(
        'INSERT INTO application_conditions (application_id, condition_key, answer) VALUES (?, ?, ?)'
    );
    foreach ($conditions as $key => $answer) {
        $conditionInsert->execute([$applicationId, $key, $answer ? 1 : 0]);
    }

    $progressInsert = $pdo->prepare(
        'INSERT INTO application_pipeline_progress
            (application_id, step_order, office_code, department_id, step_label, status)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    foreach ($resolvedSteps as $i => $step) {
        $deptId = resolve_office_department($step['office_code'], $barangayId);
        if ($deptId === null) {
            throw new RuntimeException(
                'Could not route this application to ' . $step['office_code']
                . ' — no barangay is on file for this account/business yet.'
            );
        }
        $progressInsert->execute([
            $applicationId,
            $step['step_order'],
            $step['office_code'],
            $deptId,
            $step['step_label'],
            $i === 0 ? 'current' : 'pending',
        ]);
    }
}

/** The pipeline progress rows for an application, in order. Empty array = pre-pipeline legacy application. */
function pipeline_progress_for(int $applicationId): array
{
    // Which account signs off on each step, for walking a permit through by hand. Left out
    // entirely when reviewer_hints is off, because these are staff addresses — see
    // app_config() in config.php. Names the account only; never anything to sign in with.
    $reviewer = !empty(app_config()['testing']['reviewer_hints'])
        ? ", (SELECT u.email FROM users u
              WHERE u.department_id = p.department_id AND u.role IN ('staff','admin') AND u.is_active = 1
              ORDER BY u.id LIMIT 1) AS reviewer_login,
           (SELECT u.full_name FROM users u
              WHERE u.department_id = p.department_id AND u.role IN ('staff','admin') AND u.is_active = 1
              ORDER BY u.id LIMIT 1) AS reviewer_name"
        : '';

    $stmt = db()->prepare(
        'SELECT p.*, d.name AS department_name, d.code AS department_code' . $reviewer . '
         FROM application_pipeline_progress p JOIN departments d ON d.id = p.department_id
         WHERE p.application_id = ? ORDER BY p.step_order'
    );
    $stmt->execute([$applicationId]);
    return $stmt->fetchAll();
}

/**
 * Advances a pipelined application by one step: marks the current step decided, then either
 * activates the next pending step or, if that was the last one, marks the whole application
 * Approved. A rejection at any step voids the rest of the pipeline (marks remaining rows
 * 'skipped') and rejects the whole application — it does not return to the applicant for revision
 * at this stage (that's a future refinement noted in BREAKING_CHANGES.md #4).
 *
 * @return string the resulting application-level status: 'Under Review' | 'Approved' | 'Rejected'
 */
function advance_pipeline(int $applicationId, int $decidedBy, string $decision, ?string $notes): string
{
    if (!in_array($decision, ['approved', 'rejected'], true)) {
        throw new InvalidArgumentException('decision must be approved or rejected');
    }

    $pdo = db();
    $currentStmt = $pdo->prepare(
        "SELECT * FROM application_pipeline_progress WHERE application_id = ? AND status = 'current' LIMIT 1"
    );
    $currentStmt->execute([$applicationId]);
    $current = $currentStmt->fetch();
    if (!$current) {
        throw new RuntimeException('This application has no active pipeline step.');
    }

    $decideStmt = $pdo->prepare(
        'UPDATE application_pipeline_progress SET status = ?, decided_by = ?, decided_at = NOW(), notes = ? WHERE id = ?'
    );
    $decideStmt->execute([$decision, $decidedBy, $notes, $current['id']]);

    if ($decision === 'rejected') {
        $pdo->prepare(
            "UPDATE application_pipeline_progress SET status = 'skipped'
             WHERE application_id = ? AND status = 'pending'"
        )->execute([$applicationId]);
        return 'Rejected';
    }

    $nextStmt = $pdo->prepare(
        "SELECT id FROM application_pipeline_progress
         WHERE application_id = ? AND status = 'pending' ORDER BY step_order LIMIT 1"
    );
    $nextStmt->execute([$applicationId]);
    $next = $nextStmt->fetch();

    if ($next) {
        $pdo->prepare("UPDATE application_pipeline_progress SET status = 'current' WHERE id = ?")
            ->execute([$next['id']]);
        return 'Under Review';
    }
    return 'Approved';
}

/**
 * Which department holds this office for this application, read from the route the application was
 * given at submission. That snapshot is the only place the applicant's barangay is recorded, and it
 * is what the reviewer queue matches on, so the document check reads the same source.
 * Returns null when the application predates the pipeline.
 *
 * Lives here rather than in documents.php because the reviewer screen needs the same answer to
 * decide which documents to offer buttons for — one rule, read from one place.
 */
function document_owner_department(int $applicationId, string $officeCode): ?array
{
    $s = db()->prepare(
        "SELECT d.id, d.name, p.status FROM application_pipeline_progress p
           JOIN departments d ON d.id = p.department_id
          WHERE p.application_id = ?
            AND (CASE WHEN d.barangay_id IS NOT NULL THEN 'BARANGAY' ELSE d.code END) = ?
          LIMIT 1"
    );
    $s->execute([$applicationId, $officeCode]);
    $row = $s->fetch();
    return $row ?: null;
}

/** The step an application is sitting on right now, or null (pre-pipeline, or already finished). */
function current_pipeline_step(int $applicationId): ?array
{
    $s = db()->prepare(
        "SELECT id, office_code, department_id, step_label
           FROM application_pipeline_progress
          WHERE application_id = ? AND status = 'current' LIMIT 1"
    );
    $s->execute([$applicationId]);
    return $s->fetch() ?: null;
}

/**
 * Whether a staff account may open this application at all — its details and its files.
 *
 * An office sees a permit when it reaches them, and afterwards; never before. Until then the
 * paperwork belongs to the barangay doing intake, and there is no reason the Assessor's clerk
 * should be able to pull up an ID scan on a permit three offices away. Admins are exempt so a
 * stuck permit can still be looked at.
 *
 * Applications with no route rows predate the pipeline and stay open, as do staff accounts with
 * no department (the all-queues accounts) — neither has an office to check against.
 */
function staff_can_access_application(array $user, int $applicationId): bool
{
    if ($user['role'] === 'admin') {
        return true;
    }
    $deptId = (int)($user['department_id'] ?? 0);
    if ($deptId === 0) {
        return true;
    }
    $total = db()->prepare('SELECT COUNT(*) FROM application_pipeline_progress WHERE application_id = ?');
    $total->execute([$applicationId]);
    if ((int)$total->fetchColumn() === 0) {
        return true;
    }
    $mine = db()->prepare(
        "SELECT COUNT(*) FROM application_pipeline_progress
          WHERE application_id = ? AND department_id = ? AND status IN ('current', 'approved', 'rejected')"
    );
    $mine->execute([$applicationId, $deptId]);
    return (int)$mine->fetchColumn() > 0;
}

// ---------------------------------------------------------------------------------------------
// View-before-deciding (migration 038): a staff member must open AND download a document — at
// its current version — before they can act on it, whether that is a per-file decision
// (documents.php?action=review) or a node-level one (reviewer.php?action=pipeline_decision).
// ---------------------------------------------------------------------------------------------

/** Records that $userId opened (view=true) or downloaded (view=false) $documentId at $version. */
function log_document_access(int $documentId, int $version, int $userId, bool $view): void
{
    $col = $view ? 'viewed_at' : 'downloaded_at';
    db()->prepare(
        "INSERT INTO document_access_log (document_id, version, user_id, $col) VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE $col = NOW()"
    )->execute([$documentId, $version, $userId]);
}

/** Whether $userId has both opened and downloaded $documentId at its given (current) $version. */
function document_access_satisfied(int $documentId, int $version, int $userId): bool
{
    $s = db()->prepare(
        'SELECT viewed_at, downloaded_at FROM document_access_log WHERE document_id = ? AND version = ? AND user_id = ?'
    );
    $s->execute([$documentId, $version, $userId]);
    $row = $s->fetch();
    return (bool)($row && $row['viewed_at'] && $row['downloaded_at']);
}

/**
 * Every document owned by $officeCode on this application that $userId has NOT yet
 * viewed-and-downloaded at its current version. Empty = the gate is satisfied.
 * Only documents that actually have a file attached count — nothing to open on a Missing one.
 */
function unreviewed_documents_for_office(int $applicationId, string $officeCode, int $userId): array
{
    $stmt = db()->prepare(
        "SELECT id, doc_name, version FROM application_documents
          WHERE application_id = ? AND COALESCE(office_code, 'BARANGAY') = ? AND file_path IS NOT NULL"
    );
    $stmt->execute([$applicationId, $officeCode]);
    $docs = $stmt->fetchAll();

    $missing = [];
    foreach ($docs as $doc) {
        if (!document_access_satisfied((int)$doc['id'], (int)$doc['version'], $userId)) {
            $missing[] = $doc['doc_name'];
        }
    }
    return $missing;
}

/**
 * Freezes the application's current pipeline node — triggered automatically when the office
 * that OWNS a document rejects it or asks for a revision (documents.php), or manually via the
 * node-level Freeze/Revise actions (reviewer.php). The node stays 'current' (still the active
 * step) but reviewer.php refuses further decisions on it until it is cleared.
 */
function freeze_current_node(int $applicationId, int $userId, string $kind, ?string $reason): void
{
    db()->prepare(
        "UPDATE application_pipeline_progress
            SET frozen_at = NOW(), frozen_by = ?, freeze_reason = ?, freeze_kind = ?
          WHERE application_id = ? AND status = 'current'"
    )->execute([$userId, $reason, $kind, $applicationId]);
}

/** Manually resumes a frozen node (reviewer.php 'resume'), or automatically once nothing is left to revise. */
function unfreeze_current_node(int $applicationId): void
{
    db()->prepare(
        "UPDATE application_pipeline_progress
            SET frozen_at = NULL, frozen_by = NULL, freeze_reason = NULL, freeze_kind = NULL
          WHERE application_id = ? AND status = 'current'"
    )->execute([$applicationId]);
}

/**
 * After an owning office re-approves a document, auto-clears the node's freeze once no sibling
 * document it owns on this application is still sitting at 'Needs Re-upload'. Only matters when
 * the freeze was the automatic (document-driven) kind — a reviewer's own manual Freeze is left
 * for them to lift with 'resume', so an unrelated document being cleared doesn't silently resume
 * a hold they put there on purpose.
 */
function maybe_unfreeze_after_approval(int $applicationId, string $officeCode): void
{
    $pending = db()->prepare(
        "SELECT COUNT(*) FROM application_documents
          WHERE application_id = ? AND COALESCE(office_code, 'BARANGAY') = ? AND status = 'Needs Re-upload'"
    );
    $pending->execute([$applicationId, $officeCode]);
    if ((int)$pending->fetchColumn() > 0) {
        return;
    }
    db()->prepare(
        "UPDATE application_pipeline_progress
            SET frozen_at = NULL, frozen_by = NULL, freeze_reason = NULL, freeze_kind = NULL
          WHERE application_id = ? AND status = 'current' AND freeze_kind = 'revision'"
    )->execute([$applicationId]);
}

/**
 * Archives the current application_documents row into application_document_versions, then bumps
 * the live row's version number — called right before a reupload overwrites it (migration 038).
 * Keeps every prior upload for the record; the live row always holds the newest.
 */
function archive_document_version(array $doc): void
{
    db()->prepare(
        'INSERT INTO application_document_versions
            (document_id, version, file_path, original_filename, uploaded_at, status,
             reject_reason, reject_notes, decision_type, decided_by, decided_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $doc['id'], $doc['version'], $doc['file_path'], $doc['original_filename'], $doc['uploaded_at'], $doc['status'],
        $doc['reject_reason'], $doc['reject_notes'], $doc['decision_type'],
        $doc['rejected_by'], $doc['rejected_at'],
    ]);
}

/** Every department holding an already-APPROVED (passed) node for this application. */
function departments_with_passed_nodes(int $applicationId): array
{
    $stmt = db()->prepare(
        "SELECT DISTINCT department_id FROM application_pipeline_progress
          WHERE application_id = ? AND status = 'approved'"
    );
    $stmt->execute([$applicationId]);
    return array_map('intval', array_column($stmt->fetchAll(), 'department_id'));
}

/**
 * Notifies every active staff member of every department whose node has already passed for this
 * application that a document was just revised — so an office that already signed off knows
 * something changed behind it, even though only the owning office's own node actually re-opens.
 */
function notify_passed_departments_of_revision(int $applicationId, string $docName): void
{
    $deptIds = departments_with_passed_nodes($applicationId);
    if (!$deptIds) {
        return;
    }
    $placeholders = implode(',', array_fill(0, count($deptIds), '?'));
    $stmt = db()->prepare(
        "SELECT id FROM users WHERE department_id IN ($placeholders) AND role IN ('staff','admin') AND is_active = 1"
    );
    $stmt->execute($deptIds);
    foreach ($stmt->fetchAll() as $row) {
        notify_user(
            (int)$row['id'],
            'A revised document on application #' . $applicationId,
            'The applicant uploaded a revised "' . $docName . '" on application #' . $applicationId
                . ', an application whose review your office already passed. No action is needed from you unless something looks wrong.'
        );
    }
}
