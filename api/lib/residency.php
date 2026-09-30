<?php
declare(strict_types=1);

require_once __DIR__ . '/support.php';

/**
 * Accepted proofs of residence. max_age_days = how recent the document must be (null = no date needed).
 * Two proofs of *different* types are required.
 */
const RESIDENCY_DOC_TYPES = [
    'barangay_certificate' => ['label' => 'Barangay Certificate of Residency', 'max_age_days' => 180],
    'utility_bill' => ['label' => 'Utility bill (electricity, water, internet)', 'max_age_days' => 90],
    'bank_statement' => ['label' => 'Bank or credit card statement', 'max_age_days' => 90],
    'lease' => ['label' => 'Lease or rental contract', 'max_age_days' => null],
    'property_title' => ['label' => 'Land title or tax declaration', 'max_age_days' => null],
    'voters_id' => ["label" => "Voter's ID or Voter's Certification", 'max_age_days' => null],
    'drivers_license' => ["label" => "Driver's license (with current address)", 'max_age_days' => null],
    'national_id' => ['label' => 'National ID (PhilSys) with address', 'max_age_days' => null],
    'postal_id' => ['label' => 'Postal ID', 'max_age_days' => null],
    'other_government' => ['label' => 'Other government-issued document with address', 'max_age_days' => null],
];

/** A verification request with its proofs, shaped for the UI (file paths are never exposed). */
function residency_request(int $id): ?array
{
    $stmt = db()->prepare(
        'SELECT rv.*, r.full_name AS reviewer_name FROM resident_verifications rv
         LEFT JOIN users r ON r.id = rv.reviewed_by WHERE rv.id = ?'
    );
    $stmt->execute([$id]);
    $req = $stmt->fetch();
    if (!$req) {
        return null;
    }
    $proofs = db()->prepare('SELECT id, doc_type, issued_on, original_filename, mime_type, file_size, uploaded_at FROM resident_proofs WHERE verification_id = ? ORDER BY id');
    $proofs->execute([$id]);
    $req['proofs'] = array_map(function (array $p) {
        $p['doc_type_label'] = RESIDENCY_DOC_TYPES[$p['doc_type']]['label'] ?? $p['doc_type'];
        $p['age_days'] = $p['issued_on'] ? (int)(new DateTime($p['issued_on']))->diff(new DateTime('today'))->days : null;
        return $p;
    }, $proofs->fetchAll());
    return $req;
}
