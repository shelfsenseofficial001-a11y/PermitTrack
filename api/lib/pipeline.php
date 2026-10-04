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

/** Required document names for one permit type, in display order (permit_type_documents, migration 011). */
function required_documents_for_type(int $permitTypeId): array
{
    $stmt = db()->prepare('SELECT doc_name FROM permit_type_documents WHERE permit_type_id = ? ORDER BY sort_order');
    $stmt->execute([$permitTypeId]);
    return array_column($stmt->fetchAll(), 'doc_name');
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
