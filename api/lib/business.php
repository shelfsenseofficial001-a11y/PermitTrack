<?php
declare(strict_types=1);

require_once __DIR__ . '/support.php';

/** Ownership type → which registration certificate proves the business exists. */
const OWNERSHIP_TYPES = [
    'sole_proprietorship' => ['label' => 'Sole proprietorship', 'registration' => 'DTI Certificate of Business Name Registration', 'agency' => 'DTI'],
    'partnership' => ['label' => 'Partnership', 'registration' => 'SEC Certificate of Registration', 'agency' => 'SEC'],
    'corporation' => ['label' => 'Corporation', 'registration' => 'SEC Certificate of Incorporation', 'agency' => 'SEC'],
    'cooperative' => ['label' => 'Cooperative', 'registration' => 'CDA Certificate of Registration', 'agency' => 'CDA'],
];

const LINES_OF_BUSINESS = [
    'Retail store / sari-sari store',
    'Food & beverage (restaurant, carinderia, cafe)',
    'Personal services (salon, laundry, repair)',
    'Professional services (clinic, office, consultancy)',
    'Wholesale / distribution',
    'Manufacturing / production',
    'Construction / contractor',
    'Transport / logistics',
    'Lodging / accommodation',
    'Agriculture / fishery',
    'Online / home-based business',
    'Other',
];

/** Primary government IDs accepted for the business representative. */
const REPRESENTATIVE_ID_TYPES = [
    'philsys' => 'National ID (PhilSys)',
    'passport' => 'Passport',
    'drivers_license' => "Driver's License",
    'umid' => 'UMID / SSS ID',
    'prc' => 'PRC ID',
    'postal_id' => 'Postal ID',
    'voters_id' => "Voter's ID",
];

/**
 * Who can apply for each permit type: a verified Resident, a verified business, or both.
 * Business permits are always filed for one specific approved business.
 */
const PERMIT_ELIGIBILITY = [
    'Building/Renovation' => ['resident' => true, 'business' => true],
    'Special Event' => ['resident' => true, 'business' => true],
    'Business License' => ['resident' => false, 'business' => true],
    'Food Service' => ['resident' => false, 'business' => true],
    'Sign' => ['resident' => false, 'business' => true],
];

/**
 * The documents a business must upload, given its ownership type and whether the account holder
 * is the registered owner. Returns [doc_key => label].
 */
function business_required_docs(?string $ownership, bool $isRegisteredOwner): array
{
    $docs = [
        'registration' => OWNERSHIP_TYPES[$ownership]['registration'] ?? 'Business registration certificate (DTI / SEC / CDA)',
        'representative_id' => "Representative's primary government ID (name must match the registration)",
        'barangay_clearance' => 'Barangay Business Clearance',
        'location_proof' => 'Proof of business location (lease contract, land title or tax declaration)',
    ];
    if ($ownership !== null && $ownership !== 'sole_proprietorship') {
        $docs['authority'] = "Secretary's Certificate or Board/Partners' Resolution naming you as representative";
    } elseif (!$isRegisteredOwner) {
        $docs['authority'] = 'Special Power of Attorney (SPA) or authorization letter from the owner';
    }
    return $docs;
}

/** A business with its documents, shaped for the UI (file paths are never exposed). */
function business_record(int $id): ?array
{
    $stmt = db()->prepare(
        'SELECT b.*, r.full_name AS reviewer_name FROM businesses b LEFT JOIN users r ON r.id = b.reviewed_by WHERE b.id = ?'
    );
    $stmt->execute([$id]);
    $b = $stmt->fetch();
    if (!$b) {
        return null;
    }
    $b['is_registered_owner'] = (bool)$b['is_registered_owner'];
    $b['ownership_label'] = OWNERSHIP_TYPES[$b['ownership_type']]['label'] ?? null;
    $b['required_docs'] = business_required_docs($b['ownership_type'], $b['is_registered_owner']);

    $docs = db()->prepare('SELECT id, doc_key, id_type, original_filename, mime_type, file_size, uploaded_at FROM business_documents WHERE business_id = ? ORDER BY id');
    $docs->execute([$id]);
    $b['documents'] = array_map(function (array $d) use ($b) {
        $d['label'] = $b['required_docs'][$d['doc_key']] ?? $d['doc_key'];
        $d['id_type_label'] = $d['id_type'] ? (REPRESENTATIVE_ID_TYPES[$d['id_type']] ?? $d['id_type']) : null;
        return $d;
    }, $docs->fetchAll());
    return $b;
}

/** Approved businesses a user can file business permits for. */
function approved_businesses(int $userId): array
{
    $stmt = db()->prepare(
        "SELECT id, business_name, trade_name, address_line, barangay, barangay_id, city, postal_code FROM businesses
         WHERE user_id = ? AND status = 'approved' ORDER BY business_name"
    );
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
}
