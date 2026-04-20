<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    echo json_encode([
        'success' => true,
        'message' => 'OPTIONS OK'
    ]);
    exit;
}

$servername = "localhost";
$db_username = "gdmt_gdmt";
$db_password = "fiksoz-xYhwej-kevna9";
$dbname = "gdmt_gdmt";

$conn = new mysqli($servername, $db_username, $db_password, $dbname);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed',
        'details' => $conn->connect_error
    ]);
    exit;
}

$conn->query("SET SESSION sql_mode = ''");

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid JSON payload',
        'rawInput' => $input
    ]);
    exit;
}

$patientTable = !empty($data['patientDB']) && is_string($data['patientDB'])
    ? trim($data['patientDB'])
    : 'Patient';

$historyTable = !empty($data['historyDB']) && is_string($data['historyDB'])
    ? trim($data['historyDB'])
    : 'Patient_History';

if (($data['script'] ?? '') !== 'superSearch') {
    echo json_encode([
        'success' => false,
        'error' => 'Invalid script'
    ]);
    exit;
}

function toFloatOrNull($value)
{
    if ($value === null) return null;
    $value = trim((string)$value);
    if ($value === '') return null;
    return is_numeric($value) ? (float)$value : null;
}

function toIntOrNull($value)
{
    if ($value === null) return null;
    $value = trim((string)$value);
    if ($value === '') return null;
    return is_numeric($value) ? (int)$value : null;
}

function parseCsvValues($csv): array
{
    $csv = (string)$csv;
    if (trim($csv) === '') {
        return [];
    }

    $parts = array_map('trim', explode(',', $csv));
    $parts = array_filter($parts, fn($v) => $v !== '');
    return array_values(array_unique($parts));
}

$conditionsCodes = isset($data['conditionCodes']) && is_array($data['conditionCodes'])
    ? array_values(array_unique(array_filter(array_map('trim', $data['conditionCodes']), 'strlen')))
    : [];

$labs = isset($data['labs']) && is_array($data['labs']) ? $data['labs'] : [];

$incCatIds = isset($data['medCategoryIds']) && is_array($data['medCategoryIds'])
    ? array_values(array_unique(array_filter(array_map(function ($v) {
        return trim((string)$v);
    }, $data['medCategoryIds']), 'strlen')))
    : [];

$noCatIds = isset($data['nonMedCategoryIds']) && is_array($data['nonMedCategoryIds'])
    ? array_values(array_unique(array_filter(array_map(function ($v) {
        return trim((string)$v);
    }, $data['nonMedCategoryIds']), 'strlen')))
    : [];

$minPoints = toIntOrNull($data['minPoints'] ?? null);
$maxPoints = toIntOrNull($data['maxPoints'] ?? null);
$minLabs = toIntOrNull($data['minLabs'] ?? null);
$maxLabs = toIntOrNull($data['maxLabs'] ?? null);

$providerIdRaw = $data['providerId'] ?? null;
$providerId = ($providerIdRaw !== null && trim((string)$providerIdRaw) !== '')
    ? trim((string)$providerIdRaw)
    : null;

$privateNoteSearchRaw = $data['privateNoteSearch'] ?? '';
$privateNoteSearch = trim((string)$privateNoteSearchRaw);

$hospitalSearchRaw = $data['hospitalSearch'] ?? '';
$hospitalSearch = trim((string)$hospitalSearchRaw);

// DEBUG: Log the hospital search parameter
error_log("DEBUG: hospitalSearch received = '" . $hospitalSearch . "'");

// DEBUG: Check what hospital data exists in database
$debug_sql = "SELECT COUNT(*) as total, 
              SUM(CASE WHEN LOWER(HospitalLoaded) = 'yes' THEN 1 ELSE 0 END) as yes_count,
              SUM(CASE WHEN LOWER(HospitalLoaded) = 'no' THEN 1 ELSE 0 END) as no_count,
              SUM(CASE WHEN HospitalLoaded IS NULL THEN 1 ELSE 0 END) as null_count
              FROM `$patientTable`";
$debug_result = $conn->query($debug_sql);
if ($debug_result) {
    $debug_row = $debug_result->fetch_assoc();
    error_log("DEBUG: Hospital data counts - Total: " . $debug_row['total'] . 
              ", Yes: " . $debug_row['yes_count'] . 
              ", No: " . $debug_row['no_count'] . 
              ", NULL: " . $debug_row['null_count']);
}

// DEBUG: Show sample HospitalLoaded values
$sample_sql = "SELECT HospitalLoaded FROM `$patientTable` WHERE HospitalLoaded IS NOT NULL LIMIT 5";
$sample_result = $conn->query($sample_sql);
if ($sample_result) {
    $samples = [];
    while ($sample_row = $sample_result->fetch_assoc()) {
        $samples[] = "'" . $sample_row['HospitalLoaded'] . "'";
    }
    error_log("DEBUG: Sample HospitalLoaded values: " . implode(", ", $samples));
}

$patientPool = [];
$hasSearch = false;

$labAllowed = [
    'cholesterol',
    'triglyceride',
    'hdl',
    'ldl',
    'nonHdl',
    'cholesterolHdlRatio',
    'creatineKinase',
    'alanineAminotransferase',
    'lipoproteinA',
    'apolipoproteinB',
    'natriureticPeptideB',
    'urea',
    'creatinine',
    'gfr',
    'albumin',
    'sodium',
    'potassium',
    'vitaminB12',
    'ferritin',
    'hemoglobinA1C',
    'urineAlbumin',
    'albuminCreatinineRatio'
];

/* Seed from labs first if present */
$labWheres = [];
$labTypes = '';
$labParams = [];

foreach ($labs as $lab) {
    $field = $lab['field'] ?? '';
    if (!in_array($field, $labAllowed, true)) {
        continue;
    }

    $gt = toFloatOrNull($lab['gt'] ?? null);
    $lt = toFloatOrNull($lab['lt'] ?? null);

    if ($gt !== null && $lt !== null) {
        if ($gt >= $lt) {
            continue;
        }
        $labWheres[] = "(`$field` > ? AND `$field` < ?)";
        $labTypes .= 'dd';
        $labParams[] = $gt;
        $labParams[] = $lt;
    } elseif ($gt !== null) {
        $labWheres[] = "(`$field` > ?)";
        $labTypes .= 'd';
        $labParams[] = $gt;
    } elseif ($lt !== null) {
        $labWheres[] = "(`$field` < ?)";
        $labTypes .= 'd';
        $labParams[] = $lt;
    }
}

if (!empty($labWheres)) {
    $sql = "SELECT * FROM `$patientTable` WHERE " . implode(' AND ', $labWheres);
    $stmt = $conn->prepare($sql);
    if ($stmt) {
        if ($labTypes !== '') {
            $stmt->bind_param($labTypes, ...$labParams);
        }
        if ($stmt->execute()) {
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                if (!empty($row['healthNumber'])) {
                    $patientPool[] = $row;
                }
            }
            $hasSearch = true;
        }
        $stmt->close();
    }
}

/* Conditions */
if (!empty($conditionsCodes)) {
    if (!$hasSearch) {
        $where = [];
        $types = '';
        $vals = [];

        foreach ($conditionsCodes as $c) {
            $where[] = "FIND_IN_SET(?, `conditionData`) > 0";
            $types .= 's';
            $vals[] = $c;
        }

        $sql = "SELECT * FROM `$patientTable` WHERE (" . implode(' OR ', $where) . ")";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param($types, ...$vals);
            if ($stmt->execute()) {
                $res = $stmt->get_result();
                $patientPool = [];
                while ($row = $res->fetch_assoc()) {
                    if (!empty($row['healthNumber'])) {
                        $patientPool[] = $row;
                    }
                }
                $hasSearch = true;
            }
            $stmt->close();
        }
    } else {
        $patientPool = array_values(array_filter($patientPool, function ($p) use ($conditionsCodes) {
            $csv = (string)($p['conditionData'] ?? '');
            if ($csv === '') return false;
            $set = parseCsvValues($csv);
            if (!$set) return false;
            $lookup = array_fill_keys($set, true);
            foreach ($conditionsCodes as $c) {
                if (isset($lookup[$c])) {
                    return true;
                }
            }
            return false;
        }));
    }
}

/* On-med categories: check Patient.medCatSearch directly */
if (!empty($incCatIds)) {
    if (!$hasSearch) {
        $where = [];
        $types = '';
        $vals = [];

        foreach ($incCatIds as $catId) {
            $where[] = "FIND_IN_SET(?, `medCatSearch`) > 0";
            $types .= 's';
            $vals[] = $catId;
        }

        $sql = "SELECT * FROM `$patientTable` WHERE (" . implode(' OR ', $where) . ")";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param($types, ...$vals);
            if ($stmt->execute()) {
                $res = $stmt->get_result();
                $patientPool = [];
                while ($row = $res->fetch_assoc()) {
                    if (!empty($row['healthNumber'])) {
                        $patientPool[] = $row;
                    }
                }
                $hasSearch = true;
            }
            $stmt->close();
        }
    } else {
        $patientPool = array_values(array_filter($patientPool, function ($p) use ($incCatIds) {
            $csv = (string)($p['medCatSearch'] ?? '');
            if ($csv === '') return false;
            $set = parseCsvValues($csv);
            if (!$set) return false;
            $lookup = array_fill_keys($set, true);
            foreach ($incCatIds as $catId) {
                if (isset($lookup[$catId])) {
                    return true;
                }
            }
            return false;
        }));
    }
}

/* Not-on-med categories: check Patient.medCatSearch directly */
if (!empty($noCatIds)) {
    if (!$hasSearch) {
        $parts = [];
        $types = '';
        $vals = [];

        foreach ($noCatIds as $catId) {
            $parts[] = "FIND_IN_SET(?, `medCatSearch`) > 0";
            $types .= 's';
            $vals[] = $catId;
        }

        $sql = "SELECT * FROM `$patientTable` WHERE NOT (" . implode(' OR ', $parts) . ")";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param($types, ...$vals);
            if ($stmt->execute()) {
                $res = $stmt->get_result();
                $patientPool = [];
                while ($row = $res->fetch_assoc()) {
                    if (!empty($row['healthNumber'])) {
                        $patientPool[] = $row;
                    }
                }
                $hasSearch = true;
            }
            $stmt->close();
        }
    } else {
        $patientPool = array_values(array_filter($patientPool, function ($p) use ($noCatIds) {
            $csv = (string)($p['medCatSearch'] ?? '');
            $set = parseCsvValues($csv);
            if (!$set) return true;
            $lookup = array_fill_keys($set, true);
            foreach ($noCatIds as $catId) {
                if (isset($lookup[$catId])) {
                    return false;
                }
            }
            return true;
        }));
    }
}

/* Private note search */
if ($privateNoteSearch !== '') {
    if (!$hasSearch) {
        $like = '%' . $privateNoteSearch . '%';
        $sql = "SELECT * FROM `$patientTable` WHERE `privateNote` LIKE ?";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param('s', $like);
            if ($stmt->execute()) {
                $res = $stmt->get_result();
                $patientPool = [];
                while ($row = $res->fetch_assoc()) {
                    if (!empty($row['healthNumber'])) {
                        $patientPool[] = $row;
                    }
                }
                $hasSearch = true;
            }
            $stmt->close();
        }
    } else {
        $needle = mb_strtolower($privateNoteSearch);
        $patientPool = array_values(array_filter($patientPool, function ($p) use ($needle) {
            $note = mb_strtolower((string)($p['privateNote'] ?? ''));
            return $note !== '' && mb_strpos($note, $needle) !== false;
        }));
    }
}

/* Hospital search */
if ($hospitalSearch !== '') {
    error_log("DEBUG: Processing hospital search with value: '" . $hospitalSearch . "'");
    
    if (!$hasSearch) {
        if (strtolower($hospitalSearch) === 'yes') {
            $sql = "SELECT * FROM `$patientTable` WHERE LOWER(`HospitalLoaded`) = 'yes'";
            error_log("DEBUG: Using SQL for 'yes': " . $sql);
        } elseif (strtolower($hospitalSearch) === 'no') {
            $sql = "SELECT * FROM `$patientTable` WHERE (LOWER(`HospitalLoaded`) != 'yes' OR `HospitalLoaded` IS NULL)";
            error_log("DEBUG: Using SQL for 'no': " . $sql);
        } else {
            // Invalid hospitalSearch value, skip this filter
            $sql = null;
            error_log("DEBUG: Invalid hospitalSearch value, skipping");
        }
        
        if ($sql !== null) {
            $res = $conn->query($sql);
            if ($res) {
                $patientPool = [];
                $count = 0;
                while ($row = $res->fetch_assoc()) {
                    if (!empty($row['healthNumber'])) {
                        $patientPool[] = $row;
                        $count++;
                    }
                }
                error_log("DEBUG: Hospital search returned " . $count . " patients");
                $hasSearch = true;
            } else {
                error_log("DEBUG: Hospital search query failed: " . $conn->error);
            }
        }
    } else {
        $before_count = count($patientPool);
        if (strtolower($hospitalSearch) === 'yes') {
            $patientPool = array_values(array_filter($patientPool, function ($p) {
                return strtolower((string)($p['HospitalLoaded'] ?? '')) === 'yes';
            }));
        } elseif (strtolower($hospitalSearch) === 'no') {
            $patientPool = array_values(array_filter($patientPool, function ($p) {
                $hospitalLoaded = strtolower((string)($p['HospitalLoaded'] ?? ''));
                return $hospitalLoaded !== 'yes';
            }));
        }
        $after_count = count($patientPool);
        error_log("DEBUG: Hospital filter reduced patients from " . $before_count . " to " . $after_count);
        // If invalid hospitalSearch value, don't filter
    }
}

/* If nothing seeded yet, start with all patients */
if (!$hasSearch) {
    $sql = "SELECT * FROM `$patientTable`";
    $res = $conn->query($sql);
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            if (!empty($row['healthNumber'])) {
                $patientPool[] = $row;
            }
        }
        $hasSearch = true;
    }
}

/* Points filters */
if ($minPoints !== null) {
    $patientPool = array_values(array_filter($patientPool, function ($patient) use ($minPoints) {
        return (int)($patient['totalPoints'] ?? 0) >= $minPoints;
    }));
}

if ($maxPoints !== null) {
    $patientPool = array_values(array_filter($patientPool, function ($patient) use ($maxPoints) {
        return (int)($patient['totalPoints'] ?? 0) <= $maxPoints;
    }));
}

/* Labs count filters */
if ($minLabs !== null) {
    $patientPool = array_values(array_filter($patientPool, function ($patient) use ($minLabs) {
        return (int)($patient['labCount'] ?? 0) >= $minLabs;
    }));
}

if ($maxLabs !== null) {
    $patientPool = array_values(array_filter($patientPool, function ($patient) use ($maxLabs) {
        return (int)($patient['labCount'] ?? 0) <= $maxLabs;
    }));
}

/* Location/provider filter */
if ($providerId !== null) {
    $patientPool = array_values(array_filter($patientPool, function ($patient) use ($providerId) {
        return isset($patient['pharmacyID']) && (string)$patient['pharmacyID'] === (string)$providerId;
    }));
}

/* Existing recommendedMed logic kept */
$findRec = [];
$sql = "SELECT * FROM `medDataSearch` WHERE `isActive` = 'Y'";
$result = $conn->query($sql);
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $findRec[] = $row;
    }
}

foreach ($patientPool as $i => &$patient) {
    $patientMeds = array_filter(
        array_map('intval', explode(',', $patient['medsData'] ?? '')),
        fn($v) => $v > 0
    );

    $recommendedMedArr = array_filter(
        array_map('trim', explode(',', $patient['recommendedMed'] ?? '')),
        'strlen'
    );
    $recommendedSet = array_flip($recommendedMedArr);

    foreach ($findRec as $rec) {
        $displayName = trim($rec['displayName'] ?? '');
        if ($displayName === '') {
            continue;
        }

        if (!empty($rec['medsToFind'])) {
            $groups = [];
            preg_match_all('/\[(.*?)\]/', $rec['medsToFind'], $matches);
            foreach ($matches[1] as $groupStr) {
                $group = array_filter(array_map('intval', explode(',', $groupStr)), fn($v) => $v > 0);
                if ($group) {
                    $groups[] = $group;
                }
            }

            $hasAllGroups = true;
            foreach ($groups as $group) {
                if (!array_intersect($group, $patientMeds)) {
                    $hasAllGroups = false;
                    break;
                }
            }
            if (!$hasAllGroups) {
                continue 2;
            }
        }

        if (!empty($rec['notMedsFind'])) {
            $notMedsFind = array_filter(array_map('intval', explode(',', $rec['notMedsFind'])), fn($v) => $v > 0);
            if (array_intersect($notMedsFind, $patientMeds)) {
                continue 2;
            }
        }

        if (!empty($rec['conditionFind'])) {
            $conditionsToFind = array_filter(array_map('trim', explode(',', $rec['conditionFind'])), 'strlen');
            $patientConditions = array_filter(array_map('trim', explode(',', $patient['conditionData'] ?? '')), 'strlen');
            $conditionLookup = array_flip($patientConditions);

            foreach ($conditionsToFind as $cond) {
                if (!isset($conditionLookup[$cond])) {
                    continue 2;
                }
            }
        }

        if ((isset($patient['potassium']) && floatval($patient['potassium']) >= 5)) {
            continue 2;
        }

        if (!isset($recommendedSet[$displayName])) {
            $recommendedSet[$displayName] = true;
        }
    }

    if ($recommendedSet) {
        $patient['recommendedMed'] = implode(',', array_keys($recommendedSet));
        $stmt = $conn->prepare("UPDATE `$patientTable` SET `recommendedMed` = ? WHERE `id` = ?");
        if ($stmt) {
            $stmt->bind_param('si', $patient['recommendedMed'], $patient['id']);
            $stmt->execute();
            $stmt->close();
        }
    }
}
unset($patient);

echo json_encode(array_values($patientPool), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
exit;