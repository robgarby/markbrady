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
if ($conn->connect_error) {
    echo json_encode(['error' => 'Database connection failed.']);
    exit;
}
$conn->query("SET SESSION sql_mode = ''");

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!isset($data['script'])) {
    echo json_encode(['error' => 'No script specified.']);
    exit;
}

$script = $data['script'];
$secret_key = 'TyPe2++';


if ($script === 'login') {
    $username = strtolower(trim($data['username'] ?? ''));
    $password = strtolower(trim($data['password'] ?? ''));

    if ($username === '' || $password === '') {
        echo json_encode(['success' => false, 'error' => 'Username and password required.']);
        exit;
    }

    // Prepare statement to prevent SQL injection
    $stmt = $conn->prepare("SELECT * FROM LOGIN WHERE LOWER(username) = ? AND LOWER(password) = ?");
    $stmt->bind_param("ss", $username, $password);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        $remote_id = $_SERVER['REMOTE_ADDR'];
        $user_id = $row['id'];

        $update_stmt = $conn->prepare("UPDATE LOGIN SET ipAddress = ?, timesOn = timesOn + 1 WHERE id = ?");
        $update_stmt->bind_param("si", $remote_id, $user_id);
        $update_stmt->execute();
        $update_stmt->close();

        unset($row['password']); // Remove password from result

        // JWT generation (RFC 7515 compliant, simple, not production-ready)
        function base64url_encode($data) {
            return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
        }

        $iat = time();
        $exp = $iat + 7200; // Token expires in 2 hours

        $header_json = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
        $payload = $row;
        $payload['iat'] = $iat;
        $payload['exp'] = $exp;
        $payload_json = json_encode($payload);

        $header_b64 = base64url_encode($header_json);
        $payload_b64 = base64url_encode($payload_json);

        $signature = hash_hmac('sha256', "$header_b64.$payload_b64", $secret_key, true);
        $signature_b64 = base64url_encode($signature);

        $jwt = "$header_b64.$payload_b64.$signature_b64";

        echo json_encode([
            'success' => true,
            'jwt' => $jwt,
            'row' => $row,
            'iat' => $iat,
            'exp' => $exp,
        ]);
        } else {
        echo json_encode([
            'success' => false,
            'error' => 'Invalid credentials'
        ]);
        }
    $stmt->close();
}

$conn->close();
