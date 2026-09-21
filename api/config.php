<?php
declare(strict_types=1);

ini_set('display_errors', '1');
error_reporting(E_ALL);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Credentials: true');

const DB_HOST = 'localhost';
const DB_NAME = 'permittrack';
const DB_USER = 'root';
const DB_PASS = '';

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
    }
    return $pdo;
}

function json_input(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function respond(mixed $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function fail(string $message, int $status = 400): void
{
    respond(['error' => $message], $status);
}

function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $stmt = db()->prepare('SELECT id, role, account_type, email, full_name, onboarding_completed FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    return $user ?: null;
}

function require_auth(): array
{
    $user = current_user();
    if (!$user) {
        fail('Not authenticated', 401);
    }
    return $user;
}

function require_role(string $role): array
{
    $user = require_auth();
    if ($user['role'] !== $role) {
        fail('Forbidden', 403);
    }
    return $user;
}

function required_documents_for(string $permitType): array
{
    $map = [
        'Food Service' => ['Health Permit Application', 'Food Handler Certificate', 'Floor Plan', 'Proof of Insurance'],
        'Building/Renovation' => ['Site Plan', 'Structural Drawings', 'Proof of Insurance', 'Contractor License'],
        'Sign' => ['Sign Drawing / Rendering', 'Property Owner Authorization'],
        'Business License' => ['Business Formation Document', 'EIN Confirmation Letter', 'Zoning Compliance Letter'],
        'Special Event' => ['Event Layout Map', 'Proof of Insurance', 'Security/Safety Plan'],
    ];
    return $map[$permitType] ?? [];
}
