<?php
/**
 * Speckable.pl Relay — через ScraperAPI (обход Cloudflare)
 *
 * Edge Function → этот скрипт → ScraperAPI → speckable.pl
 * ScraperAPI обходит Cloudflare JS challenge автоматически.
 */

// ═══ КОНФИГ ═══
$API_KEY         = 'spk-8f3a1e7d-relay-maxmaster';
$SCRAPER_API_KEY = '22337df5e98d32b0d76377d2f685f1aa';

// ═══ CORS + JSON ═══
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['error' => 'POST only']));
}

// ═══ INPUT ═══
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    die(json_encode(['error' => 'Invalid JSON body']));
}
if (($input['api_key'] ?? '') !== $API_KEY) {
    http_response_code(403);
    die(json_encode(['error' => 'Invalid API key']));
}

$url          = $input['url'] ?? '';
$method       = strtoupper($input['method'] ?? 'GET');
$postBody     = $input['body'] ?? '';
$cookies      = $input['cookies'] ?? [];
$extraHeaders = $input['headers'] ?? [];

if (!$url || !preg_match('#^https://(www\.)?speckable\.pl(/|$)#', $url)) {
    http_response_code(400);
    die(json_encode(['error' => 'Only speckable.pl URLs allowed']));
}
if (!is_array($cookies)) $cookies = [];
if (!is_array($extraHeaders)) $extraHeaders = [];

// Cookie string для передачи в ScraperAPI
$cookieStr = '';
foreach ($cookies as $k => $v) {
    if ($cookieStr) $cookieStr .= '; ';
    $cookieStr .= $k . '=' . $v;
}

// ═══════════════════════════════════════════════════════════
//  Сначала пробуем напрямую (вдруг Cloudflare не блокирует)
//  Если 403 + challenge — переключаемся на ScraperAPI
// ═══════════════════════════════════════════════════════════

$body = '';
$httpCode = 0;
$resultCookies = $cookies;
$usedScraperAPI = false;

// ─── Шаг 1: прямой запрос ───
$directResult = directRequest($url, $method, $postBody, $cookies, $extraHeaders);
$httpCode = $directResult['status'];
$body = $directResult['body'];
$resultCookies = $directResult['cookies'];

// Проверяем Cloudflare challenge
$isCloudflare = ($httpCode === 403 || $httpCode === 503)
    && (strpos($body, 'Just a moment') !== false
     || strpos($body, 'cf-') !== false
     || strpos($body, 'challenge') !== false);

// ─── Шаг 2: если Cloudflare — через ScraperAPI ───
if ($isCloudflare && $SCRAPER_API_KEY) {
    $scraperResult = scraperApiRequest($url, $method, $postBody, $cookieStr, $extraHeaders, $SCRAPER_API_KEY);
    $httpCode = $scraperResult['status'];
    $body = $scraperResult['body'];
    $usedScraperAPI = true;
    // ScraperAPI не возвращает Set-Cookie, оставляем входные cookies
}

// ─── Ответ ───
echo json_encode([
    'status'  => $httpCode,
    'body'    => $body,
    'cookies' => !empty($resultCookies) ? (object)$resultCookies : new \stdClass(),
    'via'     => $usedScraperAPI ? 'scraperapi' : 'direct',
]);
exit;


// ═══════════════════════════════════════════════════════════
//  ФУНКЦИИ
// ═══════════════════════════════════════════════════════════

/**
 * Прямой cURL запрос с обработкой редиректов
 */
function directRequest(string $url, string $method, string $postBody, array $cookies, array $extraHeaders): array {
    $currentUrl     = $url;
    $currentCookies = $cookies;
    $currentMethod  = $method;
    $maxRedirects   = 10;

    for ($redir = 0; $redir <= $maxRedirects; $redir++) {
        $cookieStr = '';
        foreach ($currentCookies as $k => $v) {
            if ($cookieStr) $cookieStr .= '; ';
            $cookieStr .= $k . '=' . $v;
        }

        $curlHeaders = [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: pl-PL,pl;q=0.9',
        ];
        if ($redir === 0 && !empty($extraHeaders)) {
            foreach ($extraHeaders as $h) {
                if (is_string($h) && $h !== '') $curlHeaders[] = $h;
            }
        }

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $currentUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            CURLOPT_HTTPHEADER     => $curlHeaders,
            CURLOPT_COOKIE         => $cookieStr,
            CURLOPT_HEADER         => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_ENCODING       => '',
        ]);
        if ($currentMethod === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postBody);
        }

        $response   = curl_exec($ch);
        $httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $err        = curl_error($ch);
        curl_close($ch);

        if ($err) {
            return ['status' => 0, 'body' => '', 'cookies' => $currentCookies, 'error' => $err];
        }

        $respHeaders = substr($response, 0, $headerSize);
        $respBody    = substr($response, $headerSize);

        // Собираем cookies
        if (preg_match_all('/^Set-Cookie:\s*([^=]+)=([^;\r\n]*)/mi', $respHeaders, $m, PREG_SET_ORDER)) {
            foreach ($m as $cm) {
                $n = trim($cm[1]);
                if ($n !== '') $currentCookies[$n] = trim($cm[2]);
            }
        }

        // Redirect
        if (in_array($httpCode, [301, 302, 303, 307, 308])) {
            if (preg_match('/^Location:\s*(\S+)/mi', $respHeaders, $loc)) {
                $location = trim($loc[1]);
                if (!str_starts_with($location, 'http')) {
                    $p = parse_url($currentUrl);
                    $location = $p['scheme'] . '://' . $p['host'] . $location;
                }
                $currentUrl    = $location;
                $currentMethod = 'GET';
                continue;
            }
        }

        return ['status' => $httpCode, 'body' => $respBody, 'cookies' => $currentCookies];
    }

    return ['status' => 0, 'body' => '', 'cookies' => $currentCookies, 'error' => 'Too many redirects'];
}


/**
 * Запрос через ScraperAPI (обход Cloudflare)
 */
function scraperApiRequest(
    string $url, string $method, string $postBody,
    string $cookieStr, array $extraHeaders, string $scraperKey
): array {
    $ch = curl_init();

    if ($method === 'GET') {
        // GET: простой запрос через ScraperAPI URL
        $params = [
            'api_key' => $scraperKey,
            'url'     => $url,
        ];
        // Передаём cookies через keep_headers
        $curlHeaders = [];
        if ($cookieStr) {
            $params['keep_headers'] = 'true';
            $curlHeaders[] = 'Cookie: ' . $cookieStr;
        }

        curl_setopt_array($ch, [
            CURLOPT_URL            => 'https://api.scraperapi.com?' . http_build_query($params),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_HTTPHEADER     => $curlHeaders,
            CURLOPT_ENCODING       => '',
        ]);
    } else {
        // POST: JSON body к ScraperAPI
        $headers = [
            'Content-Type' => 'application/x-www-form-urlencoded',
        ];
        if ($cookieStr) {
            $headers['Cookie'] = $cookieStr;
        }
        // Добавляем extra headers (Referer и т.д.)
        foreach ($extraHeaders as $h) {
            if (is_string($h) && preg_match('/^([^:]+):\s*(.+)$/', $h, $hm)) {
                $headers[trim($hm[1])] = trim($hm[2]);
            }
        }

        $payload = json_encode([
            'apiKey'  => $scraperKey,
            'url'     => $url,
            'method'  => 'POST',
            'body'    => $postBody,
            'headers' => $headers,
        ]);

        curl_setopt_array($ch, [
            CURLOPT_URL            => 'https://api.scraperapi.com/',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_ENCODING       => '',
        ]);
    }

    $body    = curl_exec($ch);
    $code    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err     = curl_error($ch);
    curl_close($ch);

    if ($err) {
        return ['status' => 0, 'body' => '', 'error' => 'ScraperAPI cURL: ' . $err];
    }

    // ScraperAPI возвращает HTTP 200 с HTML если успешно,
    // или 403/500 при ошибке
    return ['status' => $code, 'body' => $body ?: ''];
}
