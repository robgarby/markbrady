<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");
header('Content-Type: text/plain'); // So you can easily see plain output during debug


if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
     echo "Invalid request method.";
     exit;
}
$servername = "localhost";
$username = "markbrady_markbrady";
$password = "NoahandK++";
$dbname = "markbrady_optimize";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);


// --- File handling section ---
$response = ['success' => 'No'];

if (isset($_FILES['pdf']) && isset($_POST['healthNumber'])) {
     $file = $_FILES['pdf'];
     $healthNumber = preg_replace("/[^0-9]/", "", $_POST['healthNumber']);
     $orderDate = date('Ymd', strtotime($_POST['orderDate'] ?? 'today'));

     $uploadDir = __DIR__ . "/uploads/";
     if (!is_dir($uploadDir)) {
          mkdir($uploadDir, 0777, true);
     }

     $filename = $uploadDir . $healthNumber . '_' . $orderDate . '.pdf';
     if (move_uploaded_file($file['tmp_name'], $filename)) {
          $stmt = $conn->prepare("INSERT INTO patientFiles (healthNumber, PDFfileName, PDFtimeStamp, labDate) VALUES (?, ?, NOW(), ?)");
          $fileNameOnly = basename($filename);
          $stmt->bind_param("sss", $healthNumber, $fileNameOnly, $orderDate);
          if (!$stmt->execute()) {
               $response['error'] = 'Database insert failed: ' . $stmt->error;
          }
          $stmt->close();
          $response['success'] = 'Yes';
          $response['message'] = 'File uploaded successfully.';
     } else {
          $response['error'] = 'Failed to move uploaded file.';
     }
} else {
     $response['error'] = 'Missing file or health number.';
}

header('Content-Type: application/json');
echo json_encode($response);
?>