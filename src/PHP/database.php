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


$patientTable = $data['patientDB'] ?? 'Patient';
$historyTable = $data['historyDB'] ?? 'Patient_History';


// print_r($data); // Debugging: Output the received data
// exit;


if ($data['script'] === 'updatePatientNote') {
     $healthNumber = $data['healthNumber'] ?? null;
     $patientNote = $data['patientNote'] ?? null; // can be null to clear

     if (!$healthNumber) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing healthNumber']);
          exit;
     }

     $stmt = $conn->prepare("UPDATE `$patientTable` SET patientNote = ? WHERE healthNumber = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }

     // both are strings (patientNote may be null → use 's' and let driver send NULL)
     $stmt->bind_param('ss', $patientNote, $healthNumber);

     if ($stmt->execute()) {
          http_response_code(200);
          echo json_encode(['success' => true, 'affected_rows' => $stmt->affected_rows]);
          $stmt->close();
          $conn->close();
          exit;
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
          $stmt->close();
          $conn->close();
          exit;
     }
}

if ($data['script'] === 'saveAddress') {
     $patientID = $data['patientID'] ?? null;
     $fullAddress = $data['fullAddress'] ?? null;
     $street = $data['street'] ?? null;
     $city = $data['city'] ?? null;
     $province = $data['province'] ?? null;
     $postalCode = $data['postalCode'] ?? null;
     $telephone = $data['telephone'] ?? null;

     if (!$patientID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }

     // prepared statement: update address/contact fields
     $sql = "UPDATE `$patientTable`
            SET fullAddress = ?, street = ?, city = ?, province = ?, postalCode = ?, telephone = ?
            WHERE id = ?";

     $stmt = $conn->prepare($sql);
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }

     // bind: 6 strings + 1 int
     $stmt->bind_param('ssssssi', $fullAddress, $street, $city, $province, $postalCode, $telephone, $patientID);

     if ($stmt->execute()) {
          http_response_code(200);
          echo json_encode(['success' => true, 'affected_rows' => $stmt->affected_rows]);
          $stmt->close();
          $conn->close();
          exit;
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
          $stmt->close();
          $conn->close();
          exit;
     }
}

// if ($data['script'] === 'saveTheDataButton') {
//      if ($data['patientStatus'] === 'new') {
//           $nextAppointment = $data['nextAppointment'] ?? '1970-01-01';
//           insertNewClient($nextAppointment, $data, $conn, $patientTable, $historyTable);
//      }
// }


if ($data['script'] === 'updatePatient') {
     $nextAppointment = $data['nextAppointment'] ?? '1970-01-02';
     updateClient($nextAppointment, $data, $conn, $patientTable, $historyTable);
}

if ($data['script'] === 'patientNoteSearch') {

     $noteTerm = $data['noteTerm'] ?? '';
     $noteTerm = '%' . $noteTerm . '%';

     // Prepare and execute query to search for patient notes containing the noteTerm
     $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE patientNote LIKE ?");
     $stmt->bind_param("s", $noteTerm);
     $stmt->execute();
     $result = $stmt->get_result();

     $notes = [];
     while ($row = $result->fetch_assoc()) {
          $notes[] = $row;
     }

     echo json_encode($notes);

     $stmt->close();
     $conn->close();
     exit;
}

if ($data['script'] === 'getStatus') {
     $healthNumber = $data['healthNumber'];

     // Prepare and execute query to check if healthNumber exists in Patient table
     $stmt = $conn->prepare("SELECT 1 FROM `$patientTable` WHERE healthNumber = ?");
     $stmt->bind_param("s", $healthNumber);
     $stmt->execute();
     $stmt->store_result();

     if ($stmt->num_rows > 0) {
          $labDate = isset($data['labdate']) ? $data['labdate'] : null;
          if ($labDate) {
               $healthNumberNoSpaces = str_replace(' ', '', $healthNumber);
               $stmt2 = $conn->prepare("SELECT 1 FROM `patientFiles` WHERE healthNumber = ? AND labDate = ?");
               $stmt2->bind_param("ss", $healthNumberNoSpaces, $labDate);
               $stmt2->execute();
               $stmt2->store_result();
               if ($stmt2->num_rows > 0) {
                    echo json_encode(['status' => 'update', 'lab' => 'Exists']);
                    $stmt2->close();
                    $conn->close();
                    exit;
               }
               $stmt2->close();
          }
          echo json_encode(['status' => 'update']);

     } else {
          echo json_encode(['status' => 'new', 'lab' => 'None']); // healthNumber does not exist
     }

     $stmt->close();
     $conn->close();
}

if ($data['script'] === 'patientSearch') {
     $searchTerm = $data['searchTerm'];
     $searchTerm = '%' . $searchTerm . '%';

     // Prepare and execute query to search for healthNumber or clientName
     $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE healthNumber LIKE ? OR clientName LIKE ?");
     $stmt->bind_param("ss", $searchTerm, $searchTerm);
     $stmt->execute();
     $result = $stmt->get_result();

     // Fetch all results
     $patients = [];
     while ($row = $result->fetch_assoc()) {
          $patients[] = $row;
     }

     echo json_encode($patients);

     $stmt->close();
     $conn->close();
     exit;
}

if ($data['script'] === 'updateLabs') {
     $healthNumber = $data['hcn'] ?? null;
     $labData = $data['labs'] ?? null;

     if (!$healthNumber || !is_array($labData)) {
          http_response_code(400);
          echo json_encode(['error' => 'Missing or invalid data']);
          exit;
     }

     $setClauses = [];
     foreach ($labData as $key => $value) {
          $safeKey = mysqli_real_escape_string($conn, $key);
          $safeValue = mysqli_real_escape_string($conn, $value);
          $setClauses[] = "`$safeKey` = '$safeValue'";
     }

     $setString = implode(", ", $setClauses);
     $healthNumberEscaped = mysqli_real_escape_string($conn, $healthNumber);
     $sql = "UPDATE `$patientTable` SET $setString WHERE healthNumber = '$healthNumberEscaped'";

     if (mysqli_query($conn, $sql)) {
          echo json_encode(['success' => true]);
     } else {
          http_response_code(500);
          echo json_encode(['error' => 'Update failed', 'details' => mysqli_error($conn)]);
     }

     mysqli_close($conn);

}

if ($data['script'] === 'getLabData') {
     $healthNumber = $data['healthNumber'] ?? null;

     if (!$healthNumber) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing health number']);
          exit;
     }

     $healthNumberEscaped = str_replace(' ', '', $healthNumber);
     $healthNumberEscaped = mysqli_real_escape_string($conn, $healthNumberEscaped);
     $sql = "SELECT * FROM patientFiles WHERE healthNumber = '$healthNumberEscaped' order by labDate DESC";
     $result = mysqli_query($conn, $sql);

     if ($result) {
          $patientData = [];
          while ($row = mysqli_fetch_assoc($result)) {
               $patientData[] = $row;
          }
          echo json_encode([
               'success' => true,
               'labReports' => $patientData
          ]);
          mysqli_free_result($result);
     } else {
          http_response_code(500);
          echo json_encode([
               'success' => false,
               'error' => 'Query failed',
               'details' => mysqli_error($conn)
          ]);
     }
}

if ($data['script'] === 'getPatientUploads') {
     $healthNumber = $data['healthNumber'] ?? null;

     if (!$healthNumber) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing health number']);
          exit;
     }

     $healthNumberEscaped = str_replace(' ', '', $healthNumber);
     $healthNumberEscaped = mysqli_real_escape_string($conn, $healthNumberEscaped);
     $sql = "SELECT * FROM patientPDF WHERE healthNumber = '$healthNumberEscaped' order by labDate DESC";
     $result = mysqli_query($conn, $sql);

     if ($result) {
          $patientData = [];
          while ($row = mysqli_fetch_assoc($result)) {
               $patientData[] = $row;
          }
          echo json_encode([
               'success' => true,
               'patientUploads' => $patientData
          ]);
          mysqli_free_result($result);
     } else {
          http_response_code(500);
          echo json_encode([
               'success' => false,
               'error' => 'Query failed',
               'details' => mysqli_error($conn)
          ]);
     }
}

if ($data['script'] === 'providerSearch') {

     $providerTerm = isset($data['providerTerm']) ? trim($data['providerTerm']) : '';
     $appointmentDate = isset($data['appointmentDate']) ? trim($data['appointmentDate']) : '';

     // require at least one filter
     if ($providerTerm === '' && $appointmentDate === '') {
          http_response_code(400);
          echo json_encode(['error' => 'Missing provider or appointment date']);
          exit;
     }

     // normalize/validate date if provided
     if ($appointmentDate !== '') {
          $ts = strtotime($appointmentDate);
          if ($ts === false) {
               http_response_code(400);
               echo json_encode(['error' => 'Invalid appointmentDate (use YYYY-MM-DD)']);
               exit;
          }
          $appointmentDate = date('Y-m-d', $ts);
     }

     $dateCol = 'nextAppointment'; // or 'nextAppointment' if that's your column

     $sql = "SELECT * FROM `$patientTable` WHERE 1=1";
     $params = [];
     $types = "";

     // provider filter
     if ($providerTerm !== '') {
          $sql .= " AND providerName LIKE ?";
          $params[] = "%{$providerTerm}%";
          $types .= "s";
     }

     // date filter
     if ($appointmentDate !== '') {
          $sql .= " AND {$dateCol} = ?";
          $params[] = $appointmentDate;
          $types .= "s";
     }

     $stmt = $conn->prepare($sql);
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }

     if (!empty($params)) {
          $stmt->bind_param($types, ...$params);
     }

     if (!$stmt->execute()) {
          http_response_code(500);
          echo json_encode(['error' => 'Execute failed', 'details' => $stmt->error]);
          $stmt->close();
          exit;
     }

     $res = $stmt->get_result();
     $patients = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
     echo json_encode($patients);
     $stmt->close();

}

if ($data['script'] === 'privateNoteSearch') {
     // 1) Read inputs
     $raw = isset($data['privateNote']) ? trim((string) $data['privateNote']) : '';
     $mode = isset($data['mode']) ? strtolower(trim((string) $data['mode'])) : 'all'; // 'all' | 'any'
     $limit = isset($data['limit']) ? (int) $data['limit'] : 100;
     $offset = isset($data['offset']) ? (int) $data['offset'] : 0;

     // Basic validation
     if ($raw === '') {
          http_response_code(400);
          echo json_encode(['error' => 'Missing private note']);
          exit;
     }

     // 2) Tokenize: supports quoted phrases like: foo "chest pain" bar
     //    Result: ['foo', 'chest pain', 'bar']
     $tokens = [];
     if (preg_match_all('/"([^"]+)"|(\S+)/', $raw, $m)) {
          foreach ($m[1] as $i => $phrase) {
               if ($phrase !== '') {
                    $tokens[] = $phrase;
               } else {
                    $word = $m[2][$i];
                    if ($word !== '')
                         $tokens[] = $word;
               }
          }
     }

     // Safety: dedupe & cap token count
     $tokens = array_values(array_unique($tokens));
     if (empty($tokens)) {
          http_response_code(400);
          echo json_encode(['error' => 'No usable terms']);
          exit;
     }

     // 3) Build SQL
     //    Default = "all" → AND all tokens; "any" → OR tokens
     $glue = ($mode === 'any') ? ' OR ' : ' AND ';

     $sql = "SELECT * FROM `$patientTable` WHERE ";
     $whereParts = [];
     $params = [];
     $types = '';

     foreach ($tokens as $t) {
          $whereParts[] = "privateNote LIKE ?";
          $params[] = '%' . $t . '%';
          $types .= 's';
     }

     $sql .= '(' . implode($glue, $whereParts) . ')';

     // Pagination (defensive bounds)
     if ($limit <= 0)
          $limit = 100;
     if ($offset < 0)
          $offset = 0;
     $sql .= " ORDER BY id DESC LIMIT ? OFFSET ?";  // adjust ORDER BY as you like
     $types .= 'ii';
     $params[] = $limit;
     $params[] = $offset;

     // 4) Prepare
     $stmt = $conn->prepare($sql);
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }

     // 5) Bind & Execute
     // bind_param requires references; in modern PHP using spread on vars works fine
     $stmt->bind_param($types, ...$params);

     if (!$stmt->execute()) {
          http_response_code(500);
          echo json_encode(['error' => 'Execute failed', 'details' => $stmt->error]);
          $stmt->close();
          exit;
     }

     // 6) Return rows
     $res = $stmt->get_result();
     $patients = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
     echo json_encode($patients);
     $stmt->close();
     exit;
}

if ($data['script'] === 'updateAppointment') {
     $patientID = $data['patientID'] ?? null;
     $appointmentDate = $data['appointmentDate'] ?? null; // can be null to clear

     if (!$patientID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }

     // normalize/validate date if provided
     if ($appointmentDate !== null && $appointmentDate !== '') {
          $ts = strtotime($appointmentDate);
          if ($ts === false) {
               http_response_code(400);
               echo json_encode(['success' => false, 'error' => 'Invalid date (use YYYY-MM-DD)']);
               exit;
          }
          $appointmentDate = date('Y-m-d', $ts);
     } else {
          $appointmentDate = null; // clear
     }

     // prepared statement
     $stmt = $conn->prepare("UPDATE `$patientTable` SET nextAppointment = ? WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     // 's' for DATE string or null, 'i' for id
     $stmt->bind_param('si', $appointmentDate, $patientID);

     if ($stmt->execute()) {
          http_response_code(204); // no content
          exit;
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
          exit;
     }
}

if ($data['script'] === 'updatePrivateNote') {


     $patientID = $data['patientID'] ?? null;
     $privateNote = $data['privateNote'] ?? null; // can be null to clear

     if (!$patientID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }


     // prepared statement
     $stmt = $conn->prepare("UPDATE `$patientTable` SET privateNote = ? WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     // 's' for string (or null), 'i' for id
     $stmt->bind_param('si', $privateNote, $patientID);

     if ($stmt->execute()) {
          // Return a JSON response so caller receives confirmation (instead of 204 no-content)
          http_response_code(200);
          echo json_encode(['success' => true, 'affected_rows' => $stmt->affected_rows]);
          $stmt->close();
          $conn->close();
          exit;
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
          $stmt->close();
          $conn->close();
          exit;
     }
}

if ($data['script'] === 'labRangeSearch') {
     $filters = isset($data['filters']) && is_array($data['filters']) ? $data['filters'] : $data;
     unset($filters['script'], $filters['limit'], $filters['offset'], $filters['orderBy'], $filters['orderDir']);
     $ALLOWED = [
          "cholesterol",
          "triglyceride",
          "hdl",
          "ldl",
          "nonHdl",
          "cholesterolHdlRatio",
          "creatineKinase",
          "alanineAminotransferase",
          "lipoproteinA",
          "apolipoproteinB",
          "natriureticPeptideB",
          "urea",
          "creatinine",
          "gfr",
          "albumin",
          "sodium",
          "potassium",
          "vitaminB12",
          "ferritin",
          "hemoglobinA1C",
          "urineAlbumin",
          "albuminCreatinineRatio",
     ];

     // Build WHERE from filters
     $where = " WHERE 1=1";
     $types = "";
     $params = [];

     // If you expect these fields might be stored as VARCHAR and want numeric compare,
// you can switch "$col" to "CAST($col AS DECIMAL(12,4))" below.
     foreach ($filters as $col => $range) {
          if (!in_array($col, $ALLOWED, true)) {
               // ignore unknown keys
               continue;
          }
          if (!is_array($range))
               continue;

          // accept 0 and numeric strings
          $hasGt = array_key_exists('gt', $range) && $range['gt'] !== '' && $range['gt'] !== null;
          $hasLt = array_key_exists('lt', $range) && $range['lt'] !== '' && $range['lt'] !== null;

          if (!$hasGt && !$hasLt)
               continue;

          // Inclusive bounds (>= for gt, <= for lt). Change to > / < if you need strict.
          if ($hasGt) {
               $where .= " AND `$col` >= ?";
               $types .= "d"; // double
               $params[] = (float) $range['gt'];
          }
          if ($hasLt) {
               $where .= " AND `$col` <= ?";
               $types .= "d";
               $params[] = (float) $range['lt'];
          }
     }

     // Nothing to filter? you can either return all or 400. Here we 400.
     if ($where === " WHERE 1=1") {
          http_response_code(400);
          echo json_encode(['error' => 'No valid filters provided']);
          exit;
     }

     // Pagination
     $limit = isset($data['limit']) ? (int) $data['limit'] : 200;
     $offset = isset($data['offset']) ? (int) $data['offset'] : 0;
     if ($limit <= 0)
          $limit = 200;
     if ($limit > 1000)
          $limit = 1000;
     if ($offset < 0)
          $offset = 0;

     // Optional ordering — adjust to match your schema. If you have an auto id, use it.
// Fallback to clientName if that’s your primary display name.
     $orderBy = "id";       // change if your PK/ordering column is different
     $orderDir = "DESC";

     $sql = "SELECT * FROM `$patientTable`" . $where . " ORDER BY `$orderBy` $orderDir LIMIT ? OFFSET ?";

     // Prepare
     $stmt = $conn->prepare($sql);
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['error' => 'Prepare failed', 'details' => $conn->error, 'sql' => $sql]);
          exit;
     }

     // Bind params (including limit/offset)
     $types .= "ii";
     $params[] = $limit;
     $params[] = $offset;

     $stmt->bind_param($types, ...$params);

     // Execute
     if (!$stmt->execute()) {
          http_response_code(500);
          echo json_encode(['error' => 'Execute failed', 'details' => $stmt->error]);
          $stmt->close();
          exit;
     }

     // Fetch
     $res = $stmt->get_result();
     $rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
     $stmt->close();

     // Return JSON
     echo json_encode($rows);

}

if ($data['script'] === 'updatePatientConditions') {
     $patientID = $data['patientID'] ?? null;
     $conditionCodes = $data['conditionCodes'] ?? null;
     if (!$patientID || $conditionCodes === null) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patientID or conditionCodes']);
          exit;
     }

     $stmt = "UPDATE `$patientTable` SET conditionData = '{$conditionCodes}' WHERE id = '{$patientID}'";
     $go = $conn->query($stmt) or die($stmt);
}

if ($data['script'] === 'updatePatientSuspected') {
     $patientID = $data['patientID'] ?? null;
     $conditionCodes = $data['conditionCodes'] ?? null;


     if (!$patientID || $conditionCodes === null) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patientID or conditionCodes']);
          exit;
     }

     $stmt = "UPDATE `$patientTable` SET suspectedCon = '{$conditionCodes}' WHERE id = '{$patientID}'";
     $go = $conn->query($stmt) or die($stmt);
}

if ($data['script'] === 'getPatientById') {
     $patientID = $data['patientID'] ?? null;

     if (!$patientID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }

     $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     $stmt->bind_param('i', $patientID);

     if ($stmt->execute()) {
          $result = $stmt->get_result();
          $patient = $result->fetch_assoc();
          echo json_encode(['success' => true, 'patient' => $patient]);
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
     }
     $stmt->close();
     $conn->close();
     exit;
}

if ($data['script'] === 'getPatientByHealthNumber') {

     $healthNumber = $data['healthNumber'] ?? null;

     if (!$healthNumber) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }

     $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE healthNumber = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     $stmt->bind_param('s', $healthNumber);

     if ($stmt->execute()) {
          $result = $stmt->get_result();
          $patient = $result->fetch_assoc();
          echo json_encode(['success' => true, 'patient' => $patient]);
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
     }
     $stmt->close();
     $conn->close();
     exit;
}

if ($data['script'] === 'getMeds') {
     // Adjust column names if your table uses different casing/labels.
     $sql = "
        SELECT * FROM medications ORDER BY medication ASC
    ";

     $result = $conn->query($sql);

     if ($result) {
          $meds = [];
          while ($row = $result->fetch_assoc()) {
               $meds[] = $row;
          }

          echo json_encode([
               'success' => true,
               'meds' => $meds
          ], JSON_UNESCAPED_UNICODE);

     } else {
          http_response_code(500);
          echo json_encode([
               'success' => false,
               'error' => 'Query failed',
               'details' => $conn->error
          ]);
     }
     exit;
}

if ($data['script'] === 'conditionSearch') {
     $conditionCodes = $data['codes'] ?? [];

     $patients = [];
     if (!empty($conditionCodes) && is_array($conditionCodes)) {
          $seen = [];
          foreach ($conditionCodes as $code) {
               $code = trim($code);
               if ($code === '')
                    continue;
               // Use FIND_IN_SET for comma-separated values, or LIKE if needed
               $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE FIND_IN_SET(?, conditionData)");
               $stmt->bind_param('s', $code);
               $stmt->execute();
               $result = $stmt->get_result();
               while ($row = $result->fetch_assoc()) {
                    $id = $row['id'];
                    if (!isset($seen[$id])) {
                         $patients[] = $row;
                         $seen[$id] = true;
                    }
               }
               $stmt->close();
          }
     }
     echo json_encode($patients);
     exit;
}

if ($data['script'] === 'getMedsArray') {
     $sql = "SELECT * FROM medications ORDER BY medication ASC";
     $result = $conn->query($sql);
     if ($result) {
          $meds = [];
          while ($row = $result->fetch_assoc()) {
               $meds[] = $row;
          }
     }
     $sql2 = "SELECT * FROM medCat ORDER BY medication_cat ASC";
     $result2 = $conn->query($sql2);
     if ($result2) {
          $cats = [];
          while ($row = $result2->fetch_assoc()) {
               $cats[] = $row['medication_cat'];
          }
     }
     echo json_encode([
          'meds' => $meds ?? [],
          'cats' => $cats ?? []
     ]);

     exit;
}

if ($data['script'] === 'updatePaymentMethod') {
     $patientID = $data['patientID'] ?? null;
     $paymentMethod = $data['paymentMethod'] ?? null;

     if (!$patientID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }

     $stmt = $conn->prepare("UPDATE `$patientTable` SET paymentMethod = ? WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     $stmt->bind_param('si', $paymentMethod, $patientID);

     if ($stmt->execute()) {
          http_response_code(204); // no content
          exit;
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
          exit;
     }
}

if ($data['script'] === 'getMarkBrady') {
     $patientID = 2;

     if (!$patientID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }

     $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     $stmt->bind_param('i', $patientID);

     if ($stmt->execute()) {
          $result = $stmt->get_result();
          $patient = $result->fetch_assoc();
          echo json_encode(['success' => true, 'patient' => $patient]);
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
     }
     $stmt->close();
     $conn->close();
     exit;
}

if ($data['script'] === 'updateRecommendations') {
     $patientID = isset($data['patientID']) ? (int) $data['patientID'] : null;
     $recommendations = array_key_exists('recommendations', $data) ? $data['recommendations'] : null;

     if (!$patientID) {
          // missing id — no body response
          http_response_code(400);
          exit;
     }

     $stmt = $conn->prepare("UPDATE `$patientTable` SET recommendations = ? WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          exit;
     }

     $stmt->bind_param('si', $recommendations, $patientID);

     if ($stmt->execute()) {
          // No content response for "fetch-and-forget" callers
          http_response_code(204);
          $stmt->close();
          $conn->close();
          exit;
     } else {
          http_response_code(500);
          $stmt->close();
          $conn->close();
          exit;
     }
}

if ($data['script'] === 'findPatientsForMedication') {

     $medId = $data['medicationId'] ?? null;
     $patientTableName = $data['patientDB'] ?? 'Patient'; // adjust if needed

     // Basic guard: medicationId must exist for any path
     if ($medId === null || $medId === '') {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing medicationId']);
          exit;
     }

     // --- SPECIAL CASE: FINERENONE (simple CSV match on recommendedMed) ---
     // if ($medId === 'Finerenonexxx') {

     //      $sql = "SELECT * FROM `$patientTableName`
     //            WHERE CONCAT(',', recommendedMed, ',') LIKE CONCAT('%,', ?, ',%')";

     //      $stmt = $conn->prepare($sql);
     //      if (!$stmt) {
     //           http_response_code(500);
     //           echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
     //           exit;
     //      }

     //      $medIdStr = (string) $medId;
     //      $stmt->bind_param('s', $medIdStr);

     //      if (!$stmt->execute()) {
     //           http_response_code(500);
     //           echo json_encode(['success' => false, 'error' => 'Execute failed', 'details' => $stmt->error]);
     //           $stmt->close();
     //           exit;
     //      }

     //      $res = $stmt->get_result();
     //      $rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];

     //      echo json_encode($rows);

     //      $stmt->close();
     //      $conn->close();
     //      exit;
     // }

     // --- OTHER MEDICATIONS (Metformin, SGLT2i, GLP-1, ACE/ARB, Vascepa) ---
     switch ($medId) {
          case 'Metformin':
          case 'SGLT2 Inhibitor':
          case 'GLP-1 Receptor Agonist':
          case 'Praluent':
               // Thresholds
               $nonHdlThreshold = 2.4; // starting filter: patients with nonHdl >= 2.4
               $nativeCutoff = 5.0; // check nativeLDLC vs 5.0

               // 1) Find all patients with nonHdl >= threshold
               $sql = "SELECT * 
            FROM `$patientTableName`
            WHERE nonHdl IS NOT NULL
              AND nonHdl <> ''
              AND COALESCE(nonHdl, 0) >= ?";
               $stmt = $conn->prepare($sql);
               if (!$stmt) {
                    http_response_code(500);
                    echo json_encode([
                         'success' => false,
                         'error' => 'Prepare failed (patient lookup)',
                         'details' => $conn->error
                    ]);
                    exit;
               }

               $stmt->bind_param('d', $nonHdlThreshold);
               if (!$stmt->execute()) {
                    http_response_code(500);
                    echo json_encode([
                         'success' => false,
                         'error' => 'Execute failed (patient lookup)',
                         'details' => $stmt->error
                    ]);
                    $stmt->close();
                    exit;
               }

               $patientsResult = $stmt->get_result();
               $stmt->close();

               // 2) Get all statin meds with ID, dose, and name
               $medCategory = 'Statin';
               $sql = "SELECT ID, medication, medication_dose
            FROM medications
            WHERE medication_cat = ?";
               $stmt = $conn->prepare($sql);
               if (!$stmt) {
                    http_response_code(500);
                    echo json_encode([
                         'success' => false,
                         'error' => 'Prepare failed (statin lookup)',
                         'details' => $conn->error
                    ]);
                    exit;
               }

               $stmt->bind_param('s', $medCategory);
               if (!$stmt->execute()) {
                    http_response_code(500);
                    echo json_encode([
                         'success' => false,
                         'error' => 'Execute failed (statin lookup)',
                         'details' => $stmt->error
                    ]);
                    $stmt->close();
                    exit;
               }

               $res = $stmt->get_result();

               // statinsById[ID] = ['name' => ..., 'dose' => floatDose]
               $statinsById = [];
               while ($med = $res->fetch_assoc()) {
                    $doseNumeric = preg_replace('/[^0-9.]/', '', $med['medication_dose']);
                    $dose = (float) $doseNumeric;

                    $id = (int) $med['ID'];
                    $statinsById[$id] = [
                         'name' => $med['medication'],
                         'dose' => $dose
                    ];
               }
               $stmt->close();

               // 3) Prepare an UPDATE for nativeLDLC
               //    NOTE: adjust primary key column if not `id`
               $updateSql = "UPDATE `$patientTableName`
                  SET nativeLDLC = ?
                  WHERE id = ?";
               $updateStmt = $conn->prepare($updateSql);
               if (!$updateStmt) {
                    http_response_code(500);
                    echo json_encode([
                         'success' => false,
                         'error' => 'Prepare failed (update nativeLDLC)',
                         'details' => $conn->error
                    ]);
                    exit;
               }

               $rows = [];
               $statinCount = 0;

               while ($row = $patientsResult->fetch_assoc()) {
                    // IMPORTANT: medsData is lower-case in your table
                    $medsData = $row['medsData'] ?? '';
                    $medsArray = array_filter(array_map('trim', explode(',', $medsData)));

                    $remainingFraction = 1.0; // non-HDL on therapy = baseline * remainingFraction
                    $hasStatin = false;
                    $hasEzetimibe = false;

                    // --- STATIN EFFECT ---
                    foreach ($medsArray as $medIdStr) {
                         $medId = (int) $medIdStr;

                         if (isset($statinsById[$medId])) {
                              $hasStatin = true;
                              $statin = $statinsById[$medId];
                              $dose = $statin['dose'];

                              // Simple dose-based rule (you can refine by drug later):
                              //  - >= 80 mg → ~50% reduction → remaining 0.5
                              //  - >= 40 mg → ~40% reduction → remaining 0.6
                              //  - < 40 mg  → ~30% reduction → remaining 0.7
                              if ($dose >= 80) {
                                   $statinRemaining = 0.5;
                              } elseif ($dose >= 40) {
                                   $statinRemaining = 0.6;
                              } else {
                                   $statinRemaining = 0.7;
                              }

                              $remainingFraction *= $statinRemaining;

                              // For now, only consider the first statin found
                              break;
                         }
                    }

                    if ($hasStatin) {
                         $statinCount++;
                    }

                    // --- EZETIMIBE EFFECT (example: med ID 144) ---
                    // 20% LDL-C reduction → remaining 0.8
                    if (in_array('144', $medsArray, true)) {
                         $hasEzetimibe = true;
                         $remainingFraction *= 0.8;
                    }

                    // --- CALCULATE nativeLDLC = estimated "untreated" non-HDL ---
                    $nativeLDLC = null;
                    if (
                         $remainingFraction > 0
                         && isset($row['nonHdl'])
                         && $row['nonHdl'] !== null
                         && $row['nonHdl'] !== ''
                    ) {
                         $currentNonHdl = (float) $row['nonHdl'];
                         $nativeLDLC = $currentNonHdl / $remainingFraction;
                    }

                    // Store values on the row for JSON
                    $row['nativeLDLC'] = $nativeLDLC;
                    $row['hasStatin'] = $hasStatin;
                    $row['hasEzetimibe'] = $hasEzetimibe;
                    $row['ldlRemainingFraction'] = $remainingFraction;
                    $row['nativeLDLC_over_5'] = ($nativeLDLC !== null && $nativeLDLC >= $nativeCutoff);

                    // Update Patient.nativeLDLC in DB when we have an id + value
                    if ($nativeLDLC !== null && isset($row['id'])) {
                         $id = (int) $row['id'];
                         $updateStmt->bind_param('di', $nativeLDLC, $id);
                         $updateStmt->execute();
                    }
                    if ($nativeLDLC >= $nativeCutoff) {
                         $medicationToAdd = 'Repatha';
                         // Read current recommendedMed (CSV string)
                         $currentMeds = $row['recommendedMed'] ?? '';
                         $medsArray = array_filter(array_map('trim', explode(',', $currentMeds)));

                         // Check if 'Vascepa' already exists
                         if (!in_array($medicationToAdd, $medsArray)) {
                              // Add 'Repath' to the array
                              $medsArray[] = $medicationToAdd;
                              $newMeds = implode(',', $medsArray);

                              // Update the database
                              $stmt = $conn->prepare("UPDATE `$patientTableName` SET recommendedMed = ? WHERE id = ?");
                              $stmt->bind_param('si', $newMeds, $row['id']);
                              $stmt->execute();
                              $stmt->close();

                              // Update the row data to reflect the change
                              $row['recommendedMed'] = $newMeds;
                         }
                         $rows[] = $row;
                    }

               }

               $updateStmt->close();

               echo json_encode($rows);
               $conn->close();
               exit;



          case 'Finerenone':
               $gfr = 25;
               $ratio = 3;
               $k = 5;
               $a1c = 7.0;
               $sql = "SELECT * FROM `$patientTableName` WHERE COALESCE(gfr, 0) > $gfr AND COALESCE(albuminCreatinineRatio, 0) > $ratio AND COALESCE(potassium, 0) < $k AND COALESCE(hemoglobinA1C, 0) > $a1c";
               $result = $conn->query($sql);
               if (!$result) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $conn->error]);
                    exit;
               }

               $rows = [];
               while ($row = $result->fetch_assoc()) {
                    $medicationToAdd = 'Finerenone';
                    // Read current recommendedMed (CSV string)
                    $currentMeds = $row['recommendedMed'] ?? '';
                    $medsArray = array_filter(array_map('trim', explode(',', $currentMeds)));

                    // Check if 'Vascepa' already exists
                    if (!in_array($medicationToAdd, $medsArray)) {
                         // Add 'Vascepa' to the array
                         $medsArray[] = $medicationToAdd;
                         $newMeds = implode(',', $medsArray);

                         // Update the database
                         $stmt = $conn->prepare("UPDATE `$patientTableName` SET recommendedMed = ? WHERE id = ?");
                         $stmt->bind_param('si', $newMeds, $row['id']);
                         $stmt->execute();
                         $stmt->close();

                         // Update the row data to reflect the change
                         $row['recommendedMed'] = $newMeds;
                    }

                    $rows[] = $row;
               }

               echo json_encode($rows);
               $conn->close();
               exit;
          case 'Vescepa': // or 'Vasepa' – make sure this matches the front-end value

               // 1) First find all the IDs of meds that are a statin
               $sql = "SELECT ID FROM medications WHERE medication_cat = ?";
               $stmt = $conn->prepare($sql);
               if (!$stmt) {
                    http_response_code(500);
                    echo json_encode([
                         'success' => false,
                         'error' => 'Prepare failed (statin lookup)',
                         'details' => $conn->error
                    ]);
                    exit;
               }

               $med1 = 'Statin';
               $stmt->bind_param('s', $med1);

               if (!$stmt->execute()) {
                    http_response_code(500);
                    echo json_encode([
                         'success' => false,
                         'error' => 'Execute failed (statin lookup)',
                         'details' => $stmt->error
                    ]);
                    $stmt->close();
                    exit;
               }

               $res = $stmt->get_result();
               $statinIds = [];
               while ($row = $res->fetch_assoc()) {
                    $statinIds[] = (int) $row['ID'];
               }
               $stmt->close();

               // 2) Now get all Endocrine/Metabolic condition IDs from patient_conditions
               $smtp_conditions = "
               SELECT conditionCode 
               FROM `patient_conditions`
               WHERE conditionCatagory = 'Endocrine/Metabolic'
          ";
               $smtp_conditions_q = $conn->query($smtp_conditions);

               if (!$smtp_conditions_q) {
                    http_response_code(500);
                    echo json_encode([
                         'success' => false,
                         'error' => 'Query failed (condition lookup)',
                         'details' => $conn->error
                    ]);
                    exit;
               }

               $conditionIds = [];
               while ($row = $smtp_conditions_q->fetch_assoc()) {
                    $conditionIds[] = $row['conditionCode'];
               }

               // If you're just testing, you *can* override; otherwise keep what DB gave you
               $conditionIds = ["TYPE", "TDXX"];

               // Thresholds (adjust as needed)
               $tgValue = 1.5;  // example TG threshold
               $a1c = 6.0;  // example A1C threshold


               // 3) Build WHERE part for statin meds (medicationId is CSV of med IDs)
               $statinConditions = [];
               foreach ($statinIds as $sid) {
                    // medicationId is a CSV of integers: "1,3,7"
                    $sid = (int) $sid;
                    $statinConditions[] = "FIND_IN_SET($sid, MedsData)";
               }
               $statinWhere = empty($statinConditions)
                    ? '0'      // no statins found -> no patient can match
                    : '(' . implode(' OR ', $statinConditions) . ')';


               // Build regex pattern for condition codes (e.g. "TYPE|TDXX|T2DM")
               $conditionPattern = implode('|', array_map('preg_quote', $conditionIds));



               // 4) Now build the final patient query
               // NOTE: change column names if needed:
               //   - medicationId   => CSV of med IDs
               //   - conditionData  => field where condition codes are stored (string)
               //   - triglyceride   => TG field
               //   - hemoglobinA1C  => A1C field
               $sql = "
                  SELECT *
                  FROM `$patientTableName`
                  WHERE 
                         $statinWhere
                         AND COALESCE(triglyceride, 0) >= $tgValue
                         
            ";

               $result = $conn->query($sql) or die($sql);
               if (!$result) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $conn->error]);
                    exit;
               }

               $rows = [];
               while ($row = $result->fetch_assoc()) {
                    $medicationToAdd = 'Vascepa';
                    // Read current recommendedMed (CSV string)
                    $currentMeds = $row['recommendedMed'] ?? '';
                    $medsArray = array_filter(array_map('trim', explode(',', $currentMeds)));

                    // Check if 'Vascepa' already exists
                    if (!in_array($medicationToAdd, $medsArray)) {
                         // Add 'Vascepa' to the array
                         $medsArray[] = $medicationToAdd;
                         $newMeds = implode(',', $medsArray);

                         // Update the database
                         $stmt = $conn->prepare("UPDATE `$patientTableName` SET recommendedMed = ? WHERE id = ?");
                         $stmt->bind_param('si', $newMeds, $row['id']);
                         $stmt->execute();
                         $stmt->close();

                         // Update the row data to reflect the change
                         $row['recommendedMed'] = $newMeds;
                    }

                    $rows[] = $row;
               }

               echo json_encode($rows);

               $stmt->close();
               $conn->close();
               exit;
               break;
          default:
               http_response_code(404);
               echo json_encode(['success' => false, 'error' => 'Medication not found']);
               $conn->close();
               exit;
     }


}


if ($data['script'] === 'updateProvider') {
     $patientID = $data['patientID'] ?? null;
     $providerId = $data['providerId'] ?? null;
     $patientTable = $data['patientDB'] ?? 'Patient'; // adjust if needed

     if (!$patientID) {
          http_response_code(400);
          exit;
     }

     $stmt = $conn->prepare("UPDATE `$patientTable` SET providerId = ? WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          exit;
     }

     $stmt->bind_param('si', $providerId, $patientID);

     if ($stmt->execute()) {
          http_response_code(204);
          $stmt->close();
          $conn->close();
          exit;
     } else {
          http_response_code(500);
          $stmt->close();
          $conn->close();
          exit;
     }
}

if (($data['script'] ?? '') === 'updateMedicationAndPropagate') {

     $ID = $data['ID'] ?? null;
     $newMedication = $data['newMedication'] ?? null;
     $medication_cat = $data['medication_cat'] ?? null;
     $catID = $data['catID'] ?? null;
     $medication_dose = $data['medication_dose'] ?? null;
     $medPoints = $data['medPoints'] ?? null;

     if (!$ID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing ID']);
          exit;
     }

     // 1) Update the edited medication row
     $stmt = $conn->prepare("
    UPDATE medications_2026
    SET medication = ?, medication_cat = ?, catID = ?, medication_dose = ?, medPoints = ?
    WHERE ID = ?
  ");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }

     // ✅ correct types: catID is string, medPoints is int
     $stmt->bind_param('ssssii', $newMedication, $medication_cat, $catID, $medication_dose, $medPoints, $ID);

     if (!$stmt->execute()) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Update failed', 'details' => $stmt->error]);
          $stmt->close();
          exit;
     }
     $affected = $stmt->affected_rows;
     $stmt->close();

     // 2) Update medicationUsed for ALL meds in one query (fast)
     $stmt = $conn->prepare("
     UPDATE medications_2026 m
          LEFT JOIN medCats2026 c ON c.ID = CAST(m.catID AS UNSIGNED)
          SET
          m.medicationUsed = CASE
                WHEN CAST(m.catID AS UNSIGNED) = 237 THEN 'No'
               ELSE c.catStatus
          END,
          m.medPoints = CASE
          WHEN CAST(m.catID AS UNSIGNED) = 237 THEN 0
          WHEN c.catPoints IS NULL THEN m.medPoints
          ELSE c.catPoints
          END
          WHERE m.catID IS NOT NULL AND m.catID <> '';


  ");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }

     $stmt->execute();
     $updatedUsed = $stmt->affected_rows;
     $stmt->close();

     // 3) Set medicationUsed = 'No' for all meds with catID = '237'
     echo json_encode([
          'success' => true,
          'edited_rows' => $affected,
          'medicationUsed_rows_updated' => $updatedUsed
     ]);
     exit;
}

