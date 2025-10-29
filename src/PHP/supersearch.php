<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

$servername = "localhost";
$db_username = "gdmt_gdmt";
$db_password = "fiksoz-xYhwej-kevna9";
$dbname = "gdmt_gdmt";


// Create connection
$conn = new mysqli($servername, $db_username, $db_password, $dbname);
$conn->query("SET SESSION sql_mode = ''");


$input = file_get_contents('php://input');

// Decode JSON
$data = json_decode($input, true);




$patientTable =  $data['patientDB'] ?? 'Patient';
$historyTable =  $data['historyDB'] ?? 'Patient_History';

$providerId = isset($data['providerId']) && $data['providerId'] !== '' ? (int)$data['providerId'] : null;



if (($data['script'] ?? '') === 'superSearch') {
    header('Content-Type: application/json; charset=utf-8');
    $hasSearch = false;

    // ─── Unpack payload ──────────────────────────────────────────────────
    $appointmentDate = trim((string) ($data['appointmentDate'] ?? ''));
    if ($appointmentDate === '') {
        $appointmentDate = '-1';
    }

    // Accept either {conditionCodes, conditionLabels} or {conditions:{codes,labels}}
    $conditionsCodes = [];
    $conditionsLabels = [];
    if (isset($data['conditionCodes'])) {
        $conditionsCodes = is_array($data['conditionCodes']) ? array_values(array_filter($data['conditionCodes'], 'strlen')) : [];
    } elseif (isset($data['conditions'])) {
        $conditionsCodes = is_array($data['conditions']['codes'] ?? null) ? array_values(array_filter($data['conditions']['codes'], 'strlen')) : [];
    }

    $labs = isset($data['labs']) && is_array($data['labs']) ? $data['labs'] : [];

    // Categories sent where we must FILTER OUT patients who are ON these
    $incCatIds = isset($data['medCategoryIds']) && is_array($data['medCategoryIds'])
        ? array_values(array_filter(array_map('intval', $data['medCategoryIds']), fn($v) => $v > 0))
        : [];

    $NoCatIds = isset($data['nonMedCategoryIds']) && is_array($data['nonMedCategoryIds'])
        ? array_values(array_filter(array_map('intval', $data['nonMedCategoryIds']), fn($v) => $v > 0))
        : [];
    // ─── Labs are REQUIRED: build lab where; if none -> return [] ────────
    // Whitelist: logical -> column
    // init

    $patientPool = $patientPool ?? [];
    $hasSearch = $hasSearch ?? false;

    // define BEFORE use
    function patientPoolSearch_Labs($conn, $labWheres, $labTypes, $labParams)
    {
        global $patientTable; // Use global to access dynamic table name
        $sql = "SELECT * FROM `$patientTable` WHERE " . implode(' AND ', $labWheres);
        $stmt = $conn->prepare($sql);
        if (!$stmt)
            return [];

        if ($labTypes !== '') {
            $stmt->bind_param($labTypes, ...$labParams);
        }
        if ($stmt->execute()) {
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                // keep any additional guard you want (e.g., only rows with healthNumber)
                if (!empty($row['healthNumber'])) {
                    $patientPool[] = $row;
                }
            }
            return $patientPool;
        }
        $stmt->close();
    }
    ;

    $labWheres = [];
    $labTypes = '';
    $labParams = [];
    // Build WHERE from labs (supports one-sided ranges)
    if (!empty($labs)) {
        foreach ($labs as $lab) {
            // expecting: ['field'=>'cholesterol','gt'=>'5','lt'=>'22'] etc.
            $field = $lab['field'] ?? null;
            $gt = (array_key_exists('gt', $lab) && $lab['gt'] !== '') ? (float) $lab['gt'] : -1;
            $lt = (array_key_exists('lt', $lab) && $lab['lt'] !== '') ? (float) $lab['lt'] : 10000;

            if ($gt !== null && $lt !== null) {
                if ($gt >= $lt)
                    continue; // invalid range
                $labWheres[] = "(`$field` > ? AND `$field` < ?)";
                $labTypes .= 'dd';
                $labParams[] = $gt;
                $labParams[] = $lt;
            }
        }
        if ($labWheres) {
            $patientPool = patientPoolSearch_Labs($conn, $labWheres, $labTypes, $labParams); // seeds $patientPool and sets $hasSearch = true
            $hasSearch = true;
        } else {
            // no valid lab rules -> return empty (or skip seeding and let next section seed)
            echo json_encode([]);
            exit;
        }
    }


    // ─── Conditions (AND of codes in Patient.conditionData CSV) ──────────
    // $conditionsCodes is expected to be an array of strings/IDs to match in Patient.conditionData
    if (!empty($conditionsCodes)) {
        // normalize: trim, dedupe, drop empties
        $codes = array_values(array_unique(array_filter(array_map('trim', $conditionsCodes), 'strlen')));

        if ($codes) {
            if ($hasSearch === false) {
                // --- Seed from DB using AND across all codes ---
                $where = [];
                $types = '';
                $vals = [];
                foreach ($codes as $c) {
                    $where[] = "FIND_IN_SET(?, `conditionData`) > 0";
                    $types .= 's';
                    $vals[] = $c;
                }

                $sql = "SELECT * FROM `$patientTable` WHERE " . implode(' AND ', $where);
                $stmt = $conn->prepare($sql);
                if ($stmt) {
                    if ($types !== '') {
                        $stmt->bind_param($types, ...$vals);
                    }
                    if ($stmt->execute()) {
                        $res = $stmt->get_result();
                        $patientPool = [];
                        while ($row = $res->fetch_assoc()) {
                            // keep guard(s) you want
                            if (!empty($row['healthNumber'])) {
                                $patientPool[] = $row;
                            }
                        }
                        $hasSearch = true;
                    }
                    $stmt->close();
                }
            } else {
                // --- Filter in-memory: require ALL codes present in conditionData ---
                $patientPool = array_values(array_filter($patientPool, function ($p) use ($codes) {
                    $csv = (string) ($p['conditionData'] ?? '');
                    if ($csv === '')
                        return false;
                    $set = array_filter(array_map('trim', explode(',', $csv)), 'strlen');
                    if (!$set)
                        return false;
                    // build lookup for O(1) checks
                    $lookup = array_fill_keys($set, true);
                    foreach ($codes as $c) {
                        if (!isset($lookup[$c]))
                            return false;
                    }
                    return true;
                }));
            }
        }
    }

    // ─── Filter OUT anyone ON any of medicationCategories (ON‑med logic) ─
    // Expand category IDs -> meds CSV -> meds array<int>
    $includeMedIdsCsv = getMedIdsCsvForCatIds($conn, $incCatIds); // e.g. "12,45,77"
    $includeMedIds = array_values(array_unique(
        array_filter(array_map('intval', explode(',', (string) $includeMedIdsCsv)), fn($v) => $v > 0)
    ));



    if (!empty($incCatIds) && $includeMedIds) {
        // Change this to 'AND' if you want ALL meds required (strict)
        $betweenClauses = 'OR'; // 'OR' = ANY match, 'AND' = ALL match
        if ($hasSearch === false) {
            // ---- Seed from DB: Patient where medsData contains ANY/ALL of these med IDs ----
            $where = [];
            $types = '';
            $vals = [];
            foreach ($includeMedIds as $mid) {
                $where[] = "FIND_IN_SET(?, `medsData`) > 0";
                $types .= 's';
                $vals[] = (string) $mid;
            }

            $sql = "SELECT * FROM `$patientTable` WHERE " . implode(" {$betweenClauses} ", $where);
            $stmt = $conn->prepare($sql);
            if ($stmt) {
                if ($types !== '') {
                    $stmt->bind_param($types, ...$vals);
                }
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
            // ---- Filter in-memory patientPool ----
            if ($betweenClauses === 'OR') {
                // ANY: keep patient if they have at least one of the med IDs
                $patientPool = array_values(array_filter($patientPool, function ($p) use ($includeMedIds) {
                    $csv = (string) ($p['medsData'] ?? '');
                    if ($csv === '')
                        return false;
                    $set = array_filter(array_map('intval', explode(',', $csv)), fn($v) => $v > 0);
                    if (!$set)
                        return false;
                    // Check intersection non-empty
                    $lookup = array_fill_keys($set, true);
                    foreach ($includeMedIds as $mid) {
                        if (isset($lookup[$mid]))
                            return true;
                    }
                    return false;
                }));
            } else {
                // ALL: keep patient only if they have every med ID
                $patientPool = array_values(array_filter($patientPool, function ($p) use ($includeMedIds) {
                    $csv = (string) ($p['medsData'] ?? '');
                    if ($csv === '')
                        return false;
                    $set = array_filter(array_map('intval', explode(',', $csv)), fn($v) => $v > 0);
                    if (!$set)
                        return false;
                    $lookup = array_fill_keys($set, true);
                    foreach ($includeMedIds as $mid) {
                        if (!isset($lookup[$mid]))
                            return false;
                    }
                    return true;
                }));
            }
        }
    }

    // Expand non-med category IDs -> med IDs CSV -> array<int>
    $excludeMedIdsCsv = getMedIdsCsvForCatIds($conn, $NoCatIds ?? []);
    $excludeMedIds = array_values(array_unique(
        array_filter(array_map('intval', explode(',', (string) $excludeMedIdsCsv)), fn($v) => $v > 0)
    ));

    if (!empty($NoCatIds) && $excludeMedIds) {
        // EXCLUDE MODE:
        // 'ANY'  => keep patients who have NONE of these meds (i.e., exclude if they have at least one)
        // 'ALL'  => keep patients who do not have ALL of these meds (i.e., exclude only if they have every one)
        $excludeMode = 'ANY'; // change to 'ALL' if you prefer that strictness

        if ($hasSearch === false) {
            // ---- Seed from DB: select patients that DO NOT match the meds ----
            $parts = [];
            $types = '';
            $vals = [];
            foreach ($excludeMedIds as $mid) {
                $parts[] = "FIND_IN_SET(?, `medsData`) > 0";
                $types .= 's';
                $vals[] = (string) $mid;
            }

            // Build the NOT (...) condition
            $glue = ($excludeMode === 'ALL') ? ' AND ' : ' OR ';
            $negCondition = 'NOT (' . implode($glue, $parts) . ')';

            $sql = "SELECT * FROM `$patientTable` WHERE $negCondition";
            $stmt = $conn->prepare($sql);
            if ($stmt) {
                if ($types !== '') {
                    $stmt->bind_param($types, ...$vals);
                }
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
            // ---- Filter in-memory: keep only patients who DO NOT match the meds ----
            if ($excludeMode === 'ANY') {
                // Keep if intersection is empty
                $patientPool = array_values(array_filter($patientPool, function ($p) use ($excludeMedIds) {
                    $csv = (string) ($p['medsData'] ?? '');
                    $set = array_filter(array_map('intval', explode(',', $csv)), fn($v) => $v > 0);
                    if (!$set)
                        return true; // no meds -> definitely doesn't have excluded meds
                    $lookup = array_fill_keys($set, true);
                    foreach ($excludeMedIds as $mid) {
                        if (isset($lookup[$mid]))
                            return false; // has a forbidden med -> drop
                    }
                    return true; // none present -> keep
                }));
            } else { // 'ALL'
                // Keep unless patient has *every* excluded med
                $patientPool = array_values(array_filter($patientPool, function ($p) use ($excludeMedIds) {
                    $csv = (string) ($p['medsData'] ?? '');
                    $set = array_filter(array_map('intval', explode(',', $csv)), fn($v) => $v > 0);
                    if (!$set)
                        return true; // empty meds -> certainly not "all"
                    $lookup = array_fill_keys($set, true);
                    foreach ($excludeMedIds as $mid) {
                        if (!isset($lookup[$mid]))
                            return true; // missing one -> keep
                    }
                    return false; // had all excluded meds -> drop
                }));
            }
        }
    }


    if ($appointmentDate !== '-1') {
        if ($hasSearch && !empty($patientPool)) {
            // Filter in-memory pool
            $patientPool = array_values(array_filter($patientPool, function ($patient) use ($appointmentDate) {
                return isset($patient['nextAppointment']) && $patient['nextAppointment'] === $appointmentDate;
            }));
        } else {
            // Query database for patients with matching nextAppointment
            $sql = "SELECT * FROM `$patientTable` WHERE `nextAppointment` = ?";
            $stmt = $conn->prepare($sql);
            if ($stmt) {
                $stmt->bind_param('s', $appointmentDate);
                if ($stmt->execute()) {
                    $res = $stmt->get_result();
                    $patientPool = [];
                    while ($row = $res->fetch_assoc()) {
                        if (!empty($row['healthNumber'])) {
                            $patientPool[] = $row;
                        }
                    }
                }
                $stmt->close();
            } else {
                $patientPool = [];
            }
        }
    }

        // ─── Provider filter (exact match on Patient.providerId) ───────────────
    if ($providerId !== null) {
        if ($hasSearch && !empty($patientPool)) {
            // In-memory filter
            $patientPool = array_values(array_filter($patientPool, function ($patient) use ($providerId) {
                return isset($patient['providerId']) && (int)$patient['providerId'] === (int)$providerId;
            }));
        } else {
            // Query database for patients with matching providerId
            $sql = "SELECT * FROM `$patientTable` WHERE `providerId` = ?";
            $stmt = $conn->prepare($sql);
            if ($stmt) {
                $stmt->bind_param('i', $providerId);
                if ($stmt->execute()) {
                    $res = $stmt->get_result();
                    $patientPool = [];
                    while ($row = $res->fetch_assoc()) {
                        if (!empty($row['healthNumber'])) {
                            $patientPool[] = $row;
                        }
                    }
                }
                $stmt->close();
            } else {
                $patientPool = [];
            }
            $hasSearch = true;
        }
    }

    


   
    $findRec = [];
    $sql = "SELECT * FROM `medDataSearch` WHERE `isActive` = 'Y'";
    $result = $conn->query($sql);
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $findRec[] = $row;
        }
    }

    $medCount = 0;

foreach ($patientPool as $i => &$patient) {
    // Parse once per patient
    $patientMeds = array_filter(
        array_map('intval', explode(',', $patient['medsData'] ?? '')),
        fn($v) => $v > 0
    );

    // Normalize existing recommendedMed -> array
    $recommendedMedArr = array_filter(
        array_map('trim', explode(',', $patient['recommendedMed'] ?? '')),
        'strlen'
    );
    $recommendedSet = array_flip($recommendedMedArr); // for O(1) dup checks

    foreach ($findRec as $rec) {
        $displayName = trim($rec['displayName'] ?? '');
        if ($displayName === '') {
            continue; // nothing to add
        }

        // medsToFind: patient must have >=1 from EACH group (AND across groups, OR within group)
        if (!empty($rec['medsToFind'])) {
            // Expecting medsToFind as a string like: "[30,40,41],[28,39,52]"
            // Parse into array of arrays
            $groups = [];
            preg_match_all('/\[(.*?)\]/', $rec['medsToFind'], $matches);
            foreach ($matches[1] as $groupStr) {
            $group = array_filter(array_map('intval', explode(',', $groupStr)), fn($v) => $v > 0);
            if ($group) {
                $groups[] = $group;
            }
            }
            // For each group, patient must have at least one med from that group
            $hasAllGroups = true;
            foreach ($groups as $group) {
            if (!array_intersect($group, $patientMeds)) {
                $hasAllGroups = false;
                break;
            }
            }
            if (!$hasAllGroups) {
            continue 2; // next patient
            }
        }

        // notMedsFind: patient must have none of these
        if (!empty($rec['notMedsFind'])) {
            $notMedsFind = array_filter(array_map('intval', explode(',', $rec['notMedsFind'])), fn($v)=>$v>0);
            if (array_intersect($notMedsFind, $patientMeds)) {
                continue 2; // next patient
            }
        }
        if (!empty($rec['conditionFind'])) {
            $conditionsToFind = array_filter(array_map('trim', explode(',', $rec['conditionFind'])), 'strlen');
            $patientConditions = array_filter(array_map('trim', explode(',', $patient['conditionData'] ?? '')), 'strlen');
            $conditionLookup = array_flip($patientConditions);
            // Require ALL conditionsToFind to be present in patientConditions
            foreach ($conditionsToFind as $cond) {
            if (!isset($conditionLookup[$cond])) {
                continue 2; // next patient
            }
            }
        }

        // Check lab values for patient
        if (
            (isset($patient['potassium']) && floatval($patient['potassium']) >= 5) 
            // ||
            // (isset($patient['albuminCreatinineRatio']) && floatval($patient['albuminCreatinineRatio']) <= 25)
        ) {
            continue 2; // next patient
        }

        $medCount++;

        // Add displayName if not already present
        if (!isset($recommendedSet[$displayName])) {
            $recommendedSet[$displayName] = true;
        }
    }

    // Commit normalized CSV (de-duped, trimmed)
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

// Final return
echo json_encode(array_values($patientPool), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
exit;
}

/**
 * Return a CSV of medication IDs for the given category IDs.
 * Works when medications.medication_cat stores the category *label* (string).
 */
function getMedIdsCsvForCatIds(mysqli $conn, array $catIds): string
{
    // Normalize: ints, dedupe, drop empties
    $catIds = array_values(array_unique(array_filter(array_map('intval', $catIds), fn($v) => $v > 0)));
    if (!$catIds)
        return '';

    // Build placeholders and types
    $placeholders = implode(',', array_fill(0, count($catIds), '?'));
    $types = str_repeat('i', count($catIds));

    // One query via JOIN: cat IDs -> cat labels -> meds with that label
    $sql = "
        SELECT m.ID
        FROM medications AS m
        INNER JOIN medCat AS c
            ON m.medication_cat = c.medication_cat
        WHERE c.ID IN ($placeholders)
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt)
        return '';
    $stmt->bind_param($types, ...$catIds);

    $medIds = [];
    if ($stmt->execute()) {
        $res = $stmt->get_result();
        while ($row = $res->fetch_assoc()) {
            $id = (int) ($row['ID'] ?? 0);
            if ($id > 0)
                $medIds[] = $id;
        }
    }
    $stmt->close();

    // Dedupe + CSV
    $medIds = array_values(array_unique($medIds));
    $commaLine = $medIds ? implode(',', $medIds) : '';
    return $commaLine;

}
